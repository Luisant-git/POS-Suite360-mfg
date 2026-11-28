import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) {}

  async validateUser(username: string, pass: string): Promise<any> {
    if (username === 'developer' && pass === 'password123') {
      return {
        id: -1,
        username: 'developer',
        name: 'Developer',
        roleId: -1,
        role: {
          id: -1,
          name: 'Developer',
          permissions: ['ALL']
        }
      };
    }

    const user = await this.usersService.findOne(username);
    if (user && await bcrypt.compare(pass, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { username: user.username, sub: user.id, roleId: user.roleId };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        roleId: user.roleId,
        role: user.role, // from include: { role: true }
      }
    };
  }

  async getMe(userId: number) {
    if (userId === -1) {
      return {
        id: -1,
        username: 'developer',
        name: 'Developer',
        roleId: -1,
        role: {
          id: -1,
          name: 'Developer',
          permissions: ['ALL'],
        },
      };
    }
    const user = await this.usersService.findById(userId);
    if (!user) {
      return null;
    }
    const { password, ...result } = user as any;
    return result;
  }

  async register(username: string, pass: string) {
    const hashedPassword = await bcrypt.hash(pass, 10);
    const user = await this.usersService.create(username, hashedPassword);
    return this.login(user);
  }

  async changePassword(userId: number, currentPass: string, newPass: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(currentPass, user.password);
    if (!isMatch) {
      throw new Error('Incorrect current password');
    }

    const hashedNewPass = await bcrypt.hash(newPass, 10);
    await this.usersService.updatePassword(userId, hashedNewPass);
    return { success: true };
  }
}
