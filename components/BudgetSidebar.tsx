"use client";

import { useMemo } from "react";
import type { Expense } from "@/lib/types";

interface BudgetSidebarProps {
  expenses: Expense[];
}

const CATEGORY_ORDER = [
  "Flights",
  "Lodging",
  "Dining",
  "Activities",
  "Other",
] as const;

const CATEGORY_ACCENT: Record<string, string> = {
  Flights: "bg-sky-100 text-sky-800",
  Lodging: "bg-violet-100 text-violet-800",
  Dining: "bg-amber-100 text-amber-800",
  Activities: "bg-emerald-100 text-emerald-800",
  Other: "bg-slate-100 text-slate-800",
};

const currency = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);

export function BudgetSidebar({ expenses }: BudgetSidebarProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of expenses) {
      const key = e.category || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [expenses]);

  const total = useMemo(
    () => expenses.reduce((sum, e) => sum + (Number.isFinite(e.amount) ? e.amount : 0), 0),
    [expenses]
  );

  const orderedCategories = useMemo(() => {
    const keys = Array.from(grouped.keys());
    return keys.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a as (typeof CATEGORY_ORDER)[number]);
      const bi = CATEGORY_ORDER.indexOf(b as (typeof CATEGORY_ORDER)[number]);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [grouped]);

  return (
    <aside className="sticky top-6 h-[calc(100vh-3rem)] w-full rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden">
      <header className="px-6 py-5 border-b border-slate-100">
        <p className="text-xs uppercase tracking-wider text-slate-500">
          Running Budget
        </p>
        <h2 className="mt-1 text-2xl font-semibold text-ink">Your Trip</h2>
      </header>

      <div className="flex-1 overflow-y-auto chat-scroll px-6 py-4">
        {expenses.length === 0 ? (
          <div className="text-sm text-slate-500 mt-8 text-center">
            <p className="mb-2">No expenses yet.</p>
            <p>
              Tell the assistant about your plans — flights, hotels, meals, anything
              with a price — and they will appear here.
            </p>
          </div>
        ) : (
          <ul className="space-y-6">
            {orderedCategories.map((cat) => {
              const items = grouped.get(cat) ?? [];
              const subtotal = items.reduce((s, i) => s + i.amount, 0);
              return (
                <li key={cat}>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        CATEGORY_ACCENT[cat] ?? CATEGORY_ACCENT.Other
                      }`}
                    >
                      {cat}
                    </span>
                    <span className="text-xs text-slate-500">
                      {currency(subtotal)}
                    </span>
                  </div>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100 bg-slate-50/50">
                    {items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between px-3 py-2"
                      >
                        <span className="text-sm text-ink truncate pr-3">
                          {item.name}
                        </span>
                        <span className="text-sm font-medium text-ink tabular-nums">
                          {currency(item.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="border-t border-slate-100 px-6 py-4 bg-slate-50/60">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium text-slate-600">Grand Total</span>
          <span className="text-2xl font-semibold text-ink tabular-nums">
            {currency(total)}
          </span>
        </div>
      </footer>
    </aside>
  );
}
