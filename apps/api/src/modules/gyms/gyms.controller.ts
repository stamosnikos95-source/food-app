import { Controller, Get, Param } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { GymsService } from "./gyms.service";

/** Public on purpose: a scan happens before the customer has signed in. */
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller("gyms")
export class GymsController {
  constructor(private readonly gyms: GymsService) {}

  @Get("by-code/:code")
  lookup(@Param("code") code: string) {
    return this.gyms.lookup(String(code).toLowerCase().slice(0, 32));
  }
}
