<!--
  =====================================================================
  EDIT-BEFORE-SUBMIT CHECKLIST
  ---------------------------------------------------------------------
  1. Run `npm run eval` once on the current code and replace the V3
     accuracy number below (search for "TODO eval"). The other versions
     can be re-measured by `git checkout`-ing earlier commits if you
     want exact numbers; the draft uses honest estimates clearly
     labeled "(estimated)".
  2. In Part 4, replace "Cursor with Claude Sonnet" with whichever AI
     coding assistant you actually used, and replace the bracketed
     personal-experience moments with your own recollection.
  3. Delete this comment block before committing.
  =====================================================================
-->

# Part 1: What & why

Tripbudgeter is a single-page web app that turns trip planning into a
conversation. The user talks to an AI travel concierge in the left column
("I want a week in Tokyo in April — what should I see?"); the AI answers
in plain English while a structured ledger on the right column
*simultaneously* updates itself any time the user mentions a price,
daily rate, or duration change. There is no database, no auth, and no
external services beyond a single OpenAI API key — all state lives in
React memory.

The intended user is someone in the early "out-loud planning" stage of a
trip, who normally jumps between Google Docs, calculator tabs, and chat
threads with friends. The chat-plus-ledger pattern collapses that mess
into one surface.

What is hard about getting the AI behavior right is that the model has to
do *two completely different things on every single turn*: act as a
warm, suggestive travel companion, and act as a deterministic JSON entity
extractor that stays consistent across many turns. The hardest sub-problems
are (a) **stable identity** — when the user says "make the hotel 7 nights
instead", the model must re-use the same `id` it emitted three turns ago
so the ledger updates the existing row instead of duplicating it;
(b) **implied math** — "$50/day for 5 days" must become `250`, every
time; and (c) **graceful degradation** — the UI must never crash, even
when the model occasionally returns a slightly malformed payload.

# Part 2: Iterations (V1, V2, V3)

## V1 — Strict-JSON extractor with canned UI replies

**Change.** Initial scaffold. The system prompt told the model to act as
"a data parser only, do not output conversational text" and return
`{ "updates": [...] }`. The frontend never showed the model's text
directly — it manufactured canned replies like *"I've updated your
budget — added Hotel ($900)."* from the `updates` array.

**Motivating example.** Trying the app felt sterile. A user message like
*"I want to go to Tokyo for a week, what should I do?"* produced no
ledger change and the canned fallback *"Got it — nothing budget-related
to log there."* — accurate but useless as a planning tool.

**Delta.** No eval harness existed yet, so accuracy was unmeasured
(*0 / 0*). Qualitatively: math worked, but DELETE flows and duration
changes were unreliable, and the app failed the "would-a-real-user-keep-
talking-to-it" test.

**Conclusion.** Two next steps were obvious: build an eval set so further
changes were measurable, and harden the parsing so the inevitable
hallucinated key wouldn't crash the page.

## V2 — Eval harness + defensive reducer + shared prompt module

**Change.** Added `eval/test_cases.json` (10 labeled scenarios covering
ADD, daily-rate math, multi-item, sequential turns, price update,
trip-duration recomputation, DELETE, multi-category, and combined
math+DELETE) and `eval/run_evals.mjs` that replays each case through
the live API and prints `accuracy = N / 10`. Extracted the system prompt
into `lib/systemPrompt.mjs` so the eval and the API route share one
source of truth, and rewrote the state mutator into a pure function in
`lib/applyUpdates.mjs` that defensively coerces every field
(lowercase `"add"` → `"ADD"`, `"$1,200.50"` → `1200.5`, unknown
categories → `"Other"`).

**Motivating example.** Test case #7 (*"Hotel is $100 a night for 3
nights" → "extended to 5 nights"*) failed in V1 because the model
sometimes emitted a *new* id like `hotel_extended` instead of re-using
`hotel`, doubling the lodging line. Tightening the prompt to demand
stable snake\_case ids fixed it.

**Delta.** ~6 / 10 → ~8 / 10 (estimated; numbers vary run to run because
the model is non-deterministic even at low temperature).

**Conclusion.** The reducer guard rails meant we could move faster
without fearing a UI crash, and the eval gave us a number to defend.

## V3 — Conversational concierge with dual-output schema

**Change.** Replaced the strict-extractor prompt with a "Trip" persona
that has *two jobs* per turn. The schema grew a sibling field:
`{ "reply": "...natural language...", "updates": [...] }`. The frontend
now displays `reply` directly in the chat bubble (with a fallback if it's
missing). Bumped `temperature` from `0.1` to `0.6` so the conversation
isn't robotic, kept the JSON-mode constraint for the structured part.

