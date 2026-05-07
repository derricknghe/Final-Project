// Defensive reducer shared by the Next.js client and the eval harness.
// Treats every field of every update as untrusted and rejects anything
// that doesn't conform — the UI must never crash on hallucinated JSON.

const VALID_ACTIONS = new Set(["ADD", "UPDATE", "DELETE"]);
const VALID_CATEGORIES = ["Flights", "Lodging", "Dining", "Activities", "Other"];

function coerceAction(raw) {
  if (typeof raw !== "string") return null;
  const upper = raw.trim().toUpperCase();
  return VALID_ACTIONS.has(upper) ? upper : null;
}

function coerceCategory(raw) {
  if (typeof raw !== "string") return "Other";
  const lower = raw.trim().toLowerCase();
  const match = VALID_CATEGORIES.find((c) => c.toLowerCase() === lower);
  return match ?? "Other";
}

function coerceAmount(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    // Tolerate "$1,200.50" and friends.
    const cleaned = raw.replace(/[$,\s]/g, "");
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function coerceString(raw, fallback = "") {
  if (typeof raw === "string") return raw.trim();
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  return fallback;
}

/**
 * @param {Array<{id:string,name:string,category:string,amount:number}>} current
 * @param {unknown} updates
 * @returns {{ next: Array<{id:string,name:string,category:string,amount:number}>, changed: number, summary: string }}
 */
export function applyUpdates(current, updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    return { next: current, changed: 0, summary: "" };
  }

  let next = current;
  let changed = 0;
  const summaries = [];

  for (const raw of updates) {
    if (!raw || typeof raw !== "object") continue;

    const action = coerceAction(raw.action);
    const id = coerceString(raw.id);
    if (!action || !id) continue;

    if (action === "DELETE") {
      const existing = next.find((e) => e.id === id);
      if (existing) {
        next = next.filter((e) => e.id !== id);
        changed++;
        summaries.push(`removed ${existing.name}`);
      }
      continue;
    }

    const name = coerceString(raw.name) || id;
    const category = coerceCategory(raw.category);
    const amount = coerceAmount(raw.amount);

    const expense = { id, name, category, amount };
    const exists = next.some((e) => e.id === id);

    if (exists) {
      next = next.map((e) => (e.id === id ? expense : e));
      changed++;
      summaries.push(
        action === "UPDATE"
          ? `updated ${name} to $${amount}`
          : `added ${name} ($${amount})`
      );
    } else {
      next = [...next, expense];
      changed++;
      summaries.push(`added ${name} ($${amount})`);
    }
  }

  return { next, changed, summary: summaries.join(", ") };
}

export function ledgerTotal(items) {
  return items.reduce(
    (sum, e) => sum + (Number.isFinite(e.amount) ? e.amount : 0),
    0
  );
}
