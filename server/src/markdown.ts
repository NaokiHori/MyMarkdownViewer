import { marked } from "marked";
import katex from "katex";

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : "unknown");

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMath(tex: string, displayMode: boolean): string {
  try {
    const html = katex.renderToString(tex.trim(), { displayMode });
    return displayMode ? `<div class="math-block">${html}</div>` : html;
  } catch (e) {
    return `<pre class="math-error">[Math Error: ${escapeHtml(errorMessage(e))}]</pre>`;
  }
}

// Math is handled as marked extensions, so marked itself decides what is code
// (code spans / fences) or escaped (\$), and `$` inside those is left alone.
marked.use({
  extensions: [
    {
      // $$ ... $$ at the beginning of a line
      name: "mathBlock",
      level: "block",
      start: (src: string) => src.search(/^\$\$/m),
      tokenizer(src: string) {
        const m = /^\$\$([\s\S]+?)\$\$[ \t]*(?:\n|$)/.exec(src);
        return m ? { type: "mathBlock", raw: m[0], text: m[1] } : undefined;
      },
      renderer: (token) => renderMath(token.text, true),
    },
    {
      // $$ ... $$ (display) or $ ... $ (inline) inside a paragraph
      name: "mathInline",
      level: "inline",
      start: (src: string) => src.indexOf("$"),
      tokenizer(src: string) {
        const display = /^\$\$([\s\S]+?)\$\$/.exec(src);
        if (display)
          return { type: "mathInline", raw: display[0], text: display[1], display: true };
        // no space just inside the dollars, no digit right after: "$5 and $10" stays text
        const inline = /^\$(?!\s)([^$\n]*?[^\s$])\$(?!\d)/.exec(src);
        if (inline) return { type: "mathInline", raw: inline[0], text: inline[1], display: false };
        return undefined;
      },
      renderer: (token) => renderMath(token.text, token.display === true),
    },
  ],
  renderer: {
    // ```math fences are display math
    code: (token) => (token.lang === "math" ? renderMath(token.text, true) : false),
  },
});

export function render(markdown: string): string {
  return marked.parse(markdown, { async: false });
}
