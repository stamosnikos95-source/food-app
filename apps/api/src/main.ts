import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
