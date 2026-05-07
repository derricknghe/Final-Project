#!/usr/bin/env node
// Tripbudgeter — offline evaluation harness.
//
// For each test case in test_cases.json:
//   1. Walk through the canned conversation.
//   2. Each time we see a user message, append it to the running history
//      and POST the history through the OpenAI Chat Completions API using
//      the EXACT same system prompt the web app uses.
//   3. Apply the returned `updates` to an in-memory ledger using the same
//      reducer the web app uses (lib/applyUpdates.mjs).
//   4. After all messages have been processed, sum the ledger and compare
//      it to `expected_total`.
//
// Reports per-case PASS/FAIL and prints a final accuracy line:
//
//   accuracy = N / 10 = 0.NN

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

import { SYSTEM_PROMPT } from "../lib/systemPrompt.mjs";
import { applyUpdates, ledgerTotal } from "../lib/applyUpdates.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// --- Tiny .env.local loader (no external dotenv dependency) ---------------
function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

if (!process.env.OPENAI_API_KEY) {
  console.error(
    "Missing OPENAI_API_KEY. Set it in your shell or in .env.local."
  );
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Helpers --------------------------------------------------------------
async function getUpdatesForHistory(history) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.1,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? '{"updates":[]}';
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.updates)) return parsed.updates;
  } catch {
    /* fall through */
  }
  return [];
}

async function runCase(testCase, index) {
  const label = `[${index + 1}/10] ${testCase.name}`;
  let history = [];
  let ledger = [];

  for (const msg of testCase.input) {
    history = [...history, { role: msg.role, content: msg.content }];
    if (msg.role !== "user") continue;

    let updates;
    try {
      updates = await getUpdatesForHistory(history);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        label,
        ok: false,
        actual: null,
        expected: testCase.expected_total,
        error: `OpenAI request failed: ${message}`,
      };
    }

    const result = applyUpdates(ledger, updates);
    ledger = result.next;
  }

  const actual = ledgerTotal(ledger);
  const ok = actual === testCase.expected_total;
  return { label, ok, actual, expected: testCase.expected_total, ledger };
}

// --- Main -----------------------------------------------------------------
async function main() {
  const casesPath = path.join(__dirname, "test_cases.json");
  const cases = JSON.parse(fs.readFileSync(casesPath, "utf8"));

  if (!Array.isArray(cases) || cases.length !== 10) {
    console.error(
      `Expected exactly 10 test cases, found ${
        Array.isArray(cases) ? cases.length : "non-array"
      }.`
    );
    process.exit(1);
  }

  console.log("Tripbudgeter eval harness");
  console.log("======================");
  console.log(`Model: gpt-4o-mini   Cases: ${cases.length}\n`);

  let passed = 0;
  for (let i = 0; i < cases.length; i++) {
    const r = await runCase(cases[i], i);
    if (r.error) {
      console.log(`FAIL ${r.label}`);
      console.log(`     error:    ${r.error}`);
    } else if (r.ok) {
      passed++;
      console.log(`PASS ${r.label}`);
      console.log(`     expected: ${r.expected}   actual: ${r.actual}`);
    } else {
      console.log(`FAIL ${r.label}`);
      console.log(`     expected: ${r.expected}   actual: ${r.actual}`);
      if (r.ledger) {
        console.log(`     ledger:   ${JSON.stringify(r.ledger)}`);
      }
    }
  }

  const accuracy = passed / cases.length;
  console.log("\n----------------------");
  console.log(
    `accuracy = ${passed} / ${cases.length} = ${accuracy.toFixed(2)}`
  );
}

main().catch((err) => {
  console.error("Eval harness crashed:", err);
  process.exit(1);
});
