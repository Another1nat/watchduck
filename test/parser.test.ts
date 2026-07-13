import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseSession } from "../src/parser.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "fixtures", "minimal.jsonl");

test("parses fixture without crashing on malformed lines", () => {
  const s = parseSession(fixture);
  // 8 well-formed JSON records; the malformed line is silently skipped.
  assert.equal(s.totals.records, 8);
  assert.equal(s.sessionId, "fixture-1");
});

test("counts user records, human prompts, and assistant turns separately", () => {
  const s = parseSession(fixture);
  // All 3 `type:user` records — one wrapper, two real prompts. No tool_result
  // records in the fixture, so userRecords == prompts count here.
  assert.equal(s.totals.userRecords, 3);
  // humanPrompts excludes the wrapper.
  assert.equal(s.totals.humanPrompts, 2);
  assert.equal(s.totals.assistantTurns, 3);
});

test("sums usage tokens across assistant turns", () => {
  const s = parseSession(fixture);
  assert.equal(s.totals.inputTokens, 1000 + 1200 + 1500);
  assert.equal(s.totals.outputTokens, 50 + 80 + 30);
  assert.equal(s.totals.cacheReadTokens, 500);
  assert.equal(s.totals.cacheCreationTokens, 200);
});

test("captures all three prompts and flags wrappers", () => {
  const s = parseSession(fixture);
  assert.equal(s.prompts.length, 3);
  assert.equal(s.prompts[0]!.isWrapper, true);
  assert.equal(s.prompts[1]!.isWrapper, false);
  assert.equal(s.prompts[1]!.text, "add a login route to auth.ts");
  assert.equal(s.prompts[2]!.isWrapper, false);
  assert.equal(s.prompts[2]!.text, "also update middleware.ts");
});

test("extracts file touches with tool and path", () => {
  const s = parseSession(fixture);
  assert.equal(s.fileTouches.length, 3);
  assert.deepEqual(
    s.fileTouches.map((t) => `${t.tool} ${t.filePath}`),
    [
      "Read C:\\repo\\auth.ts",
      "Edit C:\\repo\\auth.ts",
      "Edit C:\\repo\\middleware.ts",
    ],
  );
});

test("first non-wrapper prompt is the goal candidate for `watchduck brief`", () => {
  const s = parseSession(fixture);
  const goal = s.prompts.find((p) => !p.isWrapper);
  assert.equal(goal?.text, "add a login route to auth.ts");
});

test("tool_use content extraction records all invocations", () => {
  const s = parseSession(fixture);
  assert.deepEqual(
    s.toolInvocations.map((t) => t.name),
    ["Read", "Edit", "Edit"],
  );
});
