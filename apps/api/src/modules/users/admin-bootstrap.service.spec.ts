import { ConfigService } from "@nestjs/config";
import { plainToInstance } from "class-transformer";
import { AdminBootstrapService } from "./admin-bootstrap.service";
import { PrismaService } from "../../prisma/prisma.service";
import { RegisterDto } from "../auth/dto/register.dto";
import { LoginDto } from "../auth/dto/login.dto";

describe("AdminBootstrapService", () => {
  const make = (adminEmails: string, user: unknown) => {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user), update: jest.fn() } };
    const config = { get: jest.fn(() => adminEmails) } as unknown as ConfigService;
    return { prisma, service: new AdminBootstrapService(prisma as unknown as PrismaService, config) };
  };

  it("promotes an existing account, matching the normalized email exactly", async () => {
    const { prisma, service } = make("  Owner@Example.com ", { id: "u1", role: "customer" });
    await service.onApplicationBootstrap();
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { email: "owner@example.com" } });
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "admin" } });
  });

  it("skips addresses without an account (never creates or claims one)", async () => {
    const { prisma, service } = make("nobody@example.com", null);
    await service.onApplicationBootstrap();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("leaves existing admins untouched and ignores an empty setting", async () => {
    const a = make("owner@example.com", { id: "u1", role: "admin" });
    await a.service.onApplicationBootstrap();
    expect(a.prisma.user.update).not.toHaveBeenCalled();
    const b = make("", null);
    await b.service.onApplicationBootstrap();
    expect(b.prisma.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("email normalization at the API boundary", () => {
  it.each([RegisterDto, LoginDto])("%p trims and lowercases the email", (Dto) => {
    const dto = plainToInstance(Dto, { email: "  Maria.K@Example.COM ", password: "whatever123" });
    expect(dto.email).toBe("maria.k@example.com");
  });
});
