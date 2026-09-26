import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateMenuItemDto, UpdateMenuItemDto } from "./menu-item.dto";

const valid = { name: "Bowl", priceCents: 850, portionWeightG: 420, calories: 540,
  proteinG: 42, carbsG: 48.5, fatG: 18, allergens: ["milk", "sesame"] };
const errorsFor = async (cls: typeof CreateMenuItemDto | typeof UpdateMenuItemDto, body: object) =>
  (await validate(plainToInstance(cls, body))).map((e) => e.property);

describe("menu item DTOs", () => {
  it("accept a complete dish", async () => {
    expect(await errorsFor(CreateMenuItemDto, valid)).toEqual([]);
  });
  it("only accept the 14 EU allergen codes, without duplicates", async () => {
    expect(await errorsFor(CreateMenuItemDto, { ...valid, allergens: ["milk", "chocolate"] })).toEqual(["allergens"]);
    expect(await errorsFor(CreateMenuItemDto, { ...valid, allergens: ["milk", "milk"] })).toEqual(["allergens"]);
  });
  it("reject negative prices and non-integer cents", async () => {
    expect(await errorsFor(CreateMenuItemDto, { ...valid, priceCents: -1 })).toEqual(["priceCents"]);
    expect(await errorsFor(CreateMenuItemDto, { ...valid, priceCents: 8.5 })).toEqual(["priceCents"]);
  });
  it("allow partial updates but still validate what is sent", async () => {
    expect(await errorsFor(UpdateMenuItemDto, { priceCents: 900 })).toEqual([]);
    expect(await errorsFor(UpdateMenuItemDto, { calories: -5 })).toEqual(["calories"]);
  });
});
