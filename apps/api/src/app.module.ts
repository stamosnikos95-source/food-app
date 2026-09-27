import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { HealthModule } from "./modules/health/health.module";
import { AnalyticsModule } from "./modules/admin/analytics/analytics.module";
import { envValidationSchema } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { RecommendationsModule } from "./modules/recommendations/recommendations.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { LoyaltyModule } from "./modules/loyalty/loyalty.module";
import { SubscriptionsModule } from "./modules/subscriptions/subscriptions.module";
import { GymsModule } from "./modules/gyms/gyms.module";
import { MenuModule } from "./modules/menu/menu.module";
import { OrdersModule } from "./modules/orders/orders.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { AuditModule } from "./modules/audit/audit.module";
import { AdminModule } from "./modules/admin/admin.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

@Module({
  imports: [
    // Per-client rate limit; stricter limits on auth and public endpoints.
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 120 }]),
    HealthModule,
    AnalyticsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    RecommendationsModule,
    CompaniesModule,
    LoyaltyModule,
    SubscriptionsModule,
    GymsModule,
    MenuModule,
    OrdersModule,
    PaymentsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {}
