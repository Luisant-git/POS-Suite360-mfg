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
      whereClause.finishedProductId = Number(productId);
    }

    const productions = await this.prisma.production.findMany({
      where: whereClause,
      include: {
        rawMaterial: {
          include: { rawMaterialPurchaseItems: true }
        },
        finishedProduct: true,
      },
    });

    let totalCost = 0;
    let totalRevenue = 0;

    const materialsUsed: Record<string, { quantity: number; cost: number; name: string }> = {};

    let totalProducedQty = 0;
    let totalTheoreticalYield = 0;

    productions.forEach(prod => {
      const intakeQty = Number(prod.intakeQuantity || 0);
      const purchaseRate = Number(prod.rawMaterial?.purchaseRate || 0);
      const cost = intakeQty * purchaseRate;
      
      const outcomeQty = Number(prod.outcomeQuantity || 0);
      const sellingRate = Number(prod.finishedProduct?.sellingRate || 0);
      const revenue = outcomeQty * sellingRate;

      totalCost += cost;
      totalRevenue += revenue;
      totalProducedQty += outcomeQty;

      // theoretical yield calculation
      const rmSqM = Number(prod.rawMaterial?.rawMaterialPurchaseItems?.[0]?.sqM || 0);
      const productSqM = Number(prod.finishedProduct?.sqM || 0);
      const rawSqMUsed = intakeQty * rmSqM;
      if (productSqM > 0) {
        totalTheoreticalYield += (rawSqMUsed / productSqM);
      }

      const matName = prod.rawMaterial?.name || 'Unknown';
      if (!materialsUsed[matName]) {
        materialsUsed[matName] = { quantity: 0, cost: 0, name: matName };
      }
      materialsUsed[matName].quantity += intakeQty;
      materialsUsed[matName].cost += cost;
    });

    const profit = totalRevenue - totalCost;
    
    const wastageQty = totalTheoreticalYield > 0 ? Math.max(0, totalTheoreticalYield - totalProducedQty) : 0;
    const wastagePercentage = totalTheoreticalYield > 0 ? (wastageQty / totalTheoreticalYield) * 100 : 0;
    
    const wastageCost = totalCost * (wastagePercentage / 100);
    const costPerUnit = totalProducedQty > 0 ? (totalCost / totalProducedQty) : 0;

    return {
      workName,
      totalCost,
      totalRevenue,
      profit,
      totalProducedQty,
      wastageQty,
      wastagePercentage,
      wastageCost,
      costPerUnit,
      materialsUsed: Object.values(materialsUsed),
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
