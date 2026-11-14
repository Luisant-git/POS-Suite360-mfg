import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { RawMaterialPurchasesService } from './raw-material-purchases.service';
import { CreateRawMaterialPurchaseDto } from './dto/create-raw-material-purchase.dto';

@Controller('raw-material-purchases')
export class RawMaterialPurchasesController {
  constructor(private readonly rawMaterialPurchasesService: RawMaterialPurchasesService) {}

  @Post()
  create(@Body() createRawMaterialPurchaseDto: CreateRawMaterialPurchaseDto) {
    return this.rawMaterialPurchasesService.create(createRawMaterialPurchaseDto);
  }

  @Get()
  findAll(
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
    @Query('supplierId') supplierId?: string,
    @Query('invoiceNo') invoiceNo?: string,
    @Query('rawMaterialId') rawMaterialId?: string,
  ) {
    return this.rawMaterialPurchasesService.findAll({
      fromDate,
      toDate,
      supplierId: supplierId ? Number(supplierId) : undefined,
      invoiceNo,
      rawMaterialId: rawMaterialId ? Number(rawMaterialId) : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rawMaterialPurchasesService.findOne(+id);
  }
}
