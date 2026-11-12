import { IsString, IsNotEmpty, IsInt, Min, IsNumber, IsOptional } from 'class-validator';

export class CreateRawMaterialDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  batchCode?: string;

  @IsString()
  @IsOptional()
  hsnCode?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  taxPercent?: number;

  @IsInt()
  unitId: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  currentStock?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  purchaseRate?: number;
}
