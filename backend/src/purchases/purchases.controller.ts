import { Controller, Get, Post, Put, Body, Param, UseGuards, Query, Delete, Request } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('purchases')
@UseGuards(JwtAuthGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Post()
  create(@Body() createPurchaseDto: CreatePurchaseDto, @Request() req: any) {
    const userId = (req.user?.userId && req.user.userId > 0) ? req.user.userId : 1;
    return this.purchasesService.create(createPurchaseDto, userId);
  }

  @Get()
  findAll(@Query() query: any) {
    return this.purchasesService.findAll(query);
  }

  @Get('next-entry-no')
  async getNextEntryNo() {
    return { entryNo: await this.purchasesService.getNextEntryNo() };
  }

  @Get('latest-rate/:productId')
  async getLatestRate(@Param('productId') productId: string) {
    return this.purchasesService.getLatestRate(Number(productId));
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.purchasesService.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updatePurchaseDto: CreatePurchaseDto, @Request() req: any) {
    const userId = (req.user?.userId && req.user.userId > 0) ? req.user.userId : 1;
    return this.purchasesService.update(+id, updatePurchaseDto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.purchasesService.remove(+id);
  }
}
