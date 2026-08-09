import { STATUS_CODES } from 'node:http';

import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ApiErrorResponse } from '@office/shared';
import type { FastifyReply } from 'fastify';

interface NestErrorBody {
  message?: string | string[];
  error?: string;
}

/**
 * Translates every thrown error into the single API error format:
 * `{ statusCode, message, error }`.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const body = exception.getResponse();
      // Prefer the standard HTTP reason phrase (e.g. "Bad Request") as the
      // error label; fall back to the exception class name. Fastify 5 surfaces
      // a malformed/empty JSON body as a generic HttpException (whose stripped
      // name is the unhelpful "Http"), so the status text is the better label.
      const fallbackError = STATUS_CODES[statusCode] ?? exception.name.replace(/Exception$/, '');
      if (typeof body === 'string') {
        message = body;
        error = fallbackError;
      } else {
        const nestBody = body as NestErrorBody;
        message = Array.isArray(nestBody.message)
          ? nestBody.message.join('; ')
          : (nestBody.message ?? exception.message);
        error = nestBody.error ?? fallbackError;
      }
    } else {
      const clientStatus = clientErrorStatus(exception);
      if (clientStatus !== undefined) {
        // Framework errors (e.g. Fastify's body parser rejecting an empty JSON
        // body) aren't HttpExceptions but carry a real 4xx status. Surface it
        // truthfully instead of masking every one as a 500.
        statusCode = clientStatus;
        error = STATUS_CODES[clientStatus] ?? 'Error';
        message = exception instanceof Error && exception.message ? exception.message : error;
        this.logger.warn(`${statusCode} ${error}: ${message}`);
      } else {
        // Unrecognized error: a genuine server fault. Keep the opaque 500 body
        // (don't leak internals) and log the stack for debugging.
        this.logger.error(
          exception instanceof Error ? (exception.stack ?? exception.message) : String(exception),
        );
      }
    }

    const payload: ApiErrorResponse = { statusCode, message, error };
    void reply.status(statusCode).send(payload);
  }
}

/**
 * A 4xx HTTP status carried by a non-HttpException error (Fastify sets
 * `statusCode`; some libraries use `status`), or undefined when there is no
 * client-error status to trust — server faults must stay opaque 500s.
 */
function clientErrorStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) {
    return undefined;
  }
  const record = exception as { statusCode?: unknown; status?: unknown };
  const code = typeof record.statusCode === 'number' ? record.statusCode : record.status;
  if (typeof code !== 'number') {
    return undefined;
  }
  return code >= 400 && code < 500 ? code : undefined;
}
