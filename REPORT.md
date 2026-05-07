# Part 1: What & why

Tripbudgeter is a single-page web app that turns trip planning into a conversation. The user talks to an AI travel chat box in the left column ("I want a week in Tokyo in April — what should I see?"); the AI answers in plain English, while a structured budget ledger on the right column simultaneously updates itself any time the user mentions a price, daily rate, duration change, or cancellation. It will also give suggestions on things to do and lets you add to the spending cost. There is no database, no authorization, no third-party services beyond a single OpenAI API key.

The intended user is someone in the early "out-loud planning" stage of a trip, who normally jumps between Google Docs, calculator tabs, and chat threads. The chat-plus-ledger pattern collapses that mess into one surface.

What is hard about getting the AI behavior right is that the model has to do two unrelated jobs in a single response, on every single turn: hold a warm, suggestive conversation, and act as a deterministic multi-turn entity extractor whose output mutates state the user can visually verify on the right side of the screen. A simpler "text in → JSON out, once" pattern (the Project 4 shape) cannot do this for three reasons. First is identity persistence across turns. When the user says "make the hotel 7 nights instead" three turns after first mentioning the hotel, the model must re-emit the same id it used originally so the ledger can find the row to update — not invent a new one. Second is implied math under uncertainty. "$50 a day for 5 days" must become 250 every time, and "extended to 7 nights" must trigger a recompute of the existing lodging row, not a new ADD. Finally, graceful degradation is required. Because the JSON drives a live UI, a single hallucinated key would otherwise crash the page mid-conversation. The architecture solves these by combining response_format: { type: "json_object" }, a shared prompt module, and a defensive reducer that treats every model field as untrusted.
# Part 2: Iterations (V1, V2, V3)

## V1: Strict-extractor prompt

**Change.** Initial scaffold. The system prompt told the model you are an invisible financial data extraction engine, act as a data parser only, and do not output conversational text. The schema was the { updates: [...] } shape with no reply field. The frontend never rendered model text — it manufactured canned summaries like Got it — added Hotel $900 from the structured updates. Saved verbatim in eval/prompt_versions/v1.mjs.

**Motivating example.** Test case 7: Hotel is $100 a night for 3 nights followed by We extended the trip — make it 5 nights. Expected total: 500. The model produced two rows — a hotel_3_nights row at $300 and a separate Hotel row at $500 — for an actual total of **800**. The terse prompt didn't tell it to re-use ids across turns, so it minted a new one.

**Delta.** No prior baseline → **9 / 10 = 0.90**.

**Conclusion.** Math worked, single-turn extraction worked, but multi-turn identity was the obvious next bottleneck. V2 needed an explicit stable id rule and worked examples for duration changes.

## V2: Numbered-rules extractor

**Change.** Same role, but rewritten as numbered rules with a worked example for duration changes and an explicit instruction to use a stable, predictable, snake_case id and re-use the same id whenever the user is talking about the same logical line item. Saved in eval/prompt_versions/v2.mjs.

**Motivating example.** The same case 7 from V1. With the new rules, case 7 now passes: the model emits hotel then UPDATEs the same hotel id when the duration extends. But the eval surfaced a **new** failure mode on case 6: Flight is $500 followed by Actually the flight ended up being $620, please update it. The model now used one_way_flight for the first turn and round_trip_flight for the update — two different ids, both rows kept in the ledger, total $1,120 instead of $620.

**Delta.** 0.90 → **0.90**. Net accuracy was flat, but the failure shifted from a hard semantic problem to a softer one.

**Conclusion.** The numbered-rules format had a hidden side effect: saying stable, predictable made the model invent more semantically specific names rather than the simpler stable shorthand we wanted. Throwing more rules at the same flat schema was hitting diminishing returns. The next iteration changed the interaction shape instead.

## V3: Conversational concierge with dual-output schema

**Change.** Extended the schema to { reply: ..., updates: [...] } and rewrote the system prompt as a Trip persona that has two explicit jobs every turn. The frontend now renders reply directly in the chat bubble instead of using a canned summary. Bumped temperature from 0.1 to 0.6 so the conversation reads naturally; left the JSON-mode constraint in place for the structured part. Saved in eval/prompt_versions/v3.mjs.

**Motivating example.** Same case 6 from V2. With the persona prompt the model is forced to narrate what it is doing in reply, like got it updating the flight to $620, which seems to anchor it on a single canonical id instead of inventing a new specialized one for the update. The over-specialization regression from V2 disappeared without any explicit instruction targeting it.

**Delta.** 0.90 → **1.00** on the same eval set.

**Conclusion.** The metric jumped a full case, despite an intuitively-harder task. I think the gain is real but the run is somewhat lucky — case 6 is the kind of borderline identity-disambiguation problem that could flip on any single run. The qualitative win is solid: the app gained a real conversational surface with no measurable accuracy regression. Next I would raise the bar by adding 10 harder eval cases, and add a summarize my trip so far tool the model can call to verify its own ledger state before responding.

# Part 3: Code walkthrough

To follow the process of a user's interaction with the chat system, it is necessary to analyze the case when the user types "Hotel is $180 a night for 5 nights" and sends the message. It can be noted that the chat text box can be found in components/ChatPanel.tsx:99, and after sending the message, the form submits the message and executes the handleSubmit function written in app/page.tsx:19. At this point, the message appears on the screen, input value resets, and the loading state switches to true, which activates the loading spinner and disables the button to comply with the explicit loading state requirement. Then the application posts the conversation history into app/api/chat/route.ts:32, where the route collects the system prompt and passes it to the OpenAI API by applying the strict JSON object response format. In order not to crash the application due to the hallucination of the AI about bad JSON formatting, the JSON response parsing is done within a try/catch statement. Then on the frontend side of the app, the data is processed by the applyUpdates function written in lib/applyUpdates.mjs to compute the mathematical numbers and update React state for rendering in the sidebar. One of the key decisions that I made during my design process was to implement this logic within a .mjs file, which would enable me to reuse the logic between the React app and the evaluation script. I evaluated the possibility of implementing the reducer directly in TypeScript, but I did not find it suitable, as I would then need to reimplement it in JavaScript to run it within the evaluation script.

# Part 4: AI disclosure & safety

Cursor (Claude Sonnet) was used in generating boilerplate code, setting up UI components, and writing out initial test cases. In the course of development, I had three instances of failure from the AI assistant. The first case occurred during development in the form of a regression in the type system when Cursor put the prompt in a different .mjs file, which broke the type enforcement checks since the string returned was simply a string. Recovery from this was relatively easy as I manually generated a declaration file. The second instance occurred when, in trying to write the V3 conversational prompt, Cursor hallucinated an instruction by leaving in an old line stating that the AI should not output any conversational prompts. Recovery from this was done manually by reading the code and deleting the contradiction. Lastly, Cursor caused a leakage of credentials in the form of a generated .env.example file with a key that resembled an active token. I recovered from this by immediately revoking my actual API key on the OpenAI dashboard and replacing the leaked string with a safe placeholder.

By far the greatest threat to the safety of this particular use case is the prospect of runaway costs due to prompt injection. In this case, because the AI processes all past messages from the chat log on each turn, a malicious user could inject a large block of text instructing the AI to generate a large number of fabricated budgets. This would result in a very large JSON response, causing an artificial inflation of my OpenAI API bill. To deal with this threat, I recognized that, as this was a locally deployed, single-user application, any harmful prompt could only affect their own experience. Moreover, I programmed my reducer robustly to discard any faulty row of data without crashing the front-end display.
