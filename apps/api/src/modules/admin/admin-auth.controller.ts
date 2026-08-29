import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AdminApiGuard } from './admin-api.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';

// Guarded by AdminApiGuard like every other /admin/* route: the caller is
// always apps/web's server-side login route, never a browser directly, so
// the shared secret still applies here even though this endpoint is itself
// a login step (see AdminApiGuard's own doc comment for that trust model).
@Controller('admin/auth')
@UseGuards(AdminApiGuard)
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: AdminLoginDto) {
    return this.adminAuthService.login(dto);
  }
}
