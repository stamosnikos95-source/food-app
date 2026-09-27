import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuthUser } from "@food-app/shared-types";
import { PrismaService } from "../../../prisma/prisma.service";
import { AuditService } from "../../audit/audit.service";
import { businessMonth, businessMonthKey } from "../../companies/business-time";
import { isValidGreekVat, normalizeGreekVat } from "../../companies/greek-vat";
import { CompanyDto, UpdateCompanyDto } from "./people.dto";

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

@Injectable()
export class AdminCompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(now = new Date()) {
    const companies = await this.prisma.company.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { members: true } } },
    });
    const { start, end } = businessMonth(businessMonthKey(now));
    const sums = await this.prisma.order.groupBy({
      by: ["companyId"],
      where: { companyId: { in: companies.map((c) => c.id) }, status: { not: "cancelled" }, createdAt: { gte: start, lt: end } },
      _sum: { companyPaidCents: true },
    });
    const monthToDate = new Map(sums.map((s) => [s.companyId, s._sum?.companyPaidCents ?? 0]));
    return companies.map(({ _count, ...c }) => ({ ...c, members: _count.members, monthToDateCents: monthToDate.get(c.id) ?? 0 }));
  }

  async detail(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { members: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, email: true } } } } },
    });
    if (!company) throw new NotFoundException("Company not found");
    const { members, ...rest } = company;
    return { ...rest, members: members.map((m) => ({ userId: m.user.id, email: m.user.email, since: m.createdAt })) };
  }

  async create(dto: CompanyDto, actor: AuthUser) {
    const vatNumber = this.checkedVat(dto.vatNumber);
    try {
      const company = await this.prisma.company.create({ data: { ...dto, name: dto.name.trim(), vatNumber } });
      await this.audit.record(actor.id, "company.created", "company", company.id, { name: company.name });
      return this.detail(company.id);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("A company with this VAT number already exists");
      throw error;
    }
  }

  async update(id: string, dto: UpdateCompanyDto, actor: AuthUser) {
    await this.detail(id);
    const data = { ...dto, ...(dto.vatNumber !== undefined ? { vatNumber: this.checkedVat(dto.vatNumber) } : {}) };
    try {
      await this.prisma.company.update({ where: { id }, data });
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("A company with this VAT number already exists");
      throw error;
    }
    await this.audit.record(actor.id, "company.updated", "company", id, { fields: Object.keys(dto) });
    return this.detail(id);
  }

  async addMember(companyId: string, email: string, actor: AuthUser) {
    await this.detail(companyId);
    const user = await this.prisma.user.findUnique({ where: { email }, include: { companyMembership: true } });
    if (!user) throw new NotFoundException("No account with this email: the employee must register in the app first");
    if (user.companyMembership) {
      throw new ConflictException(
        user.companyMembership.companyId === companyId ? "Already a member of this company" : "This person belongs to another company",
      );
    }
    await this.prisma.companyMember.create({ data: { companyId, userId: user.id } });
    await this.audit.record(actor.id, "company.member_added", "company", companyId, { userId: user.id });
    return this.detail(companyId);
  }

  async removeMember(companyId: string, userId: string, actor: AuthUser) {
    const removed = await this.prisma.companyMember.deleteMany({ where: { companyId, userId } });
    if (removed.count === 0) throw new NotFoundException("Not a member of this company");
    await this.audit.record(actor.id, "company.member_removed", "company", companyId, { userId });
    return this.detail(companyId);
  }

  /** What to invoice the company for a month (Athens calendar month). */
  async statement(companyId: string, month: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException("Company not found");
    const { start, end } = businessMonth(month);
    const orders = await this.prisma.order.findMany({
      where: { companyId, status: { not: "cancelled" }, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, totalPriceCents: true, companyPaidCents: true, user: { select: { email: true } } },
    });
    const companyCents = orders.reduce((s, o) => s + o.companyPaidCents, 0);
    const totalCents = orders.reduce((s, o) => s + o.totalPriceCents, 0);
    return {
      company: { id: company.id, name: company.name, vatNumber: company.vatNumber, billingEmail: company.billingEmail },
      month,
      orders: orders.map((o) => ({
        id: o.id, createdAt: o.createdAt, employee: o.user.email, totalPriceCents: o.totalPriceCents, companyPaidCents: o.companyPaidCents,
      })),
      totals: { orders: orders.length, companyCents, employeeCents: totalCents - companyCents },
    };
  }

  private checkedVat(input: string): string {
    if (!isValidGreekVat(input)) throw new BadRequestException("Invalid Greek VAT number (ΑΦΜ)");
    return normalizeGreekVat(input);
  }
}
