import { Module } from "@nestjs/common";
import { CompaniesController } from "./companies.controller";
import { CompanyAllowanceService } from "./company-allowance.service";

@Module({
  controllers: [CompaniesController],
  providers: [CompanyAllowanceService],
  exports: [CompanyAllowanceService],
})
export class CompaniesModule {}
