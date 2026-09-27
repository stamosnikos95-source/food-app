import { ConflictException, ForbiddenException } from "@nestjs/common";
import * as argon2 from "argon2";
import { UsersService } from "./users.service";

async function setup(openOrders = 0) {
  const passwordHash = await argon2.hash("correct-password");
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ id: "u1", email: "maria@example.com", passwordHash }), update: jest.fn((a) => a) },
    order: { count: jest.fn().mockResolvedValue(openOrders) },
    subscription: { updateMany: jest.fn((a) => a) },
    customerProfile: { deleteMany: jest.fn((a) => a) },
    companyMember: { deleteMany: jest.fn((a) => a) },
    refreshToken: { deleteMany: jest.fn((a) => a) },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  };
  const audit = { record: jest.fn() };
  return { prisma, audit, service: new UsersService(prisma as never, audit as never) };
}

describe("account deletion (GDPR right to erasure)", () => {
  it("requires the password again", async () => {
    const { service, prisma } = await setup();
    await expect(service.deleteAccount("u1", "wrong")).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("waits until no order is in progress", async () => {
    const { service, prisma } = await setup(1);
    await expect(service.deleteAccount("u1", "correct-password")).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("anonymises the account: personal data goes, accounting records stay", async () => {
    const { service, prisma, audit } = await setup();
    await service.deleteAccount("u1", "correct-password");

    expect(prisma.customerProfile.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(prisma.companyMember.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "u1" } });
    expect(prisma.subscription.updateMany).toHaveBeenCalledWith({ where: { userId: "u1", status: { in: ["pending", "active"] } }, data: { status: "cancelled" } });
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.email).toBe("deleted-u1@deleted.invalid");
    // still a valid hash, so a login attempt simply fails instead of erroring
    expect(data.passwordHash).toMatch(/^\$argon2/);
    expect(await argon2.verify(data.passwordHash, "correct-password")).toBe(false);
    expect(audit.record).toHaveBeenCalledWith("u1", "user.deleted_self", "user", "u1");
  });
});
