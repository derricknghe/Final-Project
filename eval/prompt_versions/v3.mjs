// V3 — current production prompt. Re-exports lib/systemPrompt.mjs so
// there is no chance of drift between what the eval measures and what
// the live app actually sends to the model.
export { SYSTEM_PROMPT } from "../../lib/systemPrompt.mjs";
