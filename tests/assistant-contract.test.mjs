import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { webcrypto } from "node:crypto";
import ts from "typescript";
import * as sdk from "memoryo-sdk";

const compiled = ts.transpileModule(fs.readFileSync("src/app/api/assistant/route.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const review = {
  id: "review-1", version: "a".repeat(64), kind: "restate_source",
  question: "What should remain current?", target_memory_id: "memory-1",
  current_memory_content: "C++ remains stored.",
  actions: ["keep_current", "restate", "dismiss"], expires_at: "2026-10-09T00:00:00Z",
};

function handler({ userId = "signed-in-user", transport } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const call = { url: String(url), body: init?.body ? JSON.parse(init.body) : null };
    calls.push(call);
    if (!transport) throw new Error("Unexpected network call");
    return transport(call);
  };
  class PublishedSDK extends sdk.MemoryOS {
    constructor(apiKey) { super(apiKey, sdk.MemoryOS.DEFAULT_BASE_URL, 1000, fetchImpl); }
  }
  const loaded = { exports: {} };
  const sandbox = {
    module: loaded, exports: loaded.exports,
    require(name) {
      if (name === "@clerk/nextjs/server") return { auth: async () => ({ userId }) };
      if (name === "next/server") return { NextResponse: { json: (body, init) => Response.json(body, init) } };
      if (name === "memoryo-sdk") return { ...sdk, MemoryOS: PublishedSDK };
      throw new Error(`Unexpected import: ${name}`);
    },
    process: { env: { MEMORYOS_API_KEY: "mem_test", OPENAI_API_KEY: "test-no-network" } },
    fetch: fetchImpl, Response, ReadableStream, TextEncoder, TextDecoder,
    AbortSignal, crypto: webcrypto,
    console: { error() {} },
  };
  vm.runInNewContext(compiled, sandbox);
  return {
    calls,
    post(body) {
      return loaded.exports.POST(new Request("http://localhost/api/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }));
    },
  };
}

for (const action of ["keep_current", "dismiss", "restate"]) {
  test(`review ${action} relays to the published SDK without a model or memory write`, async () => {
    const h = handler({ transport(call) {
      assert.equal(new URL(call.url).pathname, "/v1/memories/source-reviews/review-1/answer");
      return Response.json({ data: {
        review_id: "review-1", action, resolved: action !== "restate",
        next_step: action === "restate" ? "add_memory" : null,
      } });
    } });
    const response = await h.post({ action: "answer_source_review", reviewId: review.id,
      version: review.version, reviewAction: action, externalUserId: "forged-owner" });
    assert.equal(response.status, 200);
    const resolution = (await response.json()).sourceReviewResolution;
    assert.equal(resolution.resolved, action !== "restate");
    assert.equal(resolution.nextStep, action === "restate" ? "add_memory" : null);
    assert.equal(h.calls.length, 1);
    assert.deepEqual(h.calls[0].body, {
      external_user_id: "assistant:signed-in-user", version: review.version, action,
    });
  });
}

test("signed-out users cannot access review answers", async () => {
  const h = handler({ userId: null });
  assert.equal((await h.post({ action: "answer_source_review" })).status, 401);
  assert.equal(h.calls.length, 0);
});

for (const invalid of [null, [], { action: "invent_authority", message: "hello" },
  { action: "answer_source_review", reviewId: "review-1", version: "invalid", reviewAction: "restate" },
  { action: "answer_source_review", reviewId: "review-1", version: review.version, reviewAction: "promote" }]) {
  test(`invalid action/body is rejected before SDK calls: ${JSON.stringify(invalid)}`, async () => {
    const h = handler();
    assert.equal((await h.post(invalid)).status, 400);
    assert.equal(h.calls.length, 0);
  });
}

for (const status of [403, 404, 409]) {
  test(`review backend ${status} is preserved without leaking internal details`, async () => {
    const h = handler({ transport: () => Response.json({ error: "private-backend-detail", code: "REV_TEST" }, { status }) });
    const response = await h.post({ action: "answer_source_review", reviewId: review.id,
      version: review.version, reviewAction: "keep_current" });
    assert.equal(response.status, status);
    assert.doesNotMatch(await response.text(), /private-backend-detail|mem_test/);
    assert.equal(h.calls.length, 1);
  });
}

test("existing clarification answers use the published SDK and server identity", async () => {
  const h = handler({ transport(call) {
    assert.equal(new URL(call.url).pathname, "/v1/memories/clarifications/check-1/answer");
    return Response.json({ data: { resolved: true, clarification_id: "check-1", conflict_id: "conflict-1", resolution: "B" } });
  } });
  const response = await h.post({ action: "answer_clarification", clarificationId: "check-1", answer: "B", externalUserId: "forged" });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).clarificationResolution.resolved, true);
  assert.equal(h.calls[0].body.external_user_id, "assistant:signed-in-user");
});

test("stream delivers typed reviews before tokens and without waiting for extraction", async () => {
  let releaseWrite;
  const writeGate = new Promise((resolve) => { releaseWrite = resolve; });
  let enteredWrite;
  const writing = new Promise((resolve) => { enteredWrite = resolve; });
  const h = handler({ async transport(call) {
    const path = new URL(call.url).pathname;
    if (path === "/v1/memories/retrieve") {
      assert.equal(call.body.external_user_id, "assistant:signed-in-user");
      return Response.json({ data: [], source_reviews: [review], cached: false, system_prompt_addition: "",
        clarification: { id: "check-1", conflict_id: "conflict-1", question: "Which explanation style?",
          options: [{ answer: "A", label: "Concise", memory_id: "style-1" }, { answer: "B", label: "Detailed", memory_id: "style-2" }], expires_at: null },
      });
    }
    if (call.url === "https://api.openai.com/v1/chat/completions") {
      assert.equal(call.body.stream, true);
      assert.equal(call.body.model, "gpt-4.1-mini");
      assert.ok(!call.body.messages[0].content.includes(review.question));
      return new Response('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n');
    }
    if (path === "/v1/memories/add") {
      assert.equal(call.body.external_user_id, "assistant:signed-in-user");
      assert.deepEqual(call.body.messages.map(({ role, content }) => ({ role, content })), [
        { role: "user", content: "Tell me about my work" }, { role: "assistant", content: "Hello" },
      ]);
      enteredWrite();
      await writeGate;
      return Response.json({ status: "queued", job_id: "job-1" });
    }
    throw new Error(`Unexpected endpoint: ${path}`);
  } });
  const response = await h.post({ message: "Tell me about my work", history: [] });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const first = JSON.parse(new TextDecoder().decode((await reader.read()).value).trim());
  assert.equal(first.type, "context");
  assert.equal(first.sourceReviews[0].version, review.version);
  assert.equal(first.sourceReviews[0].currentMemoryContent, review.current_memory_content);
  assert.equal(first.clarification.conflictId, "conflict-1");
  assert.equal(first.clarification.options[1].memoryId, "style-2");
  await writing;
  releaseWrite();
  let remaining = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    remaining += new TextDecoder().decode(value);
  }
  const events = remaining.trim().split("\n").map((line) => JSON.parse(line));
  assert.ok(events.some((e) => e.type === "delta" && e.delta === "Hello"));
  assert.equal(events.at(-1).type, "complete");
  assert.equal(events.at(-1).write.status, "queued");
  assert.ok(!h.calls.some((c) => new URL(c.url).pathname.includes("/jobs/")));
});
