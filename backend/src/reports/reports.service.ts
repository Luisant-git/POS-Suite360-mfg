import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfitLoss(fromDateStr?: string, toDateStr?: string) {
    const whereDate: any = {};
    if (fromDateStr || toDateStr) {
      whereDate.date = {};
      if (fromDateStr) {
        whereDate.date.gte = new Date(fromDateStr);
      }
      if (toDateStr) {
        const toDate = new Date(toDateStr);
        toDate.setHours(23, 59, 59, 999);
        whereDate.date.lte = toDate;
      }
    }

    // 1. Gross Sales Revenue
    const sales = await this.prisma.sale.aggregate({
      where: whereDate,
      _sum: { grandTotal: true },
    });
    const grossSales = Number(sales._sum.grandTotal || 0);

    // 2. Sales Returns
    const salesReturns = await this.prisma.salesReturn.aggregate({
      where: whereDate,
      _sum: { totalAmount: true },
    });
    const totalSalesReturns = Number(salesReturns._sum.totalAmount || 0);

    const netOperatingRevenue = grossSales - totalSalesReturns;

    // 3. Gross Purchases (Used as COGS here)
    const purchases = await this.prisma.purchase.aggregate({
      where: whereDate,
      _sum: { grandTotal: true },
    });
    const grossPurchases = Number(purchases._sum.grandTotal || 0);

    // 4. Purchase Returns
    const purchaseReturns = await this.prisma.purchaseReturn.aggregate({
      where: whereDate,
      _sum: { totalAmount: true },
    });
    const totalPurchaseReturns = Number(purchaseReturns._sum.totalAmount || 0);

    const netCogs = grossPurchases - totalPurchaseReturns;

    const grossProfit = netOperatingRevenue - netCogs;

    // 5. Operating Expenses (Itemized by Category)
    const expenses = await this.prisma.expense.findMany({
      where: whereDate,
      include: { category: true },
    });

    const expensesByCategory: Record<string, number> = {};
    let totalExpenses = 0;

    for (const exp of expenses) {
      const amount = Number(exp.amount || 0);
      totalExpenses += amount;
      const catName = exp.category?.name || 'Uncategorized';
      if (!expensesByCategory[catName]) {
        expensesByCategory[catName] = 0;
      }
      expensesByCategory[catName] += amount;
    }

    const itemizedExpenses = Object.keys(expensesByCategory).map(name => ({
      name,
      amount: expensesByCategory[name],
    }));

    const netProfit = grossProfit - totalExpenses;

    return {
      grossSales,
      totalSalesReturns,
      netOperatingRevenue,
      grossPurchases,
      totalPurchaseReturns,
      netCogs,
      grossProfit,
      itemizedExpenses,
      totalExpenses,
      netProfit,
    };
  }

  async getBatchProfitAndLoss(workName?: string, productId?: number) {
    const whereClause: any = {};
    if (workName) {
      whereClause.workName = workName;
    }
    if (productId) {
      whereClause.OR = [
        { finishedProductId: Number(productId) },
        { outcomes: { some: { finishedProductId: Number(productId) } } },
      ];
    }

    const productions = await this.prisma.production.findMany({
      where: whereClause,
      include: {
        rawMaterial: {
          include: { rawMaterialPurchaseItems: { orderBy: { id: 'desc' }, take: 25 } }
        },
        finishedProduct: true,
        intakes: {
          include: {
            rawMaterial: {
              include: { rawMaterialPurchaseItems: { orderBy: { id: 'desc' }, take: 25 } }
            },
          },
        },
        outcomes: {
          include: { finishedProduct: true },
        },
        outcomeLogs: {
          include: { finishedProduct: true },
          orderBy: [{ date: 'asc' }, { id: 'asc' }],
        },
      },
    });

    let totalCost = 0;
    let totalRevenue = 0;

    const materialsUsed: Record<string, { quantity: number; cost: number; sqM: number; name: string; materialName: string; materialCode: string; batchCode: string }> = {};
    const productsProduced: Record<string, { name: string; quantity: number; sqM: number; revenue: number }> = {};
    const outcomeEntries: { date: Date; productName: string; quantity: number; sqM: number }[] = [];

    let totalProducedQty = 0;
    let totalRawSqM = 0;
    let totalOutcomeSqM = 0;
    let singleProductSqM: number | null = null;
    let isSingleProductBatch = true;
    const allCompleted = productions.length > 0 && productions.every((p: any) => p.status === 'COMPLETED');

    productions.forEach(prod => {
      const intakes = prod.intakes?.length
        ? prod.intakes
        : prod.rawMaterial
          ? [{ rawMaterial: prod.rawMaterial, materialCode: prod.materialCode, materialBatchCode: prod.materialBatchCode, intakeQuantity: prod.intakeQuantity, sqM: 0 }]
          : [];

      const rawOutcomes = prod.outcomes?.length
        ? prod.outcomes
        : prod.finishedProduct
          ? [{ finishedProduct: prod.finishedProduct, finishedProductId: prod.finishedProductId, outcomeQuantity: prod.outcomeQuantity, sqM: 0 }]
          : [];

      const outcomes = productId
        ? rawOutcomes.filter((o: any) => Number(o.finishedProductId || o.finishedProduct?.id) === Number(productId))
        : rawOutcomes;

      intakes.forEach((intake: any) => {
        const intakeQty = Number(intake.intakeQuantity || 0);
        const purchaseRate = Number(intake.rawMaterial?.purchaseRate || 0);
        const cost = intakeQty * purchaseRate;
        totalCost += cost;

        const fallbackSqM = Number(intake.rawMaterial?.rawMaterialPurchaseItems?.[0]?.sqM || 0);
        const intakeSqM = Number(intake.sqM) > 0 ? Number(intake.sqM) : intakeQty * fallbackSqM;
        totalRawSqM += intakeSqM;

        const batchVal = intake.materialBatchCode || intake.rawMaterial?.batchCode || '';
        const matchedPi = (intake.rawMaterial?.rawMaterialPurchaseItems || []).find(
          (pi: any) => pi.batchCode && batchVal && String(pi.batchCode).trim() === String(batchVal).trim()
        );
        const codeVal = intake.materialCode || matchedPi?.materialCode || intake.rawMaterial?.rawMaterialPurchaseItems?.[0]?.materialCode || intake.rawMaterial?.code || '';
        const matName = intake.rawMaterial?.name || 'Unknown';
        const matLabel = [matName, codeVal, batchVal]
          .filter(Boolean)
          .join('-') || 'Unknown';
        if (!materialsUsed[matLabel]) {
          materialsUsed[matLabel] = {
            quantity: 0,
            cost: 0,
            sqM: 0,
            name: matLabel,
            materialName: matName,
            materialCode: codeVal || '-',
            batchCode: batchVal || '-',
          };
        }
        materialsUsed[matLabel].quantity += intakeQty;
        materialsUsed[matLabel].cost += cost;
        materialsUsed[matLabel].sqM += intakeSqM;
      });

      const filteredLogs = Array.isArray((prod as any).outcomeLogs)
        ? (productId
            ? (prod as any).outcomeLogs.filter((l: any) => Number(l.finishedProductId || l.finishedProduct?.id) === Number(productId))
            : (prod as any).outcomeLogs)
        : [];
      filteredLogs.forEach((log: any) => {
        outcomeEntries.push({
          date: log.date || prod.date,
          productName: log.finishedProduct?.name || 'Unknown',
          quantity: Number(log.outcomeQuantity || 0),
          sqM: Number(log.sqM || 0) || Number(log.outcomeQuantity || 0) * Number(log.finishedProduct?.sqM || 0),
        });
      });

      outcomes.forEach((outcome: any) => {
        const outcomeQty = Number(outcome.outcomeQuantity || 0);
        const sellingRate = Number(outcome.finishedProduct?.sellingRate || 0);
        const revenue = outcomeQty * sellingRate;
        totalRevenue += revenue;
        totalProducedQty += outcomeQty;

        const prodSqM = Number(outcome.finishedProduct?.sqM || 0);
        const outSqM = outcomeQty * prodSqM;
        totalOutcomeSqM += outSqM;

        const prodName = outcome.finishedProduct?.name || 'Unknown';
        if (!productsProduced[prodName]) {
          productsProduced[prodName] = { name: prodName, quantity: 0, sqM: 0, revenue: 0 };
        }
        productsProduced[prodName].quantity += outcomeQty;
        productsProduced[prodName].sqM += outSqM;
        productsProduced[prodName].revenue += revenue;

        if (prodSqM > 0) {
          if (singleProductSqM === null) singleProductSqM = prodSqM;
          else if (singleProductSqM !== prodSqM) isSingleProductBatch = false;
        }
      });
    });

    const profit = totalRevenue - totalCost;

    const wastageSqM = Math.max(0, totalRawSqM - totalOutcomeSqM);
    const wastagePercentage = totalRawSqM > 0 ? (wastageSqM / totalRawSqM) * 100 : 0;
    const wastageQty =
      isSingleProductBatch && singleProductSqM && singleProductSqM > 0
        ? wastageSqM / singleProductSqM
        : wastageSqM;

    const wastageCost = totalCost * (wastagePercentage / 100);
    const costPerUnit = totalProducedQty > 0 ? (totalCost / totalProducedQty) : 0;

    return {
      workName,
      status: productions.length > 0 ? (allCompleted ? 'COMPLETED' : 'PENDING') : null,
      isCompleted: allCompleted,
      totalCost,
      totalRevenue,
      profit,
      totalProducedQty,
      totalIntakeSqM: totalRawSqM,
      totalOutcomeSqM,
      isSingleProductBatch: isSingleProductBatch && singleProductSqM !== null,
      wastageQty,
      wastageSqM,
      wastagePercentage,
      wastageCost,
      costPerUnit,
      materialsUsed: Object.values(materialsUsed),
      productsProduced: Object.values(productsProduced),
      outcomeEntries,
    };
  }

  async getSupplierOutstanding(supplierId: number) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) return 0;

    const creditMode = await this.prisma.paymentMode.findFirst({
      where: { name: { equals: 'Credit', mode: 'insensitive' } }
    });
    const creditModeId = creditMode?.id || -1;

    const purchases = await this.prisma.purchase.aggregate({
      where: { 
        supplierId,
        paymentModeId: creditModeId
      },
      _sum: { grandTotal: true },
    });

    const payments = await this.prisma.supplierPayment.aggregate({
      where: { supplierId },
      _sum: { amount: true },
    });

    const purchaseReturns = await this.prisma.purchaseReturn.aggregate({
      where: { supplierId },
      _sum: { totalAmount: true },
    });

    const openingBalance = Number(supplier.openingBalance) || 0;
    const isOpeningCredit = supplier.openingBalanceType === 'Cr'; // Cr means we owe them
    const isOpeningDebit = supplier.openingBalanceType === 'Dr';
    
    let totalOwed = 0;
    if (isOpeningCredit) totalOwed += openingBalance;
    if (isOpeningDebit) totalOwed -= openingBalance;

    const totalPurchases = Number(purchases._sum.grandTotal) || 0;
    const totalPaid = Number(payments._sum.amount) || 0;
    const totalReturns = Number(purchaseReturns._sum.totalAmount) || 0;

    return totalOwed + totalPurchases - totalPaid - totalReturns;
  }

  async getProductWiseSales(fromDate?: string, toDate?: string, productId?: number, supplierId?: number) {
    const whereDate: any = {};
    if (fromDate || toDate) {
      whereDate.date = {};
      if (fromDate) {
        whereDate.date.gte = new Date(`${fromDate}T00:00:00+08:00`);
      }
      if (toDate) {
        whereDate.date.lte = new Date(`${toDate}T23:59:59.999+08:00`);
      }
    }

    const saleItems = await this.prisma.saleItem.findMany({
      where: {
        sale: whereDate,
        ...(productId ? { productId } : {}),
        ...(supplierId ? { product: { supplierId } } : {}),
      },
      include: {
        sale: {
          include: {
            customer: true,
            paymentMode: true,
          }
        },
        product: {
          include: {
            supplier: true,
            category: true,
            unit: true,
          }
        }
      },
      orderBy: {
        sale: { date: 'desc' }
      }
    });

    const productGroups: any = {};

    for (const item of saleItems) {
      if (!item.product) continue;
      
      const productKey = `${item.product.code ? item.product.code + ' - ' : ''}${item.product.name}`;
      
      if (!productGroups[productKey]) {
        productGroups[productKey] = {
          productId: item.productId,
          productName: productKey,
          rawProductName: item.product.name,
          productCode: item.product.code || '',
          barcode: item.product.barcode || '',
          categoryName: item.product.category?.name || 'General',
          unitName: item.product.unit?.name || '',
          supplierId: item.product.supplierId || null,
          supplierName: item.product.supplier?.name || 'Unassigned Supplier',
          items: [],
          totalQty: 0,
          totalValue: 0,
          totalCost: 0,
          totalProfit: 0,
        };
      }

      const qty = Number(item.quantity) || 0;
      const value = Number(item.amount) || 0;
      const purchaseRate = Number(item.product.purchaseRate) || 0;
      const cost = qty * purchaseRate;
      const profit = value - cost;

      productGroups[productKey].items.push({
        saleId: item.saleId,
        invoiceNo: item.sale?.invoiceNo || '-',
        date: item.sale?.date || new Date(),
        customerName: item.sale?.customer?.name || 'Cash Customer',
        customerPhone: item.sale?.customer?.phone || '',
        paymentMode: item.sale?.paymentMode?.name || '-',
        qty: qty,
        rate: Number(item.rate) || (qty > 0 ? value / qty : 0),
        value: value,
        cost: cost,
        profit: profit,
      });

      productGroups[productKey].totalQty += qty;
      productGroups[productKey].totalValue += value;
      productGroups[productKey].totalCost += cost;
      productGroups[productKey].totalProfit += profit;
    }

    return Object.values(productGroups).sort((a: any, b: any) => a.productName.localeCompare(b.productName));
  }

  async getSupplierWiseSales(fromDate?: string, toDate?: string, supplierId?: number) {
    const whereDate: any = {};
    if (fromDate || toDate) {
      whereDate.date = {};
      if (fromDate) {
        whereDate.date.gte = new Date(`${fromDate}T00:00:00+08:00`);
      }
      if (toDate) {
        whereDate.date.lte = new Date(`${toDate}T23:59:59.999+08:00`);
      }
    }

    const saleItems = await this.prisma.saleItem.findMany({
      where: {
        sale: whereDate,
        ...(supplierId ? { product: { supplierId } } : {}),
      },
      include: {
        sale: {
          include: {
            customer: true,
            paymentMode: true,
          }
        },
        product: {
          include: {
            supplier: true,
            unit: true,
          }
        }
      },
      orderBy: {
        sale: { date: 'desc' }
      }
    });

    const supplierGroups: Record<string, any> = {};

    for (const item of saleItems) {
      const supplier = item.product?.supplier;
      const supplierKey = supplier ? `supplier-${supplier.id}` : 'supplier-unassigned';
      const supplierName = supplier?.name || 'Unassigned / Direct Purchase';

      if (!supplierGroups[supplierKey]) {
        supplierGroups[supplierKey] = {
          supplierId: supplier?.id || null,
          supplierName: supplierName,
          supplierCode: supplier?.id ? `SUP-${supplier.id}` : '-',
          phone: supplier?.phone || '-',
          contactPerson: supplier?.contactPerson || '',
          outstandingBalance: 0,
          productsMap: {},
          totalQty: 0,
          totalSalesValue: 0,
          totalCostValue: 0,
          totalMargin: 0,
          itemsCount: 0,
        };
      }

      const qty = Number(item.quantity) || 0;
      const value = Number(item.amount) || 0;
      const purchaseRate = Number(item.product?.purchaseRate || 0);
      const cost = qty * purchaseRate;
      const profit = value - cost;

      const pId: number = item.productId || 0;
      if (!supplierGroups[supplierKey].productsMap[pId]) {
        supplierGroups[supplierKey].productsMap[pId] = {
          productId: pId,
          productName: item.product?.name || 'Unknown',
          productCode: item.product?.code || '',
          unitName: item.product?.unit?.name || '',
          purchaseRate: purchaseRate,
          sellingRate: Number(item.product?.sellingRate || 0),
          qty: 0,
          salesValue: 0,
          costValue: 0,
          margin: 0,
          invoices: [],
        };
      }

      const prod = supplierGroups[supplierKey].productsMap[pId];
      prod.qty += qty;
      prod.salesValue += value;
      prod.costValue += cost;
      prod.margin += profit;
      prod.invoices.push({
        invoiceNo: item.sale?.invoiceNo || '-',
        date: item.sale?.date || new Date(),
        customerName: item.sale?.customer?.name || 'Cash Customer',
        qty,
        rate: Number(item.rate) || (qty > 0 ? value / qty : 0),
        value,
      });

      supplierGroups[supplierKey].totalQty += qty;
      supplierGroups[supplierKey].totalSalesValue += value;
      supplierGroups[supplierKey].totalCostValue += cost;
      supplierGroups[supplierKey].totalMargin += profit;
      supplierGroups[supplierKey].itemsCount += 1;
    }

    // Calculate live outstanding balance for each supplier in the report
    const groupsArray: any[] = Object.values(supplierGroups);
    for (const group of groupsArray) {
      if (group.supplierId) {
        group.outstandingBalance = await this.getSupplierOutstanding(group.supplierId);
      } else {
        group.outstandingBalance = 0;
      }
      group.products = Object.values(group.productsMap).sort((a: any, b: any) => b.salesValue - a.salesValue);
      delete group.productsMap;
    }

    return groupsArray.sort((a: any, b: any) => a.supplierName.localeCompare(b.supplierName));
  }
}
