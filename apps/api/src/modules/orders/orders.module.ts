import { Module } from "@nestjs/common";
import { OrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";
import { PaymentsModule } from "../payments/payments.module";
import { CompaniesModule } from "../companies/companies.module";
import { LoyaltyModule } from "../loyalty/loyalty.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { GymsModule } from "../gyms/gyms.module";

@Module({
  imports: [PaymentsModule, CompaniesModule, LoyaltyModule, SubscriptionsModule, GymsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
