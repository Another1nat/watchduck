import { readFileSync } from "node:fs";
import {
  measured,
  type ContentBlock,
  type FileTouch,
  type JsonlRecord,
  type ParsedSession,
  type Prompt,
  type ToolInvocation,
  type ToolUseBlock,
} from "./types.ts";

const FILE_TOOLS = new Set(["Read", "Edit", "Write", "MultiEdit", "NotebookEdit"]);

// A user message that begins with these wrappers is not a human prompt.
// The one confirmed in the spike: <local-command-caveat>. Others follow the
// same shape.
const WRAPPER_TAGS = ["<local-command-", "<command-", "<user-prompt-submit-hook>"];

const isToolUse = (b: ContentBlock): b is ToolUseBlock =>
  b !== null && typeof b === "object" && b.type === "tool_use";

const extractPromptText = (raw: unknown): { text: string; isWrapper: boolean } | null => {
  if (typeof raw === "string") {
    const text = raw;
    const isWrapper = WRAPPER_TAGS.some((t) => text.trimStart().startsWith(t));
    return { text, isWrapper };
  }
  if (Array.isArray(raw)) {
    const parts: string[] = [];
    for (const block of raw) {
      if (block && typeof block === "object" && (block as { type?: string }).type === "text") {
        const t = (block as { text?: unknown }).text;
        if (typeof t === "string") parts.push(t);
      }
    }
    if (parts.length === 0) return null;
    const text = parts.join("\n");
    const isWrapper = WRAPPER_TAGS.some((t) => text.trimStart().startsWith(t));
    return { text, isWrapper };
  }
  return null;
};

const safeJsonParse = (line: string): JsonlRecord | null => {
  try {
    const v = JSON.parse(line);
    return v && typeof v === "object" ? (v as JsonlRecord) : null;
  } catch {
    return null;
  }
};

export const parseSession = (path: string): ParsedSession => {
  const raw = readFileSync(path, "utf8");
  const lines = raw.split(/\r?\n/);

  let sessionId: string | null = null;
  let records = 0;
  let userRecords = 0;
  let assistantTurns = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;

  const prompts: Prompt[] = [];
  const fileTouches: FileTouch[] = [];
  const toolInvocations: ToolInvocation[] = [];

  lines.forEach((line, idx) => {
    if (line.length === 0) return;
    const rec = safeJsonParse(line);
    if (!rec) return;
    records++;

    if (!sessionId && typeof rec.sessionId === "string") sessionId = rec.sessionId;

    const ts = typeof rec.timestamp === "string" ? rec.timestamp : null;

    if (rec.type === "user") {
      userRecords++;
      const msg = rec.message;
      if (msg && typeof msg === "object" && "content" in msg) {
        const p = extractPromptText((msg as { content?: unknown }).content);
        if (p) prompts.push({ turnIndex: measured(idx), timestamp: ts, ...p });
      }
      return;
    }

    if (rec.type === "assistant") {
      assistantTurns++;
      const msg = rec.message;
      if (!msg || typeof msg !== "object") return;

      const usage = (msg as { usage?: unknown }).usage;
      if (usage && typeof usage === "object") {
        const u = usage as Record<string, unknown>;
        if (typeof u.input_tokens === "number") inputTokens += u.input_tokens;
        if (typeof u.output_tokens === "number") outputTokens += u.output_tokens;
        if (typeof u.cache_read_input_tokens === "number")
          cacheReadTokens += u.cache_read_input_tokens;
        if (typeof u.cache_creation_input_tokens === "number")
          cacheCreationTokens += u.cache_creation_input_tokens;
      }

      const content = (msg as { content?: unknown }).content;
      if (Array.isArray(content)) {
        for (const block of content as ContentBlock[]) {
          if (!isToolUse(block)) continue;
          toolInvocations.push({
            turnIndex: measured(idx),
            name: block.name,
            timestamp: ts,
          });
          if (FILE_TOOLS.has(block.name)) {
            const fp = block.input?.file_path;
            if (typeof fp === "string" && fp.length > 0) {
              fileTouches.push({
                tool: block.name,
                filePath: fp,
                turnIndex: measured(idx),
                timestamp: ts,
              });
            }
          }
        }
      }
    }
  });

  const humanPrompts = prompts.filter((p) => !p.isWrapper).length;

  return {
    sessionId,
    path,
    totals: {
      records: measured(records),
      userRecords: measured(userRecords),
      humanPrompts: measured(humanPrompts),
      assistantTurns: measured(assistantTurns),
      inputTokens: measured(inputTokens),
      outputTokens: measured(outputTokens),
      cacheReadTokens: measured(cacheReadTokens),
      cacheCreationTokens: measured(cacheCreationTokens),
    },
    prompts,
    fileTouches,
    toolInvocations,
  };
};
