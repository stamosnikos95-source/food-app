import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { AuthUser } from "@food-app/shared-types";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { costRecipe, foodCostPercent } from "./recipe-costing";
import {
  CreateIngredientDto,
  CreateRecipeDto,
  RecipeLineDto,
  UpdateIngredientDto,
  UpdateRecipeDto,
} from "./kitchen.dto";

const recipeInclude = {
  lines: { include: { ingredient: true }, orderBy: { grams: "desc" as const } },
  menuItem: { select: { id: true, name: true, priceCents: true, allergens: true } },
} satisfies Prisma.RecipeInclude;

type RecipeWithLines = Prisma.RecipeGetPayload<{ include: typeof recipeInclude }>;

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

@Injectable()
export class AdminKitchenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  // ---------- ingredients ----------

  listIngredients() {
    return this.prisma.ingredient.findMany({ orderBy: { name: "asc" } });
  }

  async createIngredient(dto: CreateIngredientDto, actor: AuthUser) {
    this.assertMacros(dto);
    try {
      const created = await this.prisma.ingredient.create({ data: { ...dto, name: dto.name.trim() } });
      await this.audit.record(actor.id, "ingredient.created", "ingredient", created.id, { name: created.name });
      return created;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("An ingredient with this name already exists");
      throw error;
    }
  }

  async updateIngredient(id: string, dto: UpdateIngredientDto, actor: AuthUser) {
    const current = await this.prisma.ingredient.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Ingredient not found");
    this.assertMacros({ ...current, ...dto });
    try {
      const updated = await this.prisma.ingredient.update({
        where: { id },
        data: { ...dto, ...(dto.name ? { name: dto.name.trim() } : {}) },
      });
      await this.audit.record(actor.id, "ingredient.updated", "ingredient", id, { ...dto });
      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("An ingredient with this name already exists");
      throw error;
    }
  }

  // ---------- recipes ----------

  async listRecipes() {
    const recipes = await this.prisma.recipe.findMany({ include: recipeInclude, orderBy: { name: "asc" } });
    return recipes.map((r) => this.toView(r));
  }

  async getRecipe(id: string) {
    return this.toView(await this.loadRecipe(id));
  }

  async createRecipe(dto: CreateRecipeDto, actor: AuthUser) {
    await this.assertLines(dto.lines);
    try {
      const created = await this.prisma.recipe.create({
        data: {
          name: dto.name.trim(),
          yieldPortions: dto.yieldPortions,
          notes: dto.notes,
          menuItemId: dto.menuItemId ?? null,
          lines: { create: dto.lines.map((l) => ({ ingredientId: l.ingredientId, grams: l.grams })) },
        },
        include: recipeInclude,
      });
      await this.audit.record(actor.id, "recipe.created", "recipe", created.id, { name: created.name });
      return this.toView(created);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("That dish already has a recipe");
      throw error;
    }
  }

  async updateRecipe(id: string, dto: UpdateRecipeDto, actor: AuthUser) {
    await this.loadRecipe(id);
    if (dto.lines) await this.assertLines(dto.lines);
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.recipe.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.yieldPortions !== undefined ? { yieldPortions: dto.yieldPortions } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
            ...(dto.menuItemId !== undefined ? { menuItemId: dto.menuItemId } : {}),
          },
        });
        if (dto.lines) {
          // Lines are edited as a whole list: replace atomically.
          await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
          await tx.recipeIngredient.createMany({
            data: dto.lines.map((l) => ({ recipeId: id, ingredientId: l.ingredientId, grams: l.grams })),
          });
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("That dish already has a recipe");
      throw error;
    }
    await this.audit.record(actor.id, "recipe.updated", "recipe", id, {
      fields: Object.keys(dto),
    });
    return this.getRecipe(id);
  }

  /**
   * Copies the recipe's per-portion nutrition onto its dish. Allergens are
   * merged, never replaced: over-declaring is safe, silently dropping one
   * (e.g. a cross-contamination warning added by hand) is not.
   */
  async applyToMenu(id: string, actor: AuthUser) {
    const recipe = await this.loadRecipe(id);
    if (!recipe.menuItem) throw new BadRequestException("Link the recipe to a dish first");
    if (recipe.lines.length === 0) throw new BadRequestException("The recipe has no ingredients");

    const costing = costRecipe(recipe.lines, recipe.yieldPortions);
    const allergens = [...new Set([...recipe.menuItem.allergens, ...costing.allergens])].sort();
    const p = costing.perPortion;

    const updated = await this.prisma.menuItem.update({
      where: { id: recipe.menuItem.id },
      data: {
        calories: p.calories,
        proteinG: p.proteinG,
        carbsG: p.carbsG,
        fatG: p.fatG,
        portionWeightG: Math.max(1, p.weightG),
        allergens,
      },
    });
    await this.audit.record(actor.id, "menu.nutrition_from_recipe", "menu_item", updated.id, {
      recipeId: id,
      perPortion: p,
      allergens,
    });
    return updated;
  }

  // ---------- helpers ----------

  private async loadRecipe(id: string): Promise<RecipeWithLines> {
    const recipe = await this.prisma.recipe.findUnique({ where: { id }, include: recipeInclude });
    if (!recipe) throw new NotFoundException("Recipe not found");
    return recipe;
  }

  private toView(recipe: RecipeWithLines) {
    const vatPercent = this.config.get<number>("MENU_VAT_PERCENT") ?? 13;
    const costing = costRecipe(recipe.lines, recipe.yieldPortions);
    return {
      id: recipe.id,
      name: recipe.name,
      yieldPortions: recipe.yieldPortions,
      notes: recipe.notes,
      menuItem: recipe.menuItem
        ? { id: recipe.menuItem.id, name: recipe.menuItem.name, priceCents: recipe.menuItem.priceCents }
        : null,
      lines: recipe.lines.map((l) => ({
        ingredientId: l.ingredientId,
        name: l.ingredient.name,
        grams: l.grams,
        costCents: Math.round((l.grams / 1000) * l.ingredient.costPerKgCents),
      })),
      costing,
      vatPercent,
      foodCostPercent: recipe.menuItem
        ? foodCostPercent(costing.perPortion.costCents, recipe.menuItem.priceCents, vatPercent)
        : null,
    };
  }

  private assertMacros(v: { proteinPer100g?: number; carbsPer100g?: number; fatPer100g?: number }) {
    const sum = (v.proteinPer100g ?? 0) + (v.carbsPer100g ?? 0) + (v.fatPer100g ?? 0);
    if (sum > 100) throw new BadRequestException("Protein + carbs + fat can't exceed 100 g per 100 g");
  }

  private async assertLines(lines: RecipeLineDto[]) {
    const ids = lines.map((l) => l.ingredientId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException("Each ingredient can appear only once in a recipe");
    }
    if (ids.length === 0) return;
    const found = await this.prisma.ingredient.count({ where: { id: { in: ids } } });
    if (found !== ids.length) throw new BadRequestException("Unknown ingredient in recipe");
  }
}
