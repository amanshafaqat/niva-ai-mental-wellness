import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let message = 'An unexpected internal error occurred. Please try again later.';
    let errorCode = 'INTERNAL_ERROR';

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse
    ) {
      const respMsg = (exceptionResponse as { message: unknown }).message;
      message = Array.isArray(respMsg) ? respMsg.join(', ') : String(respMsg);
      errorCode =
        (exceptionResponse as { error?: string }).error?.toUpperCase().replace(/\s+/g, '_') ||
        errorCode;
    }

    // Never leak stack traces or internal exceptions to the client in production
    const isProd = process.env.NODE_ENV === 'production';
    this.logger.error(
      `[${request.method}] ${request.url} - Status: ${status} - Error: ${message}`,
      exception instanceof Error ? exception.stack : JSON.stringify(exception),
    );

    response.status(status).json({
      success: false,
      statusCode: status,
      errorCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
      ...(isProd ? {} : { details: exception instanceof Error ? exception.message : undefined }),
    });
  }
}
