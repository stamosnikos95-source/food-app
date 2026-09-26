import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { AuthUser } from "@food-app/shared-types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";
import { PaymentsService } from "../payments/payments.service";

@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly payments: PaymentsService,
  ) {}

  @Post()
  create(@Req() request: Request & { user: AuthUser }, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(request.user.id, dto);
  }

  @Get()
  async list(@Req() request: Request & { user: AuthUser }) {
    // Picks up payments completed by customers who closed the tab before
    // being redirected back, so their history never shows a paid order as unpaid.
    await this.payments.reconcilePendingForUser(request.user.id);
    return this.ordersService.listForUser(request.user.id);
  }

  @Get(":id")
  findOne(@Req() request: Request & { user: AuthUser }, @Param("id") id: string) {
    return this.ordersService.findOne(request.user.id, id);
  }
}
