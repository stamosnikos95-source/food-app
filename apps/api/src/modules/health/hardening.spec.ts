import { Controller, Get, INestApplication, ServiceUnavailableException } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Throttle, ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";
import { HealthController } from "./health.controller";

@Controller("login")
class FakeLoginController {
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Get()
  attempt() {
    return { ok: true };
  }
}

describe("rate limiting", () => {
  let app: INestApplication;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 100 }])],
      controllers: [FakeLoginController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  afterAll(() => app.close());

  it("rejects the 4th attempt within a minute with 429", async () => {
    for (let i = 0; i < 3; i++) await request(app.getHttpServer()).get("/login").expect(200);
    await request(app.getHttpServer()).get("/login").expect(429);
  });
});

describe("HealthController", () => {
  it("reports the database status", async () => {
    const ok = new HealthController({ $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]) } as never);
    expect(await ok.check()).toMatchObject({ status: "ok", db: "up" });
    const down = new HealthController({ $queryRaw: jest.fn().mockRejectedValue(new Error("no db")) } as never);
    await expect(down.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
