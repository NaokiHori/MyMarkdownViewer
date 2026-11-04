# MyMarkdownViewer

Minimal local Markdown viewer with KaTeX, for personal use.
Edit on the host, and the browser reloads on save.

## Usage

- Mount your Markdown directory at `/docs` (read-only is enough) and open port 8080:

  ```bash
  docker run \
    --rm \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    -p 127.0.0.1:8080:8080 \
    -v "${PWD}":/docs:ro \
    naokihori/my-markdown-viewer:latest
  ```

  Then open <http://localhost:8080/>. Publish the port on `127.0.0.1` only. To use another host port, change the left number of `-p`.
- A URL is a path under `/docs`, including `.md` (e.g. `/sub/foo.md`). A directory URL lists its contents.
- Math: `$inline$`, `$$display$$` and ` ```math ` fences.

## Caveats

Developed with a minimalistic philosophy for editing scientific documents.
Out of scope: images, syntax highlighting, and anything else not needed for writing math.

Known limitations:

- `$...$` needs no space inside the dollars and no digit after the closing one. Otherwise it stays text (`$5 and $10`). Use `\$` to force a literal dollar.
- In tables, `|` splits cells even inside math. Use `\vert`.
- Math is rendered with KaTeX here, but GitHub uses MathJax. Stick to syntax that works in both (e.g. no viewer-only macros).
- Raw HTML is not sanitized, but a Content-Security-Policy blocks scripts and external resources (including external images).
- Requests are accepted only with a `localhost` or IP address as the host name.
- Unknown paths show "Not Found" with HTTP status 200.
- Symbolic links in `/docs` are followed.

## Reference

- [naokihori/my-markdown-viewer - Docker Image](https://hub.docker.com/r/naokihori/my-markdown-viewer)
