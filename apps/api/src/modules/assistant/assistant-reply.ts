/**
 * The model is asked for {"reply": string, "dishIds": string[]}. Whatever it
 * returns, only ids from the allowed (suitable, on-menu) set survive, so a
 * confused or manipulated model can't surface an unsafe or invented dish.
 */
export function parseAssistantReply(text: string, allowedIds: Set<string>) {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(stripped) as { reply?: unknown; dishIds?: unknown };
    if (typeof parsed.reply === "string" && parsed.reply.trim()) {
      const ids = Array.isArray(parsed.dishIds) ? parsed.dishIds.filter((id): id is string => typeof id === "string") : [];
      return { reply: parsed.reply.trim(), dishIds: [...new Set(ids.filter((id) => allowedIds.has(id)))].slice(0, 3) };
    }
  } catch {
    // not JSON: fall through and use the text as-is
  }
  return { reply: text.trim(), dishIds: [] as string[] };
}
