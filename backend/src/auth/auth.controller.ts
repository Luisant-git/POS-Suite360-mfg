import { Controller, Request, Get, Post, UseGuards, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LocalAuthGuard } from './local-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@Request() req: any) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    const userId = req.user.userId || req.user.sub;
    return this.authService.getMe(Number(userId));
  }

  @Post('register')
  async register(@Body() body: any) {
    try {
      return await this.authService.register(body.username, body.password);
    } catch (e: any) {
      return { error: e.message, stack: e.stack };
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@Request() req: any, @Body() body: any) {
    try {
      const userId = req.user.userId || req.user.sub;
      return await this.authService.changePassword(userId, body.currentPassword, body.newPassword);
    } catch (e: any) {
      return { error: e.message };
    }
  }
}