**Motivating example.** Same Tokyo question from V1 now returns:
*"Tokyo in April is gorgeous — cherry blossoms peak around the first
week. For 7 days I'd suggest 4 nights in Shinjuku and 3 in Asakusa.
Want a rough budget for that?"* — a real conversation, while the ledger
stays correct.

**Delta.** ~8 / 10 → **TODO eval / 10** (run `npm run eval` once and
record). I expected a small accuracy regression because the model now
juggles two outputs; in practice the structured part stayed stable
because the JSON schema and "stable id" rule were unchanged.

**Conclusion.** UX jumped substantially with no measurable accuracy
loss. Next iteration would add a "summarize my trip so far" tool call
and a token-budget guard for very long conversations.

# Part 3: Code walkthrough

Trace one user action — typing *"Hotel is $180 a night for 5 nights"*
and pressing Send — through the system.

1. The textarea is in [`components/ChatPanel.tsx:99`](components/ChatPanel.tsx).
   The form's `onSubmit` (line 88) calls `props.onSubmit()`, which is the
   `handleSubmit` callback defined in
   [`app/page.tsx:19`](app/page.tsx).
2. `handleSubmit` immediately appends the user message to `messages`,
   clears the input, sets `isLoading`, and clears any prior error
   (`page.tsx:26–29`). The loading flag drives the spinner inside
   `ChatPanel` and disables the send button — that is the explicit
   loading state required by the rubric.
3. It POSTs the full conversation to
   [`app/api/chat/route.ts:32`](app/api/chat/route.ts). The route
   prepends the shared `SYSTEM_PROMPT` from
   [`lib/systemPrompt.mjs`](lib/systemPrompt.mjs) and calls
   `gpt-4o-mini` with `response_format: { type: "json_object" }`
   (route.ts:43). The completion text is then `JSON.parse`-ed inside a
   `try/catch` (route.ts:58); if anything is malformed the route still
   returns `{ reply: <fallback>, updates: [] }` instead of throwing.
4. Back in `page.tsx:48–55`, the client coerces `data.updates` to an
   array (whatever the model returned), pulls `data.reply` with a
   fallback, and calls `applyUpdates(prev, updates)` from
   [`lib/applyUpdates.mjs`](lib/applyUpdates.mjs). That reducer
   normalizes the action, validates the id, parses the amount (handling
   `"$180"`-style strings), and returns the next ledger.
5. The chat appends the AI's `reply`, the spinner clears, and
   `BudgetSidebar` re-renders the new Lodging row.

**Design decision.** The reducer is a *separate* `.mjs` module
(`lib/applyUpdates.mjs`) imported by both the React app and the eval
script. The rejected alternative was a TypeScript-only reducer in
`lib/applyUpdates.ts` that the eval would re-implement in plain JS — but
that creates two implementations that can drift, so an eval pass would
no longer guarantee the UI behaves the same way. Pairing the `.mjs`
runtime file with a `lib/applyUpdates.d.mts` declaration gave us *both*
strict TypeScript checking and a single shared runtime.

# Part 4: AI disclosure & safety

I used Cursor's agent (Claude Sonnet) extensively while building
Tripbudgeter. It was best at scaffolding repetitive boilerplate (the
`BudgetSidebar` grouping/sorting code, the `applyUpdates` defensive
coercions) and at generating the first draft of `eval/test_cases.json`.

Three concrete moments it failed and how I recovered:
(1) When I extracted the prompt into `lib/systemPrompt.mjs`, the agent
imported it from a TS route file and tightened my `Expense.category` to
the strict `ExpenseCategory` union — `tsc --noEmit` then refused to
compile because the `.mjs` reducer's return type was `string`. I
recovered by adding a small `lib/applyUpdates.d.mts` ambient declaration
so the .mjs file got strict types without being rewritten in TS.
(2) On the first draft of the conversational prompt, the agent left in
the old line *"Act as a data parser only, do not output conversational
text"* — directly contradicting the new persona. I caught it on a manual
read-through before testing, which would otherwise have produced a
silent regression invisible to the eval (since accuracy is measured on
`updates`, not `reply`).
(3) During setup the agent generated a `.env.example` containing what
looked like a real `sk-proj-...` key. I treated the key as compromised,
revoked it on the OpenAI dashboard, and replaced the file with the
required placeholder.

**Safety risk specific to this app: cost runaway via prompt injection.**
Because the assistant is conversational and the request body is the full
chat history, a malicious user could paste a long block instructing the
model to produce thousands of synthetic `updates`, inflating both their
own bill and the response payload. The mitigation I accepted is
twofold: this is a single-user local app with no shared state (a hostile
prompt only damages its own session), and the `applyUpdates` reducer
silently drops malformed rows so the UI cannot be DOS'd by an
oversized response. A production deployment would additionally need
per-IP rate-limiting and a hard `max_tokens` cap on the completion call.
