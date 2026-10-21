import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import {
  Observable,
  catchError,
  tap,
  throwError,
} from 'rxjs';
import { ApiKeysService } from './api-keys.service';

@Injectable()
export class ApiRequestLoggingInterceptor
  implements NestInterceptor
{
  constructor(
    private readonly apiKeys: ApiKeysService,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> {
    const http =
      context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const auth = request.apiKeyAuth;
    const startedAt =
      request.apiRequestStartedAt ??
      Date.now();

    return next.handle().pipe(
      tap(() => {
        if (!auth?.logId) return;

        void this.apiKeys.completeRequest(
          auth.logId,
          response.statusCode ?? 200,
          Date.now() - startedAt,
          request.apiArtifactId ?? null,
        );
      }),
      catchError((error) => {
        if (auth?.logId) {
          const statusCode =
            typeof error?.getStatus ===
            'function'
              ? error.getStatus()
              : 500;

          void this.apiKeys.completeRequest(
            auth.logId,
            statusCode,
            Date.now() - startedAt,
            request.apiArtifactId ?? null,
          );
        }

        return throwError(() => error);
      }),
    );
  }
}
