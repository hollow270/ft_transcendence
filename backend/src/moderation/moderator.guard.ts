import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

@Injectable()
export class ModeratorGuard
  implements CanActivate
{
  canActivate(
    context: ExecutionContext,
  ) {
    const request =
      context.switchToHttp().getRequest();
    const role = request.user?.role;

    if (
      role !== UserRole.MODERATOR &&
      role !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'moderator or admin role required',
      );
    }

    return true;
  }
}
