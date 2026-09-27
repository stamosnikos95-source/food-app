import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { Request } from "express";
import { AuthUser } from "@food-app/shared-types";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PaymentsService } from "./payments.service";
import { StartCheckoutDto } from "./dto/start-checkout.dto";
import { ConfirmCheckoutDto } from "./dto/confirm-checkout.dto";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get("config")
  config() {
    return this.payments.getPublicConfig();
  }

  @UseGuards(JwtAuthGuard)
  @Post("checkout")
  @HttpCode(HttpStatus.OK)
  startCheckout(@Req() request: Request & { user: AuthUser }, @Body() dto: StartCheckoutDto) {
    return this.payments.startCheckout(request.user.id, dto.orderId);
  }

  @UseGuards(JwtAuthGuard)
  @Post("confirm")
  @HttpCode(HttpStatus.OK)
  confirm(@Req() request: Request & { user: AuthUser }, @Body() dto: ConfirmCheckoutDto) {
    return this.payments.confirmReturn(request.user.id, dto.sessionId);
  }

  /** Public, but only accepts payloads signed with the webhook secret. */
  // Stripe retries bursts from shared IPs; signatures, not rate limits, protect it.
  @SkipThrottle()
  @Post("webhooks/stripe")
  @HttpCode(HttpStatus.OK)
  async stripeWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature?: string,
  ) {
    await this.payments.handleWebhook(request.rawBody, signature);
    return { received: true };
  }
}
