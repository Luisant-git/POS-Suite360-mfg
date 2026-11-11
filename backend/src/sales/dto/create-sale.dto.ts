import { Type } from 'class-transformer';
import { IsString, IsNumber, IsArray, ValidateNested, IsOptional, IsDateString, IsBoolean } from 'class-validator';

class SaleItemDto {
  @IsNumber()
  @IsOptional()
  productId?: number;

  @IsNumber()
  @IsOptional()
  serviceItemId?: number;

  @IsBoolean()
  @IsOptional()
  isService?: boolean;

  @IsString()
  @IsOptional()
  itemName?: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  rate: number;

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsNumber()
  @IsOptional()
  tax?: number;

  @IsNumber()
  amount: number;
}

export class CreateSaleDto {
  @IsString()
  invoiceNo: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsNumber({}, { message: 'customerId must be a number' })
  customerId?: number;

  @IsString()
  @IsOptional()
  rateType?: string;

  @IsNumber()
  paymentModeId: number;

  @IsNumber()
  subtotal: number;

  @IsNumber()
  @IsOptional()
  tax?: number;

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsNumber()
  grandTotal: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];
}
