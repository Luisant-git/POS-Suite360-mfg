import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRawMaterialPurchaseDto } from './dto/create-raw-material-purchase.dto';

@Injectable()
export class RawMaterialPurchasesService {
  constructor(private prisma: PrismaService) {}

  async create(createRawMaterialPurchaseDto: CreateRawMaterialPurchaseDto) {
    const { invoiceNo, date, supplierId, subtotal, tax, transportCharge, wages, grandTotal, paymentModeId, items } = createRawMaterialPurchaseDto;

    // Check if invoice already exists
    const existing = await this.prisma.rawMaterialPurchase.findUnique({
      where: { invoiceNo }
    });
    if (existing) {
      throw new BadRequestException('Invoice number already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Create Purchase
      const purchase = await tx.rawMaterialPurchase.create({
        data: {
          invoiceNo,
          date: new Date(date),
          supplierId,
          subtotal,
          tax,
          transportCharge,
          wages,
          grandTotal,
          paymentModeId,
          items: {
            create: items.map(item => ({
              rawMaterialId: item.rawMaterialId,
              materialCode: item.materialCode?.trim() || null,
              batchCode: item.batchCode?.trim() || null,
              widthMm: item.widthMm,
              lengthM: item.lengthM,
              sqM: item.sqM,
              quantity: item.quantity,
              price: item.price,
              taxPercent: item.taxPercent || 0,
              tax: item.tax || 0,
              amount: item.amount,
            }))
          }
        },
        include: { items: true }
      });

      // 2. Update Stock (and latest batchCode if provided)
      for (const item of items) {
        const trimmedBatch = item.batchCode?.trim();
        await tx.rawMaterial.update({
          where: { id: item.rawMaterialId },
          data: {
            currentStock: { increment: item.quantity },
            ...(trimmedBatch ? { batchCode: trimmedBatch } : {}),
          },
        });
      }

      // Update Supplier Balance (if they track it)
      // Example: Adding to opening balance or having a separate ledger. 
      // Based on original POS, purchases might just be tracked via totals or we can increment opening balance if needed.
      // We'll skip balance logic unless explicitly requested to keep it simple and safe.

      return purchase;
    });
  }

  findAll(query?: {
    fromDate?: string;
    toDate?: string;
    supplierId?: number;
    invoiceNo?: string;
    rawMaterialId?: number;
  }) {
    const where: any = {};

    if (query?.fromDate || query?.toDate) {
      where.date = {};
      if (query.fromDate) {
        where.date.gte = new Date(`${query.fromDate}T00:00:00.000Z`);
      }
      if (query.toDate) {
        where.date.lte = new Date(`${query.toDate}T23:59:59.999Z`);
      }
    }

    if (query?.supplierId) {
      where.supplierId = query.supplierId;
    }

    if (query?.invoiceNo && query.invoiceNo.trim()) {
      where.invoiceNo = { contains: query.invoiceNo.trim(), mode: 'insensitive' };
    }

    if (query?.rawMaterialId) {
      where.items = {
        some: {
          rawMaterialId: query.rawMaterialId,
        },
      };
    }

    return this.prisma.rawMaterialPurchase.findMany({
      where,
      include: {
        supplier: true,
        paymentMode: true,
        items: {
          include: { rawMaterial: true }
        }
      },
      orderBy: { date: 'desc' }
    });
  }

  async findOne(id: number) {
    const purchase = await this.prisma.rawMaterialPurchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        paymentMode: true,
        items: {
          include: { rawMaterial: true }
        }
      }
    });
    if (!purchase) {
      throw new BadRequestException('Purchase not found');
    }
    return purchase;
  }
}
