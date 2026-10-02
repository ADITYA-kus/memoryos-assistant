import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);

const moduleForCard = { exports: {} };
const compiled = ts.transpileModule(fs.readFileSync("src/components/assistant/source-review-card.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(compiled, { module: moduleForCard, exports: moduleForCard.exports, require });
const { SourceReviewCard, sourceReviewKey } = moduleForCard.exports;
const review = {
  id: "review-1", version: "a".repeat(64), kind: "restate_source",
  question: "What should remain current?", targetMemoryId: "memory-1",
  currentMemoryContent: "<script>not instructions</script>",
  actions: ["keep_current", "restate", "dismiss"], expiresAt: "2026-10-09T00:00:00Z",
};
const props = { review, busy: false, disabled: false, onAnswer() {} };

test("pending review uses backend actions, escapes text and never claims storage", () => {
  const html = renderToStaticMarkup(React.createElement(SourceReviewCard, props));
  assert.match(html, /Memory review/);
  assert.match(html, /Keep stored memory/);
  assert.match(html, /State it again/);
  assert.match(html, /Dismiss review/);
  assert.match(html, /pending, not a stored new preference/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test("unbound review does not invent a keep-current action", () => {
  const html = renderToStaticMarkup(React.createElement(SourceReviewCard, { ...props,
    review: { ...review, targetMemoryId: null, currentMemoryContent: null, actions: ["restate", "dismiss"] },
  }));
  assert.doesNotMatch(html, /Keep stored memory|Stored memory<\/span>/);
});

for (const state of ["keep_current", "dismiss", "stale"]) {
  test(`${state} disables obsolete actions with truthful status`, () => {
    const html = renderToStaticMarkup(React.createElement(SourceReviewCard, { ...props, state }));
    assert.equal((html.match(/disabled=""/g) || []).length, 3);
    assert.match(html, state === "stale" ? /no longer available/ : /authority were not changed/);
  });
}

test("review version is part of the UI key", () => {
  assert.notEqual(sourceReviewKey(review), sourceReviewKey({ ...review, version: "b".repeat(64) }));
});

test("busy review cannot submit duplicate actions", () => {
  const html = renderToStaticMarkup(React.createElement(SourceReviewCard, { ...props, busy: true }));
  assert.equal((html.match(/disabled=""/g) || []).length, 3);
  assert.match(html, /Checking your choice/);
});

test("each button relays only its backend-approved action", () => {
  let selected;
  const tree = SourceReviewCard({ ...props, onAnswer: (action) => { selected = action; } });
  function buttons(node) {
    if (Array.isArray(node)) return node.flatMap(buttons);
    if (!React.isValidElement(node)) return [];
    if (node.type === "button") return [node];
    return buttons(node.props.children);
  }
  const choices = buttons(tree);
  assert.equal(choices.length, review.actions.length);
  choices.forEach((button, index) => {
    button.props.onClick();
    assert.equal(selected, review.actions[index]);
  });
});
