import { BadRequestException, ServiceUnavailableException } from "@nestjs/common";
import { parseAssistantReply } from "./assistant-reply";
import { AssistantService } from "./assistant.service";

describe("parseAssistantReply", () => {
  const allowed = new Set(["bowl", "salad"]);
  it("keeps only dish ids that are on today's (filtered) menu", () => {
    expect(parseAssistantReply('{"reply":"Δοκίμασε το bowl.","dishIds":["bowl","invented","salmon-with-allergen"]}', allowed))
      .toEqual({ reply: "Δοκίμασε το bowl.", dishIds: ["bowl"] });
  });
  it("accepts fenced JSON, and falls back to plain text with no dishes", () => {
    expect(parseAssistantReply('```json\n{"reply":"Γεια!","dishIds":["salad","salad"]}\n```', allowed)).toEqual({ reply: "Γεια!", dishIds: ["salad"] });
    expect(parseAssistantReply("Απλό κείμενο", allowed)).toEqual({ reply: "Απλό κείμενο", dishIds: [] });
  });
});

describe("AssistantService", () => {
  const dish = (id: string, name: string) => ({ id, name, description: null, priceCents: 850, calories: 540, proteinG: 42, carbsG: 48, fatG: 18, allergens: [], dietTags: [] });
  const today = {
    goal: "gain_muscle", mealTargetKcal: 700,
    picks: [{ item: dish("bowl", "Bowl κοτόπουλο"), score: 0.8, reasons: [] }],
    others: [],
    excluded: [{ item: dish("salmon", "Σολομός"), reasons: ["Περιέχει ψάρια"] }],
  };
  const setup = (key: string | undefined) => {
    const config = { get: jest.fn((k: string) => (k === "ANTHROPIC_API_KEY" ? key : undefined)) };
    const recommendations = { today: jest.fn().mockResolvedValue(today) };
    return { recommendations, service: new AssistantService(config as never, recommendations as never) };
  };
  const ask = [{ role: "user" as const, content: "Θέλω κάτι με πρωτεΐνη" }];
  afterEach(() => jest.restoreAllMocks());

  it("is off without an API key", async () => {
    const { service } = setup(undefined);
    expect(service.enabled()).toBe(false);
    await expect(service.chat("u1", ask)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("grounds the model on the customer's filtered menu and returns only safe dishes", async () => {
    const { service, recommendations } = setup("sk-ant-test");
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: "text", text: '{"reply":"Το bowl έχει 42 g πρωτεΐνη.","dishIds":["bowl","salmon"]}' }] }),
    } as Response);

    const result = await service.chat("u1", ask);

    expect(recommendations.today).toHaveBeenCalledWith("u1", { log: false });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("sk-ant-test");
    const body = JSON.parse(init.body as string);
    expect(body.messages).toEqual(ask);
    expect(body.system).toContain("Bowl κοτόπουλο");
    expect(body.system).toContain("NOT SUITABLE TODAY:\n- Σολομός: Περιέχει ψάρια");
    expect(body.system).toContain("medical");
    // the model suggested the salmon too; it contains the customer's allergen, so it is dropped
    expect(result.reply).toBe("Το bowl έχει 42 g πρωτεΐνη.");
    expect(result.dishes.map((d) => d.id)).toEqual(["bowl"]);
  });

  it("turns upstream failures into a clean 503", async () => {
    const { service } = setup("sk-ant-test");
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 529 } as Response);
    await expect(service.chat("u1", ask)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("rejects conversations that don't alternate or don't end with the customer", async () => {
    const { service } = setup("sk-ant-test");
    await expect(service.chat("u1", [{ role: "assistant", content: "hi" }])).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.chat("u1", [...ask, { role: "assistant", content: "ok" }])).rejects.toBeInstanceOf(BadRequestException);
  });
});
