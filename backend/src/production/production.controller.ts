import { Controller, Get, Post, Body, Param, Patch, Delete } from '@nestjs/common';
import { ProductionService } from './production.service';
import { CreateProductionDto, ProductOutcomeUpdateDto } from './dto/create-production.dto';

@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @Post()
  create(@Body() createProductionDto: CreateProductionDto) {
    return this.productionService.create(createProductionDto);
  }

  @Get()
  findAll() {
    return this.productionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productionService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateData: Partial<CreateProductionDto>) {
    return this.productionService.update(+id, updateData);
  }

  @Patch(':id/finish')
  finish(@Param('id') id: string, @Body() updateData?: Partial<CreateProductionDto>) {
    return this.productionService.finish(+id, updateData);
  }

  @Patch(':id/outcome-update')
  updateProductOutcome(
    @Param('id') id: string,
    @Body() body: ProductOutcomeUpdateDto,
  ) {
    return this.productionService.updateProductOutcome(+id, body);
  }

  @Patch(':id/outcome-finish/:finishedProductId')
  finishProductOutcome(
    @Param('id') id: string,
    @Param('finishedProductId') finishedProductId: string,
  ) {
    return this.productionService.finishProductOutcome(+id, +finishedProductId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productionService.remove(+id);
  }
}
