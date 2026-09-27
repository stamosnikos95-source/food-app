import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { AdminCustomersService } from "./admin-customers.service";
import { AdminCompaniesService } from "./admin-companies.service";

const admin = { id: "admin-1", email: "owner@example.com", role: "admin" } as never;

describe("AdminCustomersService.setRole", () => {
  const setup = (target: unknown, adminCount = 2) => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(target),
        count: jest.fn().mockResolvedValue(adminCount),
        update: jest.fn(),
      },
      order: { groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]) },
      loyaltyEntry: { aggregate: jest.fn().mockResolvedValue({ _sum: { points: 0 } }) },
    };
    const audit = { record: jest.fn() };
    return { prisma, audit, service: new AdminCustomersService(prisma as never, audit as never) };
  };

  it("won't let an admin remove their own admin role", async () => {
    const { service, prisma } = setup({ id: "admin-1", role: "admin" });
    await expect(service.setRole("admin-1", "staff", admin)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("keeps at least one admin", async () => {
    const { service, prisma } = setup({ id: "other", role: "admin" }, 1);
    await expect(service.setRole("other", "customer", admin)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("promotes a customer to staff and audits it", async () => {
    const { service, prisma, audit } = setup({ id: "u2", role: "customer", email: "cook@example.com", createdAt: new Date() });
    await service.setRole("u2", "staff", admin);
    expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: "u2" }, data: { role: "staff" } });
    expect(audit.record).toHaveBeenCalledWith("admin-1", "customer.role_changed", "user", "u2", { from: "customer", to: "staff" });
  });
});

describe("AdminCompaniesService", () => {
  const company = { id: "c1", name: "Acme", vatNumber: "123456783", billingEmail: "ap@acme.gr", members: [] };
  const setup = (user: unknown = null) => {
    const prisma = {
      company: { findUnique: jest.fn().mockResolvedValue(company), create: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      companyMember: { create: jest.fn() },
      order: {
        findMany: jest.fn().mockResolvedValue([
          { id: "o1", createdAt: new Date(), totalPriceCents: 850, companyPaidCents: 800, user: { email: "a@acme.gr" } },
          { id: "o2", createdAt: new Date(), totalPriceCents: 700, companyPaidCents: 700, user: { email: "b@acme.gr" } },
        ]),
      },
    };
    return { prisma, service: new AdminCompaniesService(prisma as never, { record: jest.fn() } as never) };
  };

  it("rejects an invalid ΑΦΜ before touching the database", async () => {
    const { service, prisma } = setup();
    await expect(
      service.create({ name: "Acme", vatNumber: "123456789", billingEmail: "ap@acme.gr", dailyAllowanceCents: 800 }, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.company.create).not.toHaveBeenCalled();
  });

  it("only adds employees who already have an account, and only to one company", async () => {
    await expect(setup(null).service.addMember("c1", "new@acme.gr", admin)).rejects.toBeInstanceOf(NotFoundException);
    const taken = setup({ id: "u9", companyMembership: { companyId: "other" } });
    await expect(taken.service.addMember("c1", "b@acme.gr", admin)).rejects.toBeInstanceOf(ConflictException);
    expect(taken.prisma.companyMember.create).not.toHaveBeenCalled();
  });

  it("totals a monthly statement: what the company owes vs what employees paid", async () => {
    const { service } = setup();
    const st = await service.statement("c1", "2026-09");
    expect(st.totals).toEqual({ orders: 2, companyCents: 1500, employeeCents: 50 });
    expect(st.orders[0]).toMatchObject({ employee: "a@acme.gr", companyPaidCents: 800 });
  });
});
