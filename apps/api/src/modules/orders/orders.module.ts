import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PaymentsModule } from "../payments/payments.module";
import { CompaniesModule } from "../companies/companies.module";

@Module({
  imports: [PaymentsModule, CompaniesModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
