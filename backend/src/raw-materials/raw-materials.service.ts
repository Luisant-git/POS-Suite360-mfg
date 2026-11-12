import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRawMaterialDto } from './dto/create-raw-material.dto';

@Injectable()
export class RawMaterialsService {
  constructor(private prisma: PrismaService) {}

  async create(createRawMaterialDto: CreateRawMaterialDto) {
    let code = createRawMaterialDto.code?.trim();
    if (!code) {
      const existingRows = await this.prisma.rawMaterial.findMany({ select: { code: true } });
      const maxNum = existingRows
        .filter((m) => m.code?.startsWith('RM-'))
        .map((m) => parseInt(m.code.replace('RM-', ''), 10))
        .filter((n) => !Number.isNaN(n))
        .reduce((max, n) => Math.max(max, n), 0);
      code = `RM-${String(maxNum + 1).padStart(3, '0')}`;
    } else {
      const existing = await this.prisma.rawMaterial.findUnique({ where: { code } });
      if (existing) {
        throw new BadRequestException('Raw Material Code already exists');
      }
    }
    return this.prisma.rawMaterial.create({
      data: {
        ...createRawMaterialDto,
        code,
      },
    });
  }

  findAll() {
    return this.prisma.rawMaterial.findMany({
      include: {
        unit: true,
        rawMaterialPurchaseItems: {
          orderBy: { id: 'desc' },
          take: 25
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async update(id: number, updateRawMaterialDto: CreateRawMaterialDto) {
    const data: any = { ...updateRawMaterialDto };
    if (!data.code || !String(data.code).trim()) {
      delete data.code;
    }
    return this.prisma.rawMaterial.update({
      where: { id },
      data,
    });
  }

  remove(id: number) {
    return this.prisma.rawMaterial.delete({
      where: { id }
    });
  }
}
