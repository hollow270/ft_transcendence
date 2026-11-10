import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

@Injectable()
export class ApiKeyGuard
  implements CanActivate
{
  constructor(
    private readonly apiKeys: ApiKeysService,
  ) {}

  async canActivate(
    context: ExecutionContext,
  ) {
    const request =
      context.switchToHttp().getRequest();

    const header =
      request.headers['x-api-key'];
    const plaintext =
      typeof header === 'string'
        ? header
        : Array.isArray(header)
          ? header[0]
          : undefined;

    request.apiKeyAuth =
      await this.apiKeys.authenticateRequest(
        plaintext,
        request.method,
        request.originalUrl ??
          request.url ??
          '',
      );

    request.apiRequestStartedAt =
      Date.now();

    return true;
  }
}
