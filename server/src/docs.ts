import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, sep } from "node:path";

export type DocEntry = { name: string; isDir: boolean };
export type DocResponse = { kind: "file"; text: string } | { kind: "dir"; entries: DocEntry[] };

// map a URL path (already decoded) onto root; null if it escapes root or is hidden
export function resolveInside(root: string, urlPath: string): string | null {
  if (urlPath.includes("\0")) return null;
  const segments = urlPath.split("/").filter(Boolean);
  // also rejects "." and ".." segments
  if (segments.some((s) => s.startsWith("."))) return null;
  const abs = resolve(root, ...segments);
  return abs === root || abs.startsWith(root + sep) ? abs : null;
}

export async function readDoc(root: string, urlPath: string): Promise<DocResponse | null> {
  const abs = resolveInside(root, urlPath);
  if (abs === null) return null;
  try {
    const info = await stat(abs);
    if (info.isDirectory()) {
      const dirents = await readdir(abs, { withFileTypes: true });
      const entries = dirents
        .filter((d) => !d.name.startsWith("."))
        .filter((d) => d.isDirectory() || (d.isFile() && d.name.endsWith(".md")))
        .map((d) => ({ name: d.name, isDir: d.isDirectory() }))
        .toSorted((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
      return { kind: "dir", entries };
    }
    // files must be addressed exactly: no trailing slash, explicit .md
    if (info.isFile() && abs.endsWith(".md") && !urlPath.endsWith("/")) {
      return { kind: "file", text: await readFile(abs, "utf-8") };
    }
  } catch {
    // fall through: not found
  }
  return null;
}
