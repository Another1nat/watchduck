import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseSession } from "../src/parser.ts";
import { attributeTouches, buildBrief } from "../src/brief.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, "fixtures", "minimal.jsonl");

test("attributeTouches groups touches under their preceding prompt", () => {
  const s = parseSession(fixture);
  const attributed = attributeTouches(s.prompts, s.fileTouches);

  // Fixture layout:
  //   prompt[0] = wrapper (no touches follow before prompt[1])
  //   prompt[1] = "add a login route to auth.ts" → Read + Edit on auth.ts
  //   prompt[2] = "also update middleware.ts"    → Edit on middleware.ts
  assert.equal(attributed.length, 3);
  assert.equal(attributed[0]!.touches.length, 0);
  assert.equal(attributed[1]!.touches.length, 2);
  assert.equal(attributed[2]!.touches.length, 1);
  assert.equal(attributed[1]!.touches[0]!.filePath, "C:\\repo\\auth.ts");
  assert.equal(attributed[2]!.touches[0]!.filePath, "C:\\repo\\middleware.ts");
});

test("buildBrief includes goal, prompts, files, and honesty footer", () => {
  const s = parseSession(fixture);
  const md = buildBrief(s);

  assert.match(md, /# Brief:/);
  assert.match(md, /## Goal/);
  assert.match(md, /add a login route to auth\.ts/);
  assert.match(md, /## Prompts and what followed/);
  assert.match(md, /## Top touched files/);
  assert.match(md, /Watchduck shows, doesn't judge/);
});

test("buildBrief marks the wrapper prompt as [wrapper], not [human]", () => {
  const s = parseSession(fixture);
  const md = buildBrief(s);
  assert.match(md, /\[wrapper\]/);
  assert.match(md, /\[human\]/);
});

test("buildBrief falls back gracefully when no substantive prompt exists", () => {
  const empty = {
    sessionId: "empty",
    path: "n/a",
    totals: {
      records: 0 as never,
      userRecords: 0 as never,
      humanPrompts: 0 as never,
      assistantTurns: 0 as never,
      inputTokens: 0 as never,
      outputTokens: 0 as never,
      cacheReadTokens: 0 as never,
      cacheCreationTokens: 0 as never,
    },
    prompts: [],
    fileTouches: [],
    toolInvocations: [],
  };
  const md = buildBrief(empty);
  assert.match(md, /No substantive prompt found/);
});
