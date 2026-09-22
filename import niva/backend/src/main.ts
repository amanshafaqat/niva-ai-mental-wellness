import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('NivaBootstrap');
  const app = await NestFactory.create(AppModule, {
    logger:
      process.env.NODE_ENV === 'production'
        ? ['error', 'warn', 'log']
        : ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const port = process.env.PORT || 3000;
  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';

  // Security: CORS configuration
  app.enableCors({
    origin: corsOrigin.split(','),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: 'Content-Type, Accept, Authorization, X-Requested-With',
  });

  // Global validation and sanitization pipeline
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  // Global exception filter for sanitized, uniform error formatting
  app.useGlobalFilters(new HttpExceptionFilter());

  // Set global API prefix while allowing root /health check
  app.setGlobalPrefix('api', {
    exclude: ['health'],
  });

  await app.listen(port, '0.0.0.0');
  logger.log(`🌿 NIVA NestJS Backend running on port ${port}`);
  logger.log(`🛡️  Health check endpoint available at: http://localhost:${port}/health`);
  logger.log(`🔒 RBAC & Google OAuth architecture active (Phase 1)`);
}

if (process.env.NEST_STANDALONE === 'true') {
  bootstrap();
}

export { bootstrap };
