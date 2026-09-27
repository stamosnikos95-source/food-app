import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import helmet from "helmet";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  // rawBody: payment webhooks are verified against the exact bytes received.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Render terminates TLS at its proxy: trust one hop so request.ip is the
  // real client. Without this, rate limits would lump every user together.
  app.set("trust proxy", 1);
  // Security headers (HSTS, no-sniff, frame denial...). JSON-only API, so the
  // defaults cost nothing.
  app.use(helmet());

  app.enableCors({
    // Public API consumed by a browser-hosted preview at a different
    // origin; auth-required routes still need a valid JWT regardless of
    // origin, so this doesn't weaken access control. Worth narrowing to
    // known origins once there's a fixed production domain.
    origin: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix("api/v1");

  const config = app.get(ConfigService);
  const port = config.get<number>("PORT") ?? 3000;

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on port ${port}`);
}

bootstrap();
