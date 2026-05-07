import type { Expense } from "./types";

export interface ApplyResult {
  next: Expense[];
  changed: number;
  summary: string;
}

export function applyUpdates(
  current: Expense[],
  updates: unknown
): ApplyResult;

export function ledgerTotal(items: Expense[]): number;
