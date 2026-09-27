import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module";
import { AdminController } from "./admin.controller";
import { AdminOrdersService } from "./admin-orders.service";
import { AdminMenuService } from "./admin-menu.service";
import { AdminReportsService } from "./admin-reports.service";
import { AdminKitchenController } from "./kitchen/admin-kitchen.controller";
import { AdminKitchenService } from "./kitchen/admin-kitchen.service";

@Module({
  imports: [PaymentsModule],
  controllers: [AdminController, AdminKitchenController],
  providers: [AdminOrdersService, AdminMenuService, AdminReportsService, AdminKitchenService],
})
export class AdminModule {}
