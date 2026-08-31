import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Express's default JSON body limit is 100kb — fine for every other
  // endpoint, but Scan sends a real phone photo as a base64 string in the
  // JSON body (POST /scan/photo). A single uncompressed-ish photo at
  // ImagePicker's quality: 0.7 can be several MB before base64's ~33%
  // inflation, so the default limit was silently rejecting every real photo
  // with "request entity too large" — surfaced to the user as a generic
  // "Something went wrong analysing that photo." Raised well above any
  // realistic phone photo; every other endpoint's payloads are tiny by
  // comparison, so this is a ceiling, not a change in normal behaviour.
  app.use(json({ limit: '25mb' }));
  app.use(urlencoded({ extended: true, limit: '25mb' }));
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
  //
  // WEB_APP_URL accepts a comma-separated list so production (the Vercel
  // domain) and any preview/staging origin can be allowed at once; the
  // localhost entries stay for local dev. The deployed customer web app
  // actually reaches the API server-to-server (Next.js Route Handlers /
  // Server Components), which is not CORS-checked at all — this list only
  // matters for real browser-origin callers.
  const configuredOrigins = (process.env.WEB_APP_URL ?? 'http://localhost:3100')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: [...new Set([...configuredOrigins, 'http://localhost:3100', 'http://localhost:8081'])],
    credentials: true,
  });
  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  // Bind 0.0.0.0 explicitly — managed container platforms (Render, Fly, …)
  // route external traffic to the container's published port on all
  // interfaces, and some Node versions default `listen` to IPv6-only.
  await app.listen(port, '0.0.0.0');
}

bootstrap();
