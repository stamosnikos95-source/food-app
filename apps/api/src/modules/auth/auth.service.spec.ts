import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { AuthService } from "./auth.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("AuthService", () => {
  let service: AuthService;
  let prisma: { user: { findUnique: jest.Mock; create: jest.Mock } };
  let jwt: JwtService;
  let config: ConfigService;

  beforeEach(() => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
    };

    jwt = new JwtService({});
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          JWT_ACCESS_SECRET: "test-access-secret-000000",
          JWT_ACCESS_EXPIRES_IN: "15m",
          JWT_REFRESH_SECRET: "test-refresh-secret-000000",
          JWT_REFRESH_EXPIRES_IN: "7d",
        };
        return values[key];
      }),
    } as unknown as ConfigService;

    service = new AuthService(prisma as unknown as PrismaService, jwt, config);
  });

  describe("register", () => {
    it("creates a user with a hashed password and returns tokens", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        role: "customer",
      });

      const tokens = await service.register({
        email: "test@example.com",
        password: "supersecret123",
      });

      expect(prisma.user.create).toHaveBeenCalledTimes(1);
      const createArgs = prisma.user.create.mock.calls[0][0];
      expect(createArgs.data.email).toBe("test@example.com");
      // The plaintext password must never be persisted.
      expect(createArgs.data.passwordHash).not.toBe("supersecret123");

      expect(tokens.accessToken).toEqual(expect.any(String));
      expect(tokens.refreshToken).toEqual(expect.any(String));
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
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        role: "customer",
        passwordHash,
      });

      const tokens = await service.login({
        email: "test@example.com",
        password: "correct-password",
      });

      expect(tokens.accessToken).toEqual(expect.any(String));
    });

    it("rejects an unknown email", async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: "nobody@example.com", password: "whatever123" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rejects an incorrect password", async () => {
      const passwordHash = await argon2.hash("correct-password");
      prisma.user.findUnique.mockResolvedValue({
        id: "user-1",
        email: "test@example.com",
        role: "customer",
        passwordHash,
      });

      await expect(
        service.login({ email: "test@example.com", password: "wrong-password" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
