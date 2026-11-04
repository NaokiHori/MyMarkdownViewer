import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "./markdown.ts";

const inline = (html: string) => (html.match(/class="katex"/g) ?? []).length;
const display = (html: string) => (html.match(/katex-display/g) ?? []).length;

void test("inline math: $...$", () => {
  const html = render("a $\\alpha_1 + \\beta_2$ b");
  assert.equal(inline(html), 1);
  assert.equal(display(html), 0);
});

void test("display math: $$...$$ block, mid-paragraph, and ```math", () => {
  for (const src of ["$$\nx^2\n$$\n", "text $$x$$ text", "```math\nx\n```"]) {
    assert.equal(display(render(src)), 1, src);
  }
});

void test("dollar amounts stay text", () => {
  const html = render("cost $5 and $10 total");
  assert.equal(inline(html), 0);
  assert.match(html, /\$5 and \$10/);
});

void test("escaped dollar stays text", () => {
  const html = render("\\$x\\$");
  assert.equal(inline(html), 0);
  assert.match(html, /\$x\$/);
});

void test("dollars in code are untouched", () => {
  for (const src of ["`$a$`", "```latex\n$a$ and $$b$$\n```"]) {
    const html = render(src);
    assert.equal(inline(html), 0, src);
    assert.match(html, /<code/, src);
  }
});

void test("math next to code and emphasis", () => {
  const html = render("$a$ then `$b$` then *em* then $c$");
  assert.equal(inline(html), 2);
  assert.match(html, /<code>\$b\$<\/code>/);
  assert.match(html, /<em>em<\/em>/);
});

void test("invalid TeX does not throw", () => {
  const html = render("$\\frac{$");
  assert.match(html, /math-error/);
});

void test("HTML in error messages is escaped", () => {
  const html = render("$\\<script>$");
  assert.doesNotMatch(html, /<script>/);
});
