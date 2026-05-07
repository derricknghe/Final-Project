"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  messages: ChatMessage[];
  input: string;
  isLoading: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}

export function ChatPanel({
  messages,
  input,
  isLoading,
  error,
  onInputChange,
  onSubmit,
}: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim().length > 0) onSubmit();
    }
  };

  return (
    <section className="flex h-[calc(100vh-3rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <header className="px-6 py-5 border-b border-slate-100">
        <p className="text-xs uppercase tracking-wider text-slate-500">
          Tripbudgeter
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">
          Plan your trip out loud
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask for ideas, get suggestions, and mention any prices —
          your trip and your budget on the right both grow together.
        </p>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto chat-scroll px-6 py-6 space-y-4"
      >
        {messages.length === 0 && (
          <div className="text-sm text-slate-500 max-w-md mx-auto text-center mt-10">
            <p className="mb-2 font-medium text-slate-600">Try saying:</p>
            <ul className="space-y-1.5">
              <li>“I want to go to Tokyo for a week in April — what should I do?”</li>
              <li>“Hotel is $180 a night for 5 nights.”</li>
              <li>“What’s a good neighborhood to stay in for a first-timer?”</li>
              <li>“Budget about $60 a day for food.”</li>
            </ul>
          </div>
        )}

        {messages.map((m, idx) => (
          <MessageBubble key={idx} message={m} />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner />
            <span>Reading your message…</span>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      <form
        className="border-t border-slate-100 px-4 py-4 bg-slate-50/60"
        onSubmit={(e) => {
          e.preventDefault();
          if (!isLoading && input.trim().length > 0) onSubmit();
        }}
      >
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Ask anything about your trip — ideas, logistics, prices…"
            className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-emerald-100"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || input.trim().length === 0}
            className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "bg-ink text-white rounded-br-sm"
            : "bg-slate-100 text-ink rounded-bl-sm"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-ink"
      aria-hidden="true"
    />
  );
}
