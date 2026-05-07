export type ExpenseCategory =
  | "Flights"
  | "Lodging"
  | "Dining"
  | "Activities"
  | "Other";

export const EXPENSE_CATEGORIES: readonly ExpenseCategory[] = [
  "Flights",
  "Lodging",
  "Dining",
  "Activities",
  "Other",
] as const;

export interface Expense {
  id: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type AIAction = "ADD" | "UPDATE" | "DELETE";

export interface AIUpdate {
  action: AIAction;
  id: string;
  name: string;
  category: string;
  amount: number;
}

export interface AIRawResponse {
  reply: string;
  updates: AIUpdate[];
}
