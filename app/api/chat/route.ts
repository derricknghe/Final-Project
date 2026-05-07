import { NextResponse } from "next/server";
import OpenAI from "openai";
import type { AIRawResponse, ChatMessage } from "@/lib/types";
import { SYSTEM_PROMPT } from "@/lib/systemPrompt.mjs";

export const runtime = "nodejs";

interface ChatRequestBody {
  messages: ChatMessage[];
}

const FALLBACK_REPLY =
  "Sorry — I had trouble responding to that. Could you rephrase it?";

export async function POST(request: Request) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!body?.messages || !Array.isArray(body.messages)) {
    return NextResponse.json(
      { error: "`messages` must be an array of chat messages." },
      { status: 400 }
    );
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      temperature: 0.6,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...body.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    const raw =
      completion.choices[0]?.message?.content ??
      `{"reply": ${JSON.stringify(FALLBACK_REPLY)}, "updates": []}`;

    let parsed: AIRawResponse = { reply: FALLBACK_REPLY, updates: [] };
    try {
      const candidate = JSON.parse(raw) as Partial<AIRawResponse>;
      const reply =
        typeof candidate?.reply === "string" && candidate.reply.trim().length > 0
          ? candidate.reply
          : FALLBACK_REPLY;
      const updates = Array.isArray(candidate?.updates)
        ? candidate.updates
        : [];
      parsed = { reply, updates };
    } catch {
      parsed = { reply: FALLBACK_REPLY, updates: [] };
    }

    return NextResponse.json(parsed);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown OpenAI error";
    return NextResponse.json(
      { error: `OpenAI request failed: ${message}` },
      { status: 500 }
    );
  }
}
