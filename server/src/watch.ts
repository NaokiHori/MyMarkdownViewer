import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

// URL path -> "dir" or "<mtime>:<size>"; only what readDoc exposes (.md files, directories)
export type Snapshot = Map<string, string>;

export async function scan(root: string): Promise<Snapshot> {
  const snapshot: Snapshot = new Map();
  const walk = async (dir: string, urlPath: string): Promise<void> => {
    let dirents;
    try {
      dirents = await readdir(dir, { withFileTypes: true });
    } catch {
      return; // removed while scanning
    }
    for (const d of dirents) {
      if (d.name.startsWith(".")) continue;
      const path = `${urlPath}/${d.name}`;
      if (d.isDirectory()) {
        snapshot.set(path, "dir");
        await walk(join(dir, d.name), path);
      } else if (d.isFile() && d.name.endsWith(".md")) {
        try {
          const info = await stat(join(dir, d.name));
          snapshot.set(path, `${info.mtimeMs}:${info.size}`);
        } catch {
          // removed while scanning
        }
      }
    }
  };
  await walk(root, "");
  return snapshot;
}

// paths that were added, removed or modified
export function diffSnapshots(prev: Snapshot, next: Snapshot): string[] {
  const changed: string[] = [];
  for (const [path, value] of next) if (prev.get(path) !== value) changed.push(path);
  for (const path of prev.keys()) if (!next.has(path)) changed.push(path);
  return changed;
}
