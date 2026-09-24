import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { Request } from "express";
import { AuthUser } from "@food-app/shared-types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { OrdersService } from "./orders.service";
import { CreateOrderDto } from "./dto/create-order.dto";

@UseGuards(JwtAuthGuard)
@Controller("orders")
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  create(@Req() request: Request & { user: AuthUser }, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(request.user.id, dto);
  }

  @Get()
  list(@Req() request: Request & { user: AuthUser }) {
    return this.ordersService.listForUser(request.user.id);
  }

  @Get(":id")
  findOne(@Req() request: Request & { user: AuthUser }, @Param("id") id: string) {
    return this.ordersService.findOne(request.user.id, id);
  }
}
