import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

export class RawMaterialPurchaseItemDto {
  @IsInt()
  rawMaterialId: number;

  @IsString()
  @IsOptional()
  materialCode?: string;

  @IsString()
  @IsOptional()
  batchCode?: string;

  @IsNumber()
  widthMm: number;

  @IsNumber()
  lengthM: number;

  @IsNumber()
  sqM: number;

  @IsInt()
  quantity: number;

  @IsNumber()
  price: number;

  @IsNumber()
  @IsOptional()
  taxPercent?: number;

  @IsNumber()
  @IsOptional()
  tax?: number;

  @IsNumber()
  amount: number;
}

export class CreateRawMaterialPurchaseDto {
  @IsString()
  @IsNotEmpty()
  invoiceNo: string;

  @IsDateString()
  date: string;

  @IsInt()
  supplierId: number;

  @IsNumber()
  subtotal: number;

  @IsNumber()
  tax: number;

  @IsNumber()
  transportCharge: number;

  @IsNumber()
  wages: number;

  @IsNumber()
  grandTotal: number;

  @IsInt()
  @IsNotEmpty()
  paymentModeId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RawMaterialPurchaseItemDto)
  items: RawMaterialPurchaseItemDto[];
}
