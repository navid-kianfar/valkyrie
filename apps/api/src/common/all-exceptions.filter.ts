import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      message = typeof body === 'string' ? body : ((body as { message?: string | string[]; error?: string }).message as string | string[] ? (Array.isArray((body as { message?: string[] }).message) ? (body as { message: string[] }).message.join('; ') : String((body as { message?: string }).message ?? exception.message)) : exception.message);
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.stack || exception.message);
    }
    res.status(status).json({ statusCode: status, message });
  }
}
