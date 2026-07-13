// The honesty rule, in the type system.
//
// A `Measured<T>` value came from the JSONL — counted, summed, or read directly.
// A `Derived<T>` value was computed under an assumption (heuristic, estimate,
// ratio). Derived numbers are rendered with a leading `≈`. The two cannot be
// mixed without going through `measured()` or `derived()` — the compiler enforces
// what the README promises.

declare const MeasuredBrand: unique symbol;
declare const DerivedBrand: unique symbol;

export type Measured<T> = T & { readonly [MeasuredBrand]: true };
export type Derived<T> = T & { readonly [DerivedBrand]: true };

export const measured = <T>(v: T): Measured<T> => v as Measured<T>;
export const derived = <T>(v: T): Derived<T> => v as Derived<T>;

// ---- JSONL record shapes (verified against a real session, 2026-07-13) ----
//
// Observed record `type` values in one session of 729 records:
//   user, assistant, attachment, system, permission-mode,
//   file-history-snapshot, last-prompt, queue-operation
//
// Only `user` and `assistant` carry the payloads watchduck cares about.

export type UsageBlock = {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  service_tier?: string;
};

export type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type TextBlock = {
  type: "text";
  text: string;
};

export type ContentBlock = ToolUseBlock | TextBlock | { type: string; [k: string]: unknown };

export type AssistantMessage = {
  role?: "assistant";
  content?: ContentBlock[];
  usage?: UsageBlock;
};

export type UserMessage = {
  role?: "user";
  content?: string | ContentBlock[];
};

export type JsonlRecord = {
  type: string;
  timestamp?: string;
  sessionId?: string;
  message?: AssistantMessage | UserMessage;
  // permissive: unknown fields on the record itself
  [k: string]: unknown;
};

// ---- Parsed session (what the rest of watchduck consumes) ----

export type FileTouch = {
  tool: "Read" | "Edit" | "Write" | "MultiEdit" | string;
  filePath: string;
  turnIndex: Measured<number>;
  timestamp: string | null;
};

export type Prompt = {
  turnIndex: Measured<number>;
  timestamp: string | null;
  text: string;
  isWrapper: boolean; // <local-command-*/> or slash-command echoes — not a human prompt
};

export type ToolInvocation = {
  turnIndex: Measured<number>;
  name: string;
  timestamp: string | null;
};

export type ParsedSession = {
  sessionId: string | null;
  path: string;
  totals: {
    records: Measured<number>;
    // In Claude Code JSONL, `type: "user"` records include tool_result responses.
    // `userRecords` = raw count on disk; `humanPrompts` = non-wrapper prompts
    // with actual text content. Both measured; different populations.
    userRecords: Measured<number>;
    humanPrompts: Measured<number>;
    assistantTurns: Measured<number>;
    inputTokens: Measured<number>;
    outputTokens: Measured<number>;
    cacheReadTokens: Measured<number>;
    cacheCreationTokens: Measured<number>;
  };
  prompts: Prompt[];
  fileTouches: FileTouch[];
  toolInvocations: ToolInvocation[];
};
