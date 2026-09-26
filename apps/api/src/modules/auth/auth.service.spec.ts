import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { AuthService, hashRefreshToken } from "./auth.service";
import { PrismaService } from "../../prisma/prisma.service";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("AuthService", () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock };
    refreshToken: { create: jest.Mock; findUnique: jest.Mock; updateMany: jest.Mock };
  };

  const user = { id: "user-1", email: "test@example.com", role: "customer" };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn() },
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number> = {
          JWT_ACCESS_SECRET: "test-access-secret-000000",
          JWT_ACCESS_EXPIRES_IN: "15m",
          REFRESH_TOKEN_TTL_DAYS: 30,
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    service = new AuthService(prisma as unknown as PrismaService, new JwtService({}), config);
  });

  describe("register", () => {
    it("hashes the password and stores only a hash of the refresh token", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(user);

      const tokens = await service.register({ email: user.email, password: "supersecret123" });

      const createdUser = prisma.user.create.mock.calls[0][0].data;
      expect(createdUser.passwordHash).not.toBe("supersecret123");

      const storedToken = prisma.refreshToken.create.mock.calls[0][0].data;
      expect(storedToken.userId).toBe(user.id);
      expect(storedToken.tokenHash).toBe(hashRefreshToken(tokens.refreshToken));
      expect(storedToken.tokenHash).not.toBe(tokens.refreshToken);
      expect(storedToken.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * DAY_MS);
      expect(tokens.accessToken).toEqual(expect.any(String));
    });

    it("rejects registration when the email is already taken", async () => {
      prisma.user.findUnique.mockResolvedValue({ id: "existing-user" });
      await expect(
        service.register({ email: "taken@example.com", password: "supersecret123" }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("login", () => {
    it("issues tokens when the password matches", async () => {
      const passwordHash = await argon2.hash("correct-password");
      prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash });
      const tokens = await service.login({ email: user.email, password: "correct-password" });
      expect(tokens.accessToken).toEqual(expect.any(String));
      expect(tokens.refreshToken).toEqual(expect.any(String));
    });

    it("rejects an unknown email", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: "nobody@example.com", password: "whatever123" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects an incorrect password", async () => {
      const passwordHash = await argon2.hash("correct-password");
      prisma.user.findUnique.mockResolvedValue({ ...user, passwordHash });
      await expect(
        service.login({ email: user.email, password: "wrong-password" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("refresh", () => {
    const validStored = () => ({
      id: "rt-1",
      userId: user.id,
      user,
      revokedAt: null,
      expiresAt: new Date(Date.now() + DAY_MS),
    });

    it("rotates: revokes the presented token and issues a new pair", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(validStored());

      const tokens = await service.refresh("presented-token");

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tokenHash: hashRefreshToken("presented-token") } }),
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: "rt-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(tokens.refreshToken).not.toBe("presented-token");
    });

    it("rejects an unknown token", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);
      await expect(service.refresh("unknown")).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it("treats reuse of a revoked token as theft and revokes every session", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({ ...validStored(), revokedAt: new Date() });

      await expect(service.refresh("stolen")).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it("rejects an expired token", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue({
        ...validStored(),
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh("old")).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it("rejects the loser of a concurrent rotation race", async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(validStored());
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.refresh("raced")).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("revokes only the presented token", async () => {
      await service.logout("my-token");
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: hashRefreshToken("my-token"), revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });
});
