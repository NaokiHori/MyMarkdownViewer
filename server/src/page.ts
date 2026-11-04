import { readDoc, type DocEntry } from "./docs.ts";
import { escapeHtml, render } from "./markdown.ts";

// What the browser shows: the final HTML plus what it is (decides when to refresh).
export type Page = { kind: "file" | "dir" | "notfound" | "error"; html: string };

const encodePath = (path: string) => path.split("/").map(encodeURIComponent).join("/");

export function renderListing(path: string, entries: DocEntry[]): string {
  // normalize so that links never start with "//" (protocol-relative URL)
  const segments = path.split("/").filter(Boolean);
  const base = "/" + segments.map((s) => s + "/").join("");
  const items = entries.map(({ name, isDir }) => {
    const label = isDir ? `${name}/` : name;
    return `<li><a href="${encodePath(base + name)}">${escapeHtml(label)}</a></li>`;
  });
  return `<h1>${escapeHtml(base)}</h1><ul>${items.join("")}</ul>`;
}

export async function getPage(root: string, path: string): Promise<Page> {
  try {
    const doc = await readDoc(root, path);
    if (!doc) {
      return {
        kind: "notfound",
        html: `<p class="math-error">[Not Found: ${escapeHtml(path)}]</p>`,
      };
    }
    if (doc.kind === "file") return { kind: "file", html: render(doc.text) };
    return { kind: "dir", html: renderListing(path, doc.entries) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "unknown";
    return {
      kind: "error",
      html: `<p class="math-error">[Render Error: ${escapeHtml(message)}]</p>`,
    };
  }
}
