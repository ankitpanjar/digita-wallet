import { CallHandler, ExecutionContext, HttpException, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

/**
 * The single place requests are logged (registered globally as APP_INTERCEPTOR):
 * "Controller.handler METHOD /path -> status Nms [user=id]". Expected HTTP errors are warnings,
 * unexpected ones are errors with a stack. Query strings and bodies are never logged (may hold PII).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();
    const start = Date.now();
    const describe = (status: number) => {
      const user = req.user?.id ? ` user=${req.user.id}` : '';
      return `${context.getClass().name}.${context.getHandler().name} ${req.method} ${req.originalUrl.split('?')[0]} -> ${status} ${Date.now() - start}ms${user}`;
    };

    return next.handle().pipe(
      tap(() => this.logger.log(describe(res.statusCode))),
      catchError((err) => {
        if (err instanceof HttpException) {
          this.logger.warn(`${describe(err.getStatus())} (${err.message})`);
        } else {
          this.logger.error(`${describe(500)} (${err?.message})`, err?.stack);
        }
        return throwError(() => err);
      }),
    );
  }
}
