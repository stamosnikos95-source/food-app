import { Module } from "@nestjs/common";
import { PaymentsModule } from "../payments/payments.module";
import { AdminController } from "./admin.controller";
import { AdminOrdersService } from "./admin-orders.service";
import { AdminMenuService } from "./admin-menu.service";
import { AdminReportsService } from "./admin-reports.service";
import { AdminKitchenController } from "./kitchen/admin-kitchen.controller";
import { AdminKitchenService } from "./kitchen/admin-kitchen.service";
import { AdminPeopleController } from "./people/admin-people.controller";
import { AdminOperationsController } from "./operations/admin-operations.controller";
import { AdminInventoryService } from "./operations/admin-inventory.service";
import { AdminPlanningService } from "./operations/admin-planning.service";
import { AdminCustomersService } from "./people/admin-customers.service";
import { AdminCompaniesService } from "./people/admin-companies.service";

@Module({
  imports: [PaymentsModule],
  controllers: [AdminController, AdminKitchenController, AdminPeopleController, AdminOperationsController],
  providers: [AdminOrdersService, AdminMenuService, AdminReportsService, AdminKitchenService, AdminCustomersService, AdminCompaniesService, AdminInventoryService, AdminPlanningService],
})
export class AdminModule {}
