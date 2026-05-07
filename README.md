# Tripbudgeter

A conversational travel-planning chatbot that quietly keeps your trip
budget up to date in the background. Built for **CPSC 254 Final
Project**.

---

## Run it (4 commands, ~2 minutes)

> Requires Node 20 LTS (or any Node ≥ 18.17). Tested on macOS.

### 1. Clone the repo

```bash
git clone https://github.com/derricknghe/Project-Proposal.git
cd Project-Proposal
```

### 2. Install dependencies

```bash
npm install
```

### 3. Add your OpenAI API key

Create a file called **`.env`** in this folder with exactly one line:

```
OPENAI_API_KEY=sk-your-real-key-here
```

> If you were given a `.env` file, just put it in this folder — that's
> all you need. The app and the eval harness both read `.env`
> automatically. (`.env.local` also works if you prefer.)

### 4. Start the app

```bash
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)** in your browser.
Done.

Try a message like *"I want to go to Tokyo for a week — what should I
do?"* and then *"Hotel is $180 a night for 5 nights"*. The chat is on
the left, the running budget is on the right.

---

## Run the evaluation (1 more command)

```bash
npm run eval
```

This runs the 10 labeled scenarios in `eval/test_cases.json` against
the live OpenAI API and prints something like:

```
accuracy = 10 / 10 = 1.00
```

Cost: about $0.01 in OpenAI usage.

To reproduce the V1/V2/V3 numbers cited in `REPORT.md`:

```bash
PROMPT_VERSION=v1 npm run eval
PROMPT_VERSION=v2 npm run eval
PROMPT_VERSION=v3 npm run eval   # default; same as `npm run eval`
```

---

## What it does

The user chats in the left column ("flying SFO → NRT, the flight is
about $850"). The model returns a single JSON object on every turn
with two fields:

```json
{
  "reply": "Sounds great. Tokyo in spring is gorgeous — want me to suggest some Shinjuku hotels?",
  "updates": [
    { "action": "ADD", "id": "round_trip_flight", "name": "Round Trip Flight", "category": "Flights", "amount": 850 }
  ]
}
```

The frontend shows the `reply` in the chat bubble and feeds the
`updates` into a defensive reducer that adds, updates, or deletes rows
in the budget ledger on the right. There is **no database, no auth,
and no third-party services** — only `OPENAI_API_KEY`. All state
lives in React memory and clears on page refresh by design.

| | |
|---|---|
| **Stack** | Next.js 14 (App Router) · React 18 · TypeScript · Tailwind · OpenAI Node SDK |
| **Model** | `gpt-4o-mini` with `response_format: { type: "json_object" }` |
| **Eval accuracy** | 10 / 10 (V3 production prompt — see `REPORT.md`) |

---

## Project layout

```
app/
  api/chat/route.ts       OpenAI call + safe JSON parsing
  layout.tsx              Root layout
  page.tsx                Two-column page + React state orchestration
  globals.css             Tailwind + small custom styles
components/
  ChatPanel.tsx           Left column: chat UI (loading + error states)
  BudgetSidebar.tsx       Right column: running ledger
lib/
  types.ts                Expense, ChatMessage, AIRawResponse, etc.
  systemPrompt.mjs        Single source of truth for the production prompt
  applyUpdates.mjs        Defensive reducer (web app + eval share this)
  applyUpdates.d.mts      TS declarations for the .mjs reducer
eval/
  test_cases.json         10 hand-written scenarios with expected_total
  run_evals.mjs           Replays cases through the live API + reports accuracy
  prompt_versions/        Verbatim V1/V2/V3 prompts cited in REPORT.md
.env.example              Single line: OPENAI_API_KEY=your_api_key_here
REPORT.md                 Required write-up (4 sections)
```

## All scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run lint` | ESLint via `eslint-config-next` |
| `npm run eval` | Run the 10-case eval against the live API |

## Resilience (why it doesn't crash on bad JSON)

Three layers, all in this repo:

1. **`response_format: { type: "json_object" }`** in
   [`app/api/chat/route.ts`](app/api/chat/route.ts) forces the model
   to return valid JSON.
2. **Server-side parsing** in the same file wraps `JSON.parse` in a
   `try/catch` and falls back to `{ reply, updates: [] }` if the
   payload is malformed.
3. **Defensive reducer** in
   [`lib/applyUpdates.mjs`](lib/applyUpdates.mjs) treats every field
   as untrusted: lowercase actions get normalized, `"$1,200.50"`
   strings get parsed to numbers, unknown categories collapse to
   `"Other"`, and rows missing an `id` or `action` are silently dropped.

## Notes for graders

- `.env.example` contains only the rubric-required placeholder
  `OPENAI_API_KEY=your_api_key_here`.
- The OpenAI key is read server-side only (in
  `app/api/chat/route.ts`) and never shipped to the browser.
- Dependencies are pinned (no `^` or `~`) in `package.json`, and
  `package-lock.json` is committed for fully reproducible installs.

## Troubleshooting

| Problem | Fix |
|---|---|
| `npm: command not found` | Install Node 20 LTS from [nodejs.org](https://nodejs.org/), then re-open your terminal. |
| Port 3000 in use | Next.js will automatically use 3001. Watch the terminal for the actual URL. |
| Red error banner in the chat | Your API key is missing or invalid. Re-check `.env`, then restart `npm run dev`. |
| `Missing OPENAI_API_KEY` from `npm run eval` | Same as above — make sure `.env` exists in the project root with a valid key. |
