// Shows the HTML rendered by the server and refreshes it on change notifications.
const container = document.getElementById("content");

let path = "";
try {
  path = decodeURIComponent(location.pathname);
} catch {
  // malformed URL: the server answers "not found"
}

const base = path.split("/").filter(Boolean).pop();
document.title = base ? `${base} - MyMarkdownViewer` : "MyMarkdownViewer";

let kind = "notfound";
let latest = 0;

// replace the content in place (no page reload) so that the scroll position is kept
async function show() {
  const id = ++latest;
  try {
    const res = await fetch(`/__doc?path=${encodeURIComponent(path)}`);
    const page = await res.json();
    if (id !== latest) return; // a newer update is in flight
    kind = page.kind;
    container.innerHTML = page.html;
  } catch (e) {
    container.textContent = `[Error: ${e instanceof Error ? e.message : "unknown"}]`;
  }
}

// Update when the shown file changes, or (for listings and errors) on any change.
// Browsers allow only 6 connections per host, so this long-lived connection is kept
// only while the page is visible, and released as soon as the page is left.
// Otherwise open tabs (or the page being navigated away from) starve new page loads.
let events = null;
let opened = document.hidden; // loaded in the background: the first connect must refresh

function connect() {
  if (events) return;
  events = new EventSource("/__events");
  events.addEventListener("doc-update", (e) => {
    if (kind !== "file" || JSON.parse(e.data).path === path) show();
  });
  // after a (re)connect, changes may have been missed
  events.addEventListener("open", () => {
    if (opened) show();
    opened = true;
  });
}

function disconnect() {
  events?.close();
  events = null;
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) disconnect();
  else connect();
});
window.addEventListener("pagehide", disconnect);
window.addEventListener("pageshow", (e) => {
  if (e.persisted) connect(); // restored from the back/forward cache
});

if (!document.hidden) connect();
show();
