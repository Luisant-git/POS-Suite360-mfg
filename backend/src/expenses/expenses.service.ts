import { Injectable } from '@nestjs/common';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  create(createExpenseDto: CreateExpenseDto) {
    const dateStr = createExpenseDto.date ? String(createExpenseDto.date) : new Date().toISOString();
    const parsedDate = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00+08:00`);

    return this.prisma.expense.create({
      data: {
        date: parsedDate,
        expenseCategoryId: Number(createExpenseDto.expenseCategoryId),
        amount: Number(createExpenseDto.amount),
        paymentModeId: Number(createExpenseDto.paymentModeId),
        notes: createExpenseDto.notes,
      },
      include: {
        category: true,
        paymentMode: true,
      },
    });
  }

  findAll(query?: any) {
    const where: any = {};
    if (query?.startDate || query?.endDate) {
      where.date = {};
      if (query.startDate) where.date.gte = new Date(`${query.startDate}T00:00:00+08:00`);
      if (query.endDate) {
        const end = new Date(`${query.endDate}T23:59:59.999+08:00`);
        where.date.lte = end;
      }
    }
    if (query?.categoryId) {
      where.expenseCategoryId = Number(query.categoryId);
    }
    if (query?.search) {
      where.OR = [
        { notes: { contains: query.search, mode: 'insensitive' } },
        { category: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.expense.findMany({
      where,
      include: {
        category: true,
        paymentMode: true,
      },
      orderBy: [
        { date: 'desc' },
        { id: 'desc' }
      ],
    });
  }

  findOne(id: number) {
    return this.prisma.expense.findUnique({
      where: { id },
      include: {
        category: true,
        paymentMode: true,
      },
    });
  }

  async update(id: number, updateData: any) {
    let parsedDate: Date | undefined;
    if (updateData.date) {
      const dateStr = String(updateData.date);
      parsedDate = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00+08:00`);
    }

    return this.prisma.expense.update({
      where: { id },
      data: {
        date: parsedDate,
        amount: updateData.amount !== undefined ? Number(updateData.amount) : undefined,
        notes: updateData.notes,
        expenseCategoryId: updateData.expenseCategoryId ? Number(updateData.expenseCategoryId) : undefined,
        paymentModeId: updateData.paymentModeId ? Number(updateData.paymentModeId) : undefined,
      },
      include: {
        category: true,
        paymentMode: true,
      },
    });
  }

  async remove(id: number) {
    return this.prisma.expense.delete({
      where: { id },
    });
  }
}

