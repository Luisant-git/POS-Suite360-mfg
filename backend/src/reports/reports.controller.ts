import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('profit-loss')
  async getProfitLoss(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    return this.reportsService.getProfitLoss(fromDate, toDate);
  }

  @Get('batch-pnl')
  async getBatchProfitAndLoss(
    @Query('workName') workName?: string,
    @Query('productId') productId?: number,
  ) {
    if (!workName && !productId) {
      return { error: 'Either workName or productId is required' };
    }
    return this.reportsService.getBatchProfitAndLoss(workName, productId);
  }

  @Get('product-wise-sales')
  async getProductWiseSales(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('productId') productId?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.reportsService.getProductWiseSales(
      fromDate,
      toDate,
      productId ? Number(productId) : undefined,
      supplierId ? Number(supplierId) : undefined,
    );
  }

  @Get('supplier-wise-sales')
  async getSupplierWiseSales(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.reportsService.getSupplierWiseSales(
      fromDate,
      toDate,
      supplierId ? Number(supplierId) : undefined,
    );
  }
}
