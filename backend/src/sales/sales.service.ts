import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { CreateSaleDto } from './dto/create-sale.dto';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionType } from '@prisma/client';

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  private getProductRateField(rateType?: string): 'sellingRate' | 'wholesaleRate' | 'mrp' {
    if (rateType === 'Wholesale Rate') return 'wholesaleRate';
    if (rateType === 'MRP') return 'mrp';
    return 'sellingRate';
  }

  /** Persist the last edited service/product/customer rate so future sales default to it. */
  private async applyLastEditedRate(
    tx: any,
    params: {
      item: any;
      rateType?: string;
      resolvedCustomerId: number;
      hasExplicitCustomer: boolean;
      enableCustomerWiseRate: boolean;
      currentProduct?: any;
    },
  ): Promise<Record<string, any>> {
    const { item, rateType, resolvedCustomerId, hasExplicitCustomer, enableCustomerWiseRate, currentProduct } = params;
    const editedRate = Number(item.rate);
    if (!(editedRate > 0)) return {};

    if (item.isService && item.serviceItemId) {
      const existingService = await tx.serviceItem.findUnique({ where: { id: item.serviceItemId } });
      if (existingService && editedRate !== Number(existingService.rate)) {
        await tx.serviceItem.update({
          where: { id: item.serviceItemId },
          data: { rate: editedRate },
        });
      }
      return {};
    }

    if (!currentProduct || !item.productId) return {};

    if (enableCustomerWiseRate && hasExplicitCustomer) {
      const existingCustomerRate = await tx.customerProductRate.findUnique({
        where: {
          customerId_productId: {
            customerId: resolvedCustomerId,
            productId: item.productId,
          },
        },
      });
      if (existingCustomerRate) {
        if (editedRate !== Number(existingCustomerRate.rate)) {
          await tx.customerProductRate.update({
            where: { id: existingCustomerRate.id },
            data: { rate: editedRate },
          });
        }
        return {};
      }
    }

    const rateField = this.getProductRateField(rateType);
    if (editedRate !== Number(currentProduct[rateField])) {
      return { [rateField]: editedRate };
    }
    return {};
  }

  async create(createSaleDto: CreateSaleDto, userId: number) {
    // Execute in a transaction to guarantee data integrity between sale and stock ledger
    return this.prisma.$transaction(async (tx) => {
      
      // 0. Auto-generate the correct invoice number safely inside the transaction
      const settings = await tx.settings.findUnique({ where: { id: 1 } });
      const prefix = settings?.invoicePrefix || 'INV-';
      
      const lastSale = await tx.sale.findFirst({
        orderBy: { invoiceNo: 'desc' },
        select: { invoiceNo: true },
      });

      let nextNumber = 1;
      if (lastSale && lastSale.invoiceNo.startsWith(prefix)) {
        const remainingStr = lastSale.invoiceNo.substring(prefix.length);
        const match = remainingStr.match(/^(\d+)/);
        if (match && !isNaN(parseInt(match[1], 10))) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }
      const finalInvoiceNo = `${prefix}${String(nextNumber).padStart(5, '0')}`;

      // 1. Resolve customerId — if 0 (cash sale), use/create a "Cash Customer"
      let resolvedCustomerId = createSaleDto.customerId;
      if (!resolvedCustomerId || resolvedCustomerId === 0) {
        let cashCustomer = await tx.customer.findFirst({ where: { name: 'Cash Customer' } });
        if (!cashCustomer) {
          cashCustomer = await tx.customer.create({
            data: { name: 'Cash Customer', phone: '0000000000' },
          });
        }
        resolvedCustomerId = cashCustomer.id;
      }

      let actualUserId = userId;
      if (actualUserId < 1) {
        const firstUser = await tx.user.findFirst();
        actualUserId = firstUser ? firstUser.id : 1;
      }

      // 2. Create Sale and SaleItems
      const sale = await tx.sale.create({
        data: {
          invoiceNo: finalInvoiceNo,
          date: new Date(createSaleDto.date),
          customerId: resolvedCustomerId,
          userId: actualUserId,
          paymentModeId: createSaleDto.paymentModeId,
          subtotal: createSaleDto.subtotal,
          tax: createSaleDto.tax || 0,
          discount: createSaleDto.discount || 0,
          grandTotal: createSaleDto.grandTotal,
          items: {
            create: createSaleDto.items.map((item) => ({
              productId: item.productId || null,
              serviceItemId: item.serviceItemId || null,
              isService: item.isService || false,
              itemName: item.itemName || null,
              quantity: item.quantity,
              rate: item.rate,
              discount: item.discount || 0,
              tax: item.tax || 0,
              amount: item.amount,
            })),
          },
        },
        include: { items: true },
      });

      // 3. Update stock and ledger for each item
      const hasExplicitCustomer = Boolean(createSaleDto.customerId && createSaleDto.customerId > 0);
      const enableCustomerWiseRate = Boolean(settings?.enableCustomerWiseRate);

      for (const item of createSaleDto.items) {
        if (item.isService) {
          await this.applyLastEditedRate(tx, {
            item,
            rateType: createSaleDto.rateType,
            resolvedCustomerId,
            hasExplicitCustomer,
            enableCustomerWiseRate,
          });
          // Skip stock updates for service items
          continue;
        }

        if (!item.productId) {
          throw new BadRequestException('Product ID is required for physical products.');
        }

        const currentProduct = await tx.product.findUnique({ where: { id: item.productId } });
        if (!currentProduct) {
          throw new BadRequestException(`Product not found: ${item.productId}`);
        }

        const rateUpdate = await this.applyLastEditedRate(tx, {
          item,
          rateType: createSaleDto.rateType,
          resolvedCustomerId,
          hasExplicitCustomer,
          enableCustomerWiseRate,
          currentProduct,
        });

        const dataToUpdate: any = {
          currentStock: { decrement: item.quantity },
          ...rateUpdate,
        };

        // Decrement current stock (allow negative stock to let checkout proceed)
        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: dataToUpdate,
        });

        // Add ledger entry
        await tx.stockTransaction.create({
          data: {
            date: new Date(createSaleDto.date),
            productId: item.productId,
            type: TransactionType.SALE,
            quantityIn: 0,
            quantityOut: item.quantity,
            balance: updatedProduct.currentStock,
            reference: sale.invoiceNo,
          },
        });
      }
      return sale;
    });
  }

  async findAll(query?: any) {
    const where: any = {};
    if (query?.fromDate || query?.toDate) {
      where.date = {};
      if (query.fromDate) where.date.gte = new Date(query.fromDate);
      if (query.toDate) {
        const toDate = new Date(query.toDate);
        toDate.setHours(23, 59, 59, 999);
        where.date.lte = toDate;
      }
    }
    if (query?.customerId) {
      where.customerId = Number(query.customerId);
    }
    if (query?.invoiceNo) {
      where.invoiceNo = { contains: query.invoiceNo, mode: 'insensitive' };
    }
    if (query?.paymentModeId) {
      where.paymentModeId = Number(query.paymentModeId);
    }
    if (query?.productionBatchCode) {
      const rawBatchCode = String(query.productionBatchCode).trim();
      if (rawBatchCode) {
        const codeMatch = rawBatchCode.match(/^(BCH-\d+)/i);
        const searchToken = codeMatch ? codeMatch[1].toUpperCase() : rawBatchCode;
        const candidateProductions = await this.prisma.production.findMany({
          where: {
            workName: { contains: searchToken, mode: 'insensitive' },
          },
          select: {
            id: true,
            workName: true,
            finishedProductId: true,
            outcomes: { select: { finishedProductId: true } },
            outcomeLogs: { select: { finishedProductId: true } },
          },
        });

        const matchedProductions = candidateProductions.filter((p) => {
          const text = String(p.workName || '').trim();
          const pMatch = text.match(/^(BCH-\d+)/i);
          if (codeMatch && pMatch) {
            return pMatch[1].toUpperCase() === searchToken;
          }
          return text.toLowerCase().includes(rawBatchCode.toLowerCase());
        });

        const productIds = new Set<number>();
        for (const prod of matchedProductions) {
          if (prod.finishedProductId) productIds.add(prod.finishedProductId);
          for (const outcome of prod.outcomes || []) {
            if (outcome.finishedProductId) productIds.add(outcome.finishedProductId);
          }
          for (const log of prod.outcomeLogs || []) {
            if (log.finishedProductId) productIds.add(log.finishedProductId);
          }
        }

        if (productIds.size === 0) {
          return [];
        }
        where.items = {
          some: {
            productId: { in: Array.from(productIds) },
          },
        };
      }
    }

    return this.prisma.sale.findMany({
      where,
      include: {
        customer: true,
        paymentMode: true,
        items: {
          include: {
            product: true,
            serviceItem: true,
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { id: 'desc' }
      ],
    });
  }

  findOne(id: number) {
    return this.prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        paymentMode: true,
        user: {
          select: { id: true, name: true, username: true }
        },
        items: {
          include: {
            product: {
              include: {
                unit: true
              }
            },
            serviceItem: true,
          },
        },
      },
    });
  }

  async update(id: number, updateSaleDto: any, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Locate the existing sale
      const existing = await tx.sale.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!existing) throw new BadRequestException('Sale not found');

      // 2. Enforce "Invoice Edit Permission" setting
      const settings = await tx.settings.findUnique({ where: { id: 1 } });
      if (!settings?.enableInvoiceEdit) {
        throw new ForbiddenException('Invoice editing is disabled in Settings.');
      }

      // 3. Enforce dynamic edit window based on the sale date
      const saleDate = new Date(existing.date).getTime();
      const invoiceEditDays = settings?.invoiceEditDays || 30;
      const cutoff = Date.now() - invoiceEditDays * 24 * 60 * 60 * 1000;
      if (saleDate < cutoff) {
        throw new ForbiddenException(`Invoices can only be edited within ${invoiceEditDays} days of the sale date.`);
      }

      // 4. Reverse previous stock and ledger entries
      for (const item of existing.items) {
        if (item.isService || !item.productId) continue;

        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: { currentStock: { increment: item.quantity } },
        });

        await tx.stockTransaction.create({
          data: {
            date: new Date(),
            productId: item.productId,
            type: TransactionType.SALE_RETURN,
            quantityIn: item.quantity,
            quantityOut: 0,
            balance: updatedProduct.currentStock,
            reference: `Reverted during edit ${existing.invoiceNo}`,
          },
        });
      }

      // 5. Delete old sale items
      await tx.saleItem.deleteMany({ where: { saleId: id } });

      // 6. Resolve customerId — if 0 (cash sale), use/create a "Cash Customer"
      let resolvedCustomerId = updateSaleDto.customerId;
      if (!resolvedCustomerId || resolvedCustomerId === 0) {
        let cashCustomer = await tx.customer.findFirst({ where: { name: 'Cash Customer' } });
        if (!cashCustomer) {
          cashCustomer = await tx.customer.create({
            data: { name: 'Cash Customer', phone: '0000000000' },
          });
        }
        resolvedCustomerId = cashCustomer.id;
      }

      let actualUserId = userId;
      if (actualUserId < 1) {
        const firstUser = await tx.user.findFirst();
        actualUserId = firstUser ? firstUser.id : 1;
      }

      // 7. Update sale + rebuilt items
      const updated = await tx.sale.update({
        where: { id },
        data: {
          date: new Date(updateSaleDto.date),
          customerId: resolvedCustomerId,
          userId: actualUserId,
          paymentModeId: updateSaleDto.paymentModeId,
          subtotal: updateSaleDto.subtotal,
          tax: updateSaleDto.tax || 0,
          discount: updateSaleDto.discount || 0,
          grandTotal: updateSaleDto.grandTotal,
          items: {
            create: updateSaleDto.items.map((item: any) => ({
              productId: item.productId || null,
              serviceItemId: item.serviceItemId || null,
              isService: item.isService || false,
              itemName: item.itemName || null,
              quantity: item.quantity,
              rate: item.rate,
              discount: item.discount || 0,
              tax: item.tax || 0,
              amount: item.amount,
            })),
          },
        },
        include: { items: true },
      });

      // 8. Apply new stock deductions and ledger entries
      const hasExplicitCustomer = Boolean(updateSaleDto.customerId && updateSaleDto.customerId > 0);
      const enableCustomerWiseRate = Boolean(settings?.enableCustomerWiseRate);

      for (const item of updateSaleDto.items) {
        if (item.isService) {
          await this.applyLastEditedRate(tx, {
            item,
            rateType: updateSaleDto.rateType,
            resolvedCustomerId,
            hasExplicitCustomer,
            enableCustomerWiseRate,
          });
          continue;
        }

        if (!item.productId) continue;

        const currentProduct = await tx.product.findUnique({ where: { id: item.productId } });
        if (!currentProduct) throw new BadRequestException(`Product not found: ${item.productId}`);

        const rateUpdate = await this.applyLastEditedRate(tx, {
          item,
          rateType: updateSaleDto.rateType,
          resolvedCustomerId,
          hasExplicitCustomer,
          enableCustomerWiseRate,
          currentProduct,
        });

        const dataToUpdate: any = {
          currentStock: { decrement: item.quantity },
          ...rateUpdate,
        };

        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: dataToUpdate,
        });

        await tx.stockTransaction.create({
          data: {
            date: new Date(updateSaleDto.date),
            productId: item.productId,
            type: TransactionType.SALE,
            quantityIn: 0,
            quantityOut: item.quantity,
            balance: updatedProduct.currentStock,
            reference: existing.invoiceNo,
          },
        });
      }

      return updated;
    });
  }

  async getNextInvoiceNo() {
    const settings = await this.prisma.settings.findUnique({ where: { id: 1 } });
    const prefix = settings?.invoicePrefix || 'INV-';

    const lastSale = await this.prisma.sale.findFirst({
      orderBy: { invoiceNo: 'desc' },
      select: { invoiceNo: true },
    });

    let nextNumber = 1;
    if (lastSale && lastSale.invoiceNo.startsWith(prefix)) {
      const remainingStr = lastSale.invoiceNo.substring(prefix.length);
      const match = remainingStr.match(/^(\d+)/);
      if (match && !isNaN(parseInt(match[1], 10))) {
        nextNumber = parseInt(match[1], 10) + 1;
      }
    }
    
    return `${prefix}${String(nextNumber).padStart(5, '0')}`;
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id },
        include: { items: true }
      });

      if (!sale) {
        throw new BadRequestException('Sale not found');
      }

      // 1. Reverse stock and ledger
      for (const item of sale.items) {
        if (item.isService || !item.productId) continue;

        const updatedProduct = await tx.product.update({
          where: { id: item.productId },
          data: {
            currentStock: { increment: item.quantity },
          },
        });

        // Add reverting ledger entry
        await tx.stockTransaction.create({
          data: {
            date: new Date(),
            productId: item.productId,
            type: TransactionType.SALE_RETURN,
            quantityIn: item.quantity,
            quantityOut: 0,
            balance: updatedProduct.currentStock,
            reference: `Reverted ${sale.invoiceNo}`,
          },
        });
      }

      // 2. Delete Sale Items
      await tx.saleItem.deleteMany({
        where: { saleId: id },
      });

      // 3. Delete Sale
      return tx.sale.delete({
        where: { id },
      });
    });
  }
}
