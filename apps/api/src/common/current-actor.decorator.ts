import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestActor } from '../modules/auth/guest-or-auth.guard';

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestActor => {
    const request = ctx.switchToHttp().getRequest();
    return request.actor;
  },
);
