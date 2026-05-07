"use client";

import { useCallback, useState } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { BudgetSidebar } from "@/components/BudgetSidebar";
import { applyUpdates } from "@/lib/applyUpdates.mjs";
import type { AIRawResponse, ChatMessage, Expense } from "@/lib/types";

const FALLBACK_REPLY =
  "Got it. What else would you like to plan?";

export default function HomePage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    const trimmed = input.trim();
    if (trimmed.length === 0 || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) {
        const errText = await res
          .json()
          .then((j) => j?.error)
          .catch(() => null);
        throw new Error(
          errText || `Request failed with status ${res.status}`
        );
      }

      const data = (await res.json()) as Partial<AIRawResponse>;
      const updates = Array.isArray(data?.updates) ? data.updates : [];
      const reply =
        typeof data?.reply === "string" && data.reply.trim().length > 0
          ? data.reply
          : FALLBACK_REPLY;

      setExpenses((prev) => applyUpdates(prev, updates).next);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply },
      ]);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Something went wrong.";
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry — I couldn't reach the trip-planning service. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages]);

  return (
    <main className="min-h-screen w-full">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
          <ChatPanel
            messages={messages}
            input={input}
            isLoading={isLoading}
            error={error}
            onInputChange={setInput}
            onSubmit={handleSubmit}
          />
          <BudgetSidebar expenses={expenses} />
        </div>
      </div>
    </main>
  );
}
