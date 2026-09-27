import { CompanyAllowanceService } from "./company-allowance.service";
import { PrismaService } from "../../prisma/prisma.service";

function tx(member: unknown, usedCents: number, locked = true) {
  return {
    $queryRaw: jest.fn().mockResolvedValue(locked ? [{ id: "cm1" }] : []),
    companyMember: { findUnique: jest.fn().mockResolvedValue(member) },
    order: { aggregate: jest.fn().mockResolvedValue({ _sum: { companyPaidCents: usedCents } }) },
  };
}
const member = (dailyAllowanceCents: number, isActive = true) => ({
  companyId: "c1",
  company: { name: "Acme", dailyAllowanceCents, isActive },
});

describe("CompanyAllowanceService.claimForOrder", () => {
  const service = new CompanyAllowanceService({} as PrismaService);

  it("covers up to what's left of today's allowance", async () => {
    const t = tx(member(800), 300);
    expect(await service.claimForOrder(t as never, "u1", 850)).toEqual({ companyId: "c1", cents: 500 });
    // today's usage excludes cancelled orders and is bounded to the Athens day
    const where = t.order.aggregate.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: "u1", companyId: "c1", status: { not: "cancelled" } });
    expect(where.createdAt.gte).toBeInstanceOf(Date);
  });

  it("never covers more than the order itself", async () => {
    expect(await service.claimForOrder(tx(member(800), 0) as never, "u1", 650)).toEqual({ companyId: "c1", cents: 650 });
  });

  it("gives nothing when the allowance is used up, the company is inactive, or there is no membership", async () => {
    expect(await service.claimForOrder(tx(member(800), 800) as never, "u1", 500)).toEqual({ companyId: null, cents: 0 });
    expect(await service.claimForOrder(tx(member(800, false), 0) as never, "u1", 500)).toEqual({ companyId: null, cents: 0 });
    const none = tx(null, 0, false);
    expect(await service.claimForOrder(none as never, "u1", 500)).toEqual({ companyId: null, cents: 0 });
    expect(none.companyMember.findUnique).not.toHaveBeenCalled();
  });

  it("locks the membership row before reading today's usage", async () => {
    const t = tx(member(800), 0);
    await service.claimForOrder(t as never, "u1", 500);
    const sql = (t.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join("?");
    expect(sql).toContain("FOR UPDATE");
    expect(t.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(t.order.aggregate.mock.invocationCallOrder[0]);
  });
});
