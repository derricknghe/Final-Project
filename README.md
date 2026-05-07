# Tripbudgeter

**A conversational travel-planning chatbot that quietly keeps your trip
budget up to date in the background.**

Talk to the assistant like a real travel concierge — ask for destinations,
ideas, packing tips, restaurant suggestions — and any time you mention a
price, daily rate, or duration change, the running ledger on the right
updates itself automatically. The model is doing both jobs in a single
strict-JSON response on every turn.

| | |
|---|---|
| **Course** | CPSC 254 — Final Project |
| **Stack** | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · OpenAI Node SDK |
| **Model** | `gpt-4o-mini` with `response_format: { type: "json_object" }` |
| **External services** | None. No DB, no auth, no vector store. Only `OPENAI_API_KEY`. |

---

## Quick start (for graders)

> Tested on Node 18+ on macOS, Linux, and Windows PowerShell. Total time
> from clone to running app is about 2 minutes.

### 1. Clone and install

```bash
git clone https://github.com/derricknghe/Project-Proposal.git
cd Project-Proposal
npm install
```

### 2. Add your OpenAI API key

```bash
# macOS / Linux
cp .env.example .env.local

# Windows PowerShell
Copy-Item .env.example .env.local
```

Open `.env.local` and replace the placeholder with your key:

```
OPENAI_API_KEY=sk-...your-real-key...
```

### 3. Run the web app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and try messages like:

- *"I want to go to Tokyo for a week in April — what should I do?"*
- *"Hotel is $180 a night for 5 nights."*
- *"Budget about $60 a day for food."*
- *"Actually make the hotel 7 nights instead."*
- *"I'm not flying anymore, cancel that."*

The left side is a real chat. The right side is the running budget that
adds, updates, and deletes line items as the conversation evolves.

### 4. Run the evaluation harness

```bash
npm run eval
```

This replays the 10 labeled scenarios in `eval/test_cases.json` through
the same OpenAI prompt the web app uses, applies the model's `updates` to
an in-memory ledger using the **same reducer the UI uses**
(`lib/applyUpdates.mjs`), and compares each final total against the
labeled `expected_total`. The script prints per-case PASS/FAIL and a final
line of the form:

```
accuracy = 9 / 10 = 0.90
```

Total cost: about 10 `gpt-4o-mini` calls (under $0.01 in OpenAI usage).

---

## What the AI is actually doing

On every turn the model returns a single JSON object with two fields —
the conversational `reply` shown to the user, and a list of `updates`
that mutate the ledger:

```json
{
  "reply": "Tokyo in April is gorgeous — cherry blossoms peak around the first week. For a 7-day trip I'd plan 4 nights in Shinjuku and 3 in Asakusa. Want a rough budget for that?",
  "updates": [
    { "action": "ADD", "id": "hotel", "name": "Hotel", "category": "Lodging", "amount": 900 }
  ]
}
```

The system prompt that defines the schema and the assistant's persona
lives in [`lib/systemPrompt.mjs`](lib/systemPrompt.mjs) — it is the
single source of truth shared by both the API route and the eval harness,
so what you measure offline is exactly what the user sees online.

## Project layout

```
app/
  api/chat/route.ts     # OpenAI call + safe JSON parsing
  layout.tsx            # Root layout
  page.tsx              # Two-column page + React state orchestration
  globals.css           # Tailwind + small custom styles
components/
  ChatPanel.tsx         # Left column: chat UI (loading + error states)
  BudgetSidebar.tsx     # Right column: running ledger
lib/
  types.ts              # Expense, ChatMessage, AIRawResponse, etc.
  systemPrompt.mjs      # Single source of truth for the OpenAI prompt
  applyUpdates.mjs      # Defensive reducer (web app + eval share this)
  applyUpdates.d.mts    # TS declarations for the .mjs reducer
eval/
  test_cases.json       # 10 hand-written scenarios with expected_total
  run_evals.mjs         # Replays cases through the live API + reports accuracy
.env.example            # Single line: OPENAI_API_KEY=your_api_key_here
REPORT.md               # Required write-up (4 sections, ~1000 words)
```

## How resilience is enforced

The model can hallucinate. Three layers guard against it so the UI never
crashes on bad JSON:

1. **`response_format: { type: "json_object" }`** in
   [`app/api/chat/route.ts`](app/api/chat/route.ts) forces the model to
   emit valid JSON.
2. **Server-side parsing** in the same file wraps `JSON.parse` in a
   `try/catch` and falls back to `{ reply, updates: [] }` if the payload
   is malformed or missing fields.
3. **Defensive reducer** in
   [`lib/applyUpdates.mjs`](lib/applyUpdates.mjs) treats every field as
   untrusted: lowercase actions get normalized, `"$1,200.50"` strings get
   parsed to numbers, unknown categories collapse to `"Other"`, and rows
   missing an `id` or `action` are silently dropped.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server on port 3000. |
| `npm run build` | Production build (used by `npm start`). |
| `npm start` | Run the production build. |
| `npm run lint` | Lint with `eslint-config-next`. |
| `npm run eval` | Run the 10-case evaluation harness against the live API. |

## Notes for graders

- The `.env.example` file contains only the placeholder `OPENAI_API_KEY=your_api_key_here` per the rubric.
- All state lives in React. There is no database, no auth, no third-party
  service. Refreshing the page intentionally clears the budget.
- The OpenAI key is only ever read server-side from
  `app/api/chat/route.ts` and never shipped to the browser.
- Dependencies are pinned (no `^` or `~`) in `package.json`, and
  `package-lock.json` is committed for fully reproducible installs.
