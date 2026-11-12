import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ProductionIntakeDto {
  @IsInt()
  rawMaterialId: number;

  @IsString()
  @IsOptional()
  materialCode?: string;

  @IsString()
  @IsOptional()
  materialBatchCode?: string;

  @IsInt()
  @Min(0)
  intakeQuantity: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  sqM?: number;
}

export class ProductionOutcomeDto {
  @IsInt()
  finishedProductId: number;

  @IsInt()
  @Min(0)
  outcomeQuantity: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  sqM?: number;
}

export class CreateProductionDto {
  @IsDateString()
  date: string;

  @IsString()
  @IsNotEmpty()
  workName: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsBoolean()
  @IsOptional()
  finish?: boolean;

  @IsInt()
  @IsOptional()
  rawMaterialId?: number;

  @IsString()
  @IsOptional()
  materialCode?: string;

  @IsString()
  @IsOptional()
  materialBatchCode?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  intakeQuantity?: number;

  @IsInt()
  @IsOptional()
  finishedProductId?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  outcomeQuantity?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProductionIntakeDto)
  intakes?: ProductionIntakeDto[];

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => ProductionOutcomeDto)
  outcomes?: ProductionOutcomeDto[];
}
