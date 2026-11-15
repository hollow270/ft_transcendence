import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { loadFileSecrets } from './security/file-secrets';

async function bootstrap() {
  loadFileSecrets();

  const app =
    await NestFactory.create<NestExpressApplication>(
      AppModule,
    );
  const port = Number(
    process.env.PORT ?? 3000,
  );

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
    }),
  );

  const allowedOrigins = (
    process.env.APP_ALLOWED_ORIGINS ??
    'http://localhost:5173,http://127.0.0.1:5173,http://localhost:8080,http://127.0.0.1:8080'
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  app.enableCors({
    origin(origin, callback) {
      if (
        !origin ||
        allowedOrigins.includes(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(
        new Error(
          'origin is not allowed by CORS policy',
        ),
        false,
      );
    },
    methods: [
      'GET',
      'HEAD',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
    ],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-API-Key',
    ],
    maxAge: 600,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(port, '0.0.0.0');
  console.log(
    'Backend running on http://localhost:' +
      port,
  );
}

bootstrap();
