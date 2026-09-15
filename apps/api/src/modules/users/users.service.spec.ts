import { NotFoundException } from "@nestjs/common";
import { UsersService } from "./users.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("UsersService", () => {
  let service: UsersService;
  let prisma: {
    user: { findUnique: jest.Mock };
    customerProfile: { findUnique: jest.Mock; upsert: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      customerProfile: { findUnique: jest.fn(), upsert: jest.fn() },
    };
    service = new UsersService(prisma as unknown as PrismaService);
  });

  describe("findById", () => {
    it("returns the user when found", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.com", role: "customer" });
      const user = await service.findById("u1");
      expect(user.id).toBe("u1");
    });

    it("throws NotFoundException when missing", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findById("missing")).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe("getProfile", () => {
    it("returns sensible defaults when no profile exists yet", async () => {
      prisma.customerProfile.findUnique.mockResolvedValue(null);
      const profile = await service.getProfile("u1");
      expect(profile.userId).toBe("u1");
      expect(profile.dietaryPreferences).toEqual([]);
      expect(profile.excludedIngredients).toEqual([]);
    });

    it("returns the stored profile when it exists", async () => {
      prisma.customerProfile.findUnique.mockResolvedValue({
        userId: "u1",
        goal: "lose_weight",
        dietaryPreferences: ["vegetarian"],
        excludedIngredients: [],
      });
      const profile = await service.getProfile("u1");
      expect(profile.goal).toBe("lose_weight");
      expect(profile.dietaryPreferences).toEqual(["vegetarian"]);
    });
  });

  describe("upsertProfile", () => {
    it("creates a profile with the given userId when none exists", async () => {
      prisma.customerProfile.upsert.mockResolvedValue({ userId: "u1", goal: "gain_muscle" });
      await service.upsertProfile("u1", { goal: "gain_muscle" });

      const call = prisma.customerProfile.upsert.mock.calls[0][0];
      expect(call.where).toEqual({ userId: "u1" });
      expect(call.create).toEqual({ userId: "u1", goal: "gain_muscle" });
      expect(call.update).toEqual({ goal: "gain_muscle" });
    });
  });
});
