import { Module } from "@nestjs/common";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { PAYMENT_PROVIDER } from "./providers/payment-provider";
import { StripePaymentProvider } from "./providers/stripe-payment.provider";

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    StripePaymentProvider,
    { provide: PAYMENT_PROVIDER, useExisting: StripePaymentProvider },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
