import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOne(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { username },
      include: { role: true },
    });
  }

  async findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
  }

  async findAll() {
    return this.prisma.user.findMany({
      include: { role: true },
    });
  }

  async create(username: string, pass: string): Promise<User> {
    let role = await this.prisma.role.findFirst();
    if (!role) {
      role = await this.prisma.role.create({
        data: { name: 'Admin', permissions: ['ALL'] }
      });
    }

    return this.prisma.user.upsert({
      where: { username },
      update: {
        password: pass,
        roleId: role.id,
      },
      create: {
        username,
        password: pass,
        name: username,
        roleId: role.id,
      },
      include: { role: true },
    });
  }

  async createUser(data: any) {
    const { username, password, name, roleId } = data;
    return this.prisma.user.create({
      data: {
        username,
        password,
        name,
        roleId: Number(roleId),
      },
      include: { role: true },
    });
  }

  async updatePassword(userId: number, hash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: hash },
    });
  }

  async updateUser(id: number, data: any) {
    const { id: _ignoredId, ...rest } = data || {};
    const updateData: any = { ...rest };
    if (updateData.roleId !== undefined && updateData.roleId !== '') {
      updateData.roleId = Number(updateData.roleId);
    }
    if (!updateData.password || String(updateData.password).trim() === '') {
      delete updateData.password;
    }
    return this.prisma.user.update({
      where: { id },
      data: updateData,
      include: { role: true },
    });
  }

  async deleteUser(id: number) {
    return this.prisma.user.delete({
      where: { id },
    });
  }
}
