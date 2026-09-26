import { ConfigService } from "@nestjs/config";
import { AdminBootstrapService, maskEmail } from "./admin-bootstrap.service";
import { PrismaService } from "../../prisma/prisma.service";

describe("AdminBootstrapService", () => {
  it("promotes existing accounts listed in ADMIN_EMAILS and skips unknown ones", async () => {
    const prisma = { user: {
      findFirst: jest.fn().mockResolvedValueOnce({ id: "u1", role: "customer" }).mockResolvedValueOnce(null),
      update: jest.fn() } };
    const config = { get: () => " Owner@Example.com , nobody@example.com " } as unknown as ConfigService;

    await new AdminBootstrapService(prisma as unknown as PrismaService, config).onApplicationBootstrap();

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "Owner@Example.com", mode: "insensitive" } } });
    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u1" }, data: { role: "admin" } });
  });

  it("masks emails in logs", () => {
    expect(maskEmail("stamos@example.com")).toBe("st***@example.com");
  });
});
