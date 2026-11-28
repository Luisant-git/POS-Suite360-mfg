import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.role.findMany({
      orderBy: { id: 'asc' },
    });
  }

  async findOne(id: number) {
    const role = await this.prisma.role.findUnique({
      where: { id },
    });
    if (!role) {
      throw new NotFoundException(`Role with ID ${id} not found`);
    }
    return role;
  }

  async updatePermissions(id: number, permissions: string[]) {
    return this.prisma.role.update({
      where: { id },
      data: { permissions },
    });
  }

  async create(name: string) {
    return this.prisma.role.create({
      data: {
        name,
        permissions: [] // start with empty permissions
      },
    });
  }

  async remove(id: number) {
    // Check if users exist for this role
    const usersWithRole = await this.prisma.user.findFirst({
      where: { roleId: id }
    });
    if (usersWithRole) {
      throw new BadRequestException("Cannot delete role because it is assigned to one or more users");
    }
    return this.prisma.role.delete({
      where: { id },
    });
  }
}
