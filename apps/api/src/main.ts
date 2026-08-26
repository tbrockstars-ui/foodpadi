import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // credentials: true is required for the web app's httpOnly session
  // cookies to be sent cross-origin (api runs on a different port/origin
  // than the Next.js web app). Native mobile is unaffected — RN fetch isn't
  // browser-CORS-checked and never sends cookies — but Expo's web build
  // (`expo start --web`, used for browser-based testing of the mobile app)
  // runs in an actual browser and IS CORS-checked, so its dev origin needs
  // to be allowed too.
  app.enableCors({
    origin: [process.env.WEB_APP_URL ?? 'http://localhost:3100', 'http://localhost:8081'],
    credentials: true,
  });
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
}

bootstrap();
