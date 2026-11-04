import { createServer, type ServerResponse } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { resolveInside } from "./docs.ts";
import { isAllowedHost } from "./host.ts";
import { getPage } from "./page.ts";
import { diffSnapshots, scan, type Snapshot } from "./watch.ts";

const DOCS_DIR = "/docs";
const WEB_DIR = fileURLToPath(new URL("../web", import.meta.url));
const KATEX_DIR = fileURLToPath(new URL("../node_modules/katex/dist", import.meta.url));
// only what the page needs from KaTeX: its stylesheet and fonts
const KATEX_EXTENSIONS = new Set([".css", ".woff2", ".woff", ".ttf"]);
const PORT = Number(process.env["PORT"] ?? 8080);
const POLL_MS = 300;

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};

// no inline scripts and no external resources (raw <script> in Markdown is blocked)
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // KaTeX uses style attributes
  "font-src 'self'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function sendFile(res: ServerResponse, path: string, head: boolean): void {
  res.writeHead(200, { "Content-Type": MIME[extname(path)] ?? "application/octet-stream" });
  if (head) res.end();
  else createReadStream(path).pipe(res);
}

function sendStatus(res: ServerResponse, code: number, message: string): void {
  res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

// --- update notification (Server-Sent Events) ---
// Polling, since inotify does not see host-side changes on bind mounts (macOS).
const clients = new Set<ServerResponse>();
let polling = false;

async function poll(): Promise<void> {
  let previous: Snapshot | null = null;
  while (clients.size > 0) {
    const current = await scan(DOCS_DIR);
    if (previous) {
      for (const path of diffSnapshots(previous, current)) {
        for (const client of clients) {
          client.write(`event: doc-update\ndata: ${JSON.stringify({ path })}\n\n`);
        }
      }
    }
    previous = current;
    await sleep(POLL_MS);
  }
  polling = false;
}

const server = createServer(async (req, res) => {
  res.setHeader("Content-Security-Policy", CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");

  const head = req.method === "HEAD";
  if (req.method !== "GET" && !head) return sendStatus(res, 405, "Method Not Allowed");
  if (!isAllowedHost(req.headers.host)) return sendStatus(res, 403, "Forbidden");

  try {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/__doc") {
      const page = await getPage(DOCS_DIR, url.searchParams.get("path") ?? "");
      const status = { file: 200, dir: 200, notfound: 404, error: 500 }[page.kind];
      res.writeHead(status, { "Content-Type": "application/json" });
      return void res.end(head ? undefined : JSON.stringify(page));
    }

    if (url.pathname === "/__events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
      res.write(": connected\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      if (!polling) {
        polling = true;
        void poll();
      }
      return;
    }

    // static files: the page (web/) and KaTeX assets, else the page shell for navigations
    // (the client decides what to show)
    const pathname = decodeURIComponent(url.pathname);
    const asset = pathname.startsWith("/katex/")
      ? KATEX_EXTENSIONS.has(extname(pathname))
        ? resolveInside(KATEX_DIR, pathname.slice("/katex".length))
        : null
      : resolveInside(WEB_DIR, pathname);
    if (asset && (await isFile(asset))) return sendFile(res, asset, head);
    if (req.headers.accept?.includes("text/html")) {
      return sendFile(res, `${WEB_DIR}/index.html`, head);
    }
    sendStatus(res, 404, "Not Found");
  } catch {
    if (!res.headersSent) sendStatus(res, 500, "Internal Server Error");
  }
});

server.listen(PORT, "0.0.0.0", () => console.log(`listening on :${PORT}`));

// as PID 1 in a container, Node ignores signals unless handled
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(0));
