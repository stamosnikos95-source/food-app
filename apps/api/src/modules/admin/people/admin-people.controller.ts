import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { AuthUser, Role } from "@food-app/shared-types";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import { AdminCustomersService } from "./admin-customers.service";
import { AdminCompaniesService } from "./admin-companies.service";
import { AddMemberDto, CompanyDto, ListCustomersQuery, SetRoleDto, StatementQuery, UpdateCompanyDto } from "./people.dto";

type AuthedRequest = Request & { user: AuthUser };

/** Customer accounts, roles and corporate clients: admins only. */
@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminPeopleController {
  constructor(
    private readonly customers: AdminCustomersService,
    private readonly companies: AdminCompaniesService,
  ) {}

  @Get("customers")
  listCustomers(@Query() query: ListCustomersQuery) {
    return this.customers.list(query);
  }

  @Get("customers/:id")
  customer(@Param("id", ParseUUIDPipe) id: string, @Req() req: AuthedRequest) {
    return this.customers.detail(id, req.user);
  }

  @Patch("customers/:id/role")
  setRole(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SetRoleDto, @Req() req: AuthedRequest) {
    return this.customers.setRole(id, dto.role, req.user);
  }

  @Get("companies")
  listCompanies() {
    return this.companies.list();
  }

  @Post("companies")
  createCompany(@Body() dto: CompanyDto, @Req() req: AuthedRequest) {
    return this.companies.create(dto, req.user);
  }

  @Get("companies/:id")
  company(@Param("id", ParseUUIDPipe) id: string) {
    return this.companies.detail(id);
  }

  @Patch("companies/:id")
  updateCompany(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateCompanyDto, @Req() req: AuthedRequest) {
    return this.companies.update(id, dto, req.user);
  }

  @Post("companies/:id/members")
  addMember(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AddMemberDto, @Req() req: AuthedRequest) {
    return this.companies.addMember(id, dto.email, req.user);
  }

  @Delete("companies/:id/members/:userId")
  removeMember(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Req() req: AuthedRequest,
  ) {
    return this.companies.removeMember(id, userId, req.user);
  }

  @Get("companies/:id/statement")
  statement(@Param("id", ParseUUIDPipe) id: string, @Query() query: StatementQuery) {
    return this.companies.statement(id, query.month);
  }
}
