import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RecommendationsService } from "../recommendations/recommendations.service";
import { parseAssistantReply } from "./assistant-reply";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 20_000;

/**
 * Conversational ordering assistant (M10). Grounded on today's menu as the
 * rule-based recommender sees it for this customer: allergy, diet and budget
 * filters are applied *before* the model sees anything, and its dish picks
 * are re-validated after. Conversations are not stored.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly recommendations: RecommendationsService,
  ) {}

  enabled() {
    return Boolean(this.config.get<string>("ANTHROPIC_API_KEY"));
  }

  async chat(userId: string, messages: ChatMessage[]) {
    const apiKey = this.config.get<string>("ANTHROPIC_API_KEY");
    if (!apiKey) throw new ServiceUnavailableException("The assistant is not configured");
    const alternates = messages.every((m, i) => m.role === (i % 2 === 0 ? "user" : "assistant"));
    if (!alternates || messages[messages.length - 1].role !== "user") {
      throw new BadRequestException("Messages must alternate, starting and ending with the customer");
    }

    const today = await this.recommendations.today(userId, { log: false });
    const suitable = [...today.picks, ...today.others].map((r) => r.item);
    const dishById = new Map(suitable.map((d) => [d.id, d]));

    const response = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: this.config.get<string>("ANTHROPIC_MODEL") ?? "claude-haiku-4-5-20251001",
        max_tokens: 700,
        system: buildSystemPrompt(today, suitable),
        messages,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch((error: Error) => {
      this.logger.warn(`Assistant request failed: ${error.message}`);
      return null;
    });
    if (!response || !response.ok) {
      if (response) this.logger.warn(`Assistant upstream status ${response.status}`);
      throw new ServiceUnavailableException("The assistant is unavailable right now");
    }

    const data = (await response.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
    const parsed = parseAssistantReply(text, new Set(dishById.keys()));
    return { reply: parsed.reply, dishes: parsed.dishIds.map((id) => dishById.get(id)!) };
  }
}

type Today = Awaited<ReturnType<RecommendationsService["today"]>>;

function buildSystemPrompt(today: Today, suitable: Today["picks"][number]["item"][]) {
  const menu = suitable.map((d) => ({
    id: d.id, name: d.name, description: d.description, priceEur: d.priceCents / 100, kcal: d.calories,
    proteinG: d.proteinG, carbsG: d.carbsG, fatG: d.fatG, allergens: d.allergens, diet: d.dietTags,
  }));
  const excluded = today.excluded.map((e) => `- ${e.item.name}: ${e.reasons.join("; ")}`).join("\n") || "(none)";
  return [
    "You are the ordering assistant of a healthy-food kitchen in Athens. Reply in Greek, warmly and briefly (at most about 80 words).",
    "Rules:",
    "- Recommend ONLY dishes from TODAY'S MENU below, using their exact names. Never invent dishes, prices or nutrition values.",
    "- Dishes under NOT SUITABLE conflict with this customer's allergies, diet or budget. Never recommend them; if asked, explain why briefly.",
    "- Nutrition values are indicative. Do not give medical or dietetic advice. For medical conditions, pregnancy or eating concerns, suggest a doctor or a registered dietitian.",
    "- If the request is unrelated to food or ordering, steer gently back to today's menu.",
    'Answer ONLY with JSON: {"reply": "<your answer in Greek>", "dishIds": ["<id>"]} listing at most 3 ids from TODAY\'S MENU that your reply recommends.',
    "",
    `CUSTOMER: goal=${today.goal}; indicative energy for a main meal=${today.mealTargetKcal ? `~${today.mealTargetKcal} kcal` : "unknown"}.`,
    `TODAY'S MENU (already filtered for this customer): ${JSON.stringify(menu)}`,
    `NOT SUITABLE TODAY:\n${excluded}`,
  ].join("\n");
}
