import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDoc, resolveInside } from "./docs.ts";
import { isAllowedHost } from "./host.ts";
import { getPage, renderListing } from "./page.ts";
import { diffSnapshots } from "./watch.ts";

async function fixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "docs-"));
  await mkdir(join(root, "sub"));
  await writeFile(join(root, "a.md"), "# a");
  await writeFile(join(root, "b.txt"), "not markdown");
  await writeFile(join(root, ".hidden.md"), "hidden");
  await writeFile(join(root, "sub", "c.md"), "# c");
  return root;
}

void test("resolveInside rejects escapes and hidden paths", () => {
  for (const p of ["/../x", "/sub/../../x", "/.git", "/sub/.hidden", "/a\0.md"]) {
    assert.equal(resolveInside("/docs", p), null, p);
  }
  assert.equal(resolveInside("/docs", "/sub/c.md"), "/docs/sub/c.md");
  assert.equal(resolveInside("/docs", "/"), "/docs");
});

void test("readDoc: files must match exactly, directories list .md and subdirectories", async () => {
  const root = await fixture();
  assert.deepEqual(await readDoc(root, "/a.md"), { kind: "file", text: "# a" });
  assert.deepEqual(await readDoc(root, "/sub/c.md"), { kind: "file", text: "# c" });
  for (const p of ["/a", "/a.md/", "/b.txt", "/.hidden.md", "/none.md", "/../x"]) {
    assert.equal(await readDoc(root, p), null, p);
  }
  const expected = [
    { name: "sub", isDir: true },
    { name: "a.md", isDir: false },
  ];
  assert.deepEqual(await readDoc(root, "/"), { kind: "dir", entries: expected });
  assert.deepEqual(await readDoc(root, "/sub/"), {
    kind: "dir",
    entries: [{ name: "c.md", isDir: false }],
  });
});

void test("diffSnapshots reports added, modified and removed paths", () => {
  const prev = new Map([
    ["/a.md", "1:1"],
    ["/b.md", "1:1"],
    ["/gone.md", "1:1"],
  ]);
  const next = new Map([
    ["/a.md", "1:1"],
    ["/b.md", "2:1"],
    ["/new.md", "1:1"],
  ]);
  assert.deepEqual(diffSnapshots(prev, next).toSorted(), ["/b.md", "/gone.md", "/new.md"]);
  assert.deepEqual(diffSnapshots(prev, prev), []);
});

void test("isAllowedHost: localhost and IP literals only", () => {
  for (const h of [
    "localhost:8080",
    "127.0.0.1:8080",
    "[::1]:8080",
    "app.localhost",
    "192.168.0.2",
  ]) {
    assert.equal(isAllowedHost(h), true, h);
  }
  for (const h of [
    "evil.example.com",
    "evil.example.com:8080",
    "localhost.evil.com",
    "",
    undefined,
  ]) {
    assert.equal(isAllowedHost(h), false, String(h));
  }
});

void test("renderListing escapes names and never links protocol-relative", () => {
  const html = renderListing("//", [{ name: "<b>&#.md", isDir: false }]);
  assert.match(html, /href="\/%3Cb%3E%26%23\.md"/);
  assert.match(html, />&lt;b&gt;&amp;#\.md</);
  assert.doesNotMatch(html, /href="\/\//);
});

void test("getPage: kind per target, not-found path is escaped", async () => {
  const root = await fixture();
  assert.equal((await getPage(root, "/a.md")).kind, "file");
  assert.equal((await getPage(root, "/sub")).kind, "dir");
  const missing = await getPage(root, "/<img src=x>.md");
  assert.equal(missing.kind, "notfound");
  assert.doesNotMatch(missing.html, /<img/);
});
