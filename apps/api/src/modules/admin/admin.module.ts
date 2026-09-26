import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module";
import { AdminController } from "./admin.controller";
import { AdminOrdersService } from "./admin-orders.service";
import { AdminMenuService } from "./admin-menu.service";
import { AdminReportsService } from "./admin-reports.service";

@Module({
  imports: [PaymentsModule],
  controllers: [AdminController],
  providers: [AdminOrdersService, AdminMenuService, AdminReportsService],
})
export class AdminModule {}
