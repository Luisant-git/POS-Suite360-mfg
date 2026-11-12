import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductionDto } from './dto/create-production.dto';

const PRODUCTION_INCLUDE = {
  rawMaterial: {
    include: {
      rawMaterialPurchaseItems: {
        orderBy: { id: 'desc' as const },
        take: 10,
      },
    },
  },
  finishedProduct: true,
  intakes: {
    include: {
      rawMaterial: {
        include: {
          rawMaterialPurchaseItems: {
            orderBy: { id: 'desc' as const },
            take: 10,
          },
        },
      },
    },
    orderBy: { id: 'asc' as const },
  },
  outcomes: {
    include: {
      finishedProduct: true,
    },
    orderBy: { id: 'asc' as const },
  },
  outcomeLogs: {
    include: {
      finishedProduct: true,
    },
    orderBy: [{ date: 'asc' as const }, { id: 'asc' as const }],
  },
};

@Injectable()
export class ProductionService {
  constructor(private prisma: PrismaService) {}

  private normalizeIntakes(dto: Partial<CreateProductionDto>) {
    if (Array.isArray(dto.intakes) && dto.intakes.length > 0) {
      return dto.intakes
        .filter((i) => Number(i.rawMaterialId) > 0)
        .map((i) => ({
          rawMaterialId: Number(i.rawMaterialId),
          materialCode: i.materialCode?.trim() || null,
          materialBatchCode: i.materialBatchCode?.trim() || null,
          intakeQuantity: Math.max(0, Number(i.intakeQuantity) || 0),
          sqM: Math.max(0, Number(i.sqM) || 0),
        }));
    }
    if (dto.rawMaterialId && Number(dto.rawMaterialId) > 0) {
      return [
        {
          rawMaterialId: Number(dto.rawMaterialId),
          materialCode: dto.materialCode?.trim() || null,
          materialBatchCode: dto.materialBatchCode?.trim() || null,
          intakeQuantity: Math.max(0, Number(dto.intakeQuantity) || 0),
          sqM: 0,
        },
      ];
    }
    return [];
  }

  private normalizeOutcomes(dto: Partial<CreateProductionDto>) {
    if (Array.isArray(dto.outcomes) && dto.outcomes.length > 0) {
      return dto.outcomes
        .filter((o) => Number(o.finishedProductId) > 0)
        .map((o) => ({
          finishedProductId: Number(o.finishedProductId),
          outcomeQuantity: Math.max(0, Number(o.outcomeQuantity) || 0),
          sqM: Math.max(0, Number(o.sqM) || 0),
        }));
    }
    if (dto.finishedProductId && Number(dto.finishedProductId) > 0) {
      return [
        {
          finishedProductId: Number(dto.finishedProductId),
          outcomeQuantity: Math.max(0, Number(dto.outcomeQuantity) || 0),
          sqM: 0,
        },
      ];
    }
    return [];
  }

  private getEffectiveIntakes(record: any) {
    if (Array.isArray(record.intakes) && record.intakes.length > 0) {
      return record.intakes;
    }
    if (record.rawMaterialId) {
      return [
        {
          rawMaterialId: record.rawMaterialId,
          materialCode: record.materialCode || null,
          materialBatchCode: record.materialBatchCode || null,
          intakeQuantity: Number(record.intakeQuantity || 0),
        },
      ];
    }
    return [];
  }

  private getEffectiveOutcomes(record: any) {
    if (Array.isArray(record.outcomes) && record.outcomes.length > 0) {
      return record.outcomes;
    }
    if (record.finishedProductId) {
      return [
        {
          finishedProductId: record.finishedProductId,
          outcomeQuantity: Number(record.outcomeQuantity || 0),
        },
      ];
    }
    return [];
  }

  private aggregateById(rows: any[], idKey: string, qtyKey: string): Map<number, number> {
    const map = new Map<number, number>();
    for (const row of rows) {
      const id = Number(row[idKey]);
      const qty = Number(row[qtyKey] || 0);
      if (id > 0) {
        map.set(id, (map.get(id) || 0) + qty);
      }
    }
    return map;
  }

  private async applyStockDeltas(
    tx: any,
    oldIntakes: any[],
    newIntakes: any[],
    oldOutcomes: any[],
    newOutcomes: any[],
    workName: string,
    txDate: Date,
    isCreate = false,
  ) {
    // 1. Raw material stock deltas (positive intake delta decrements stock)
    const oldRmMap = this.aggregateById(oldIntakes, 'rawMaterialId', 'intakeQuantity');
    const newRmMap = this.aggregateById(newIntakes, 'rawMaterialId', 'intakeQuantity');
    const allRmIds = new Set([...oldRmMap.keys(), ...newRmMap.keys()]);

    for (const rmId of allRmIds) {
      const delta = (newRmMap.get(rmId) || 0) - (oldRmMap.get(rmId) || 0);
      if (delta !== 0) {
        await tx.rawMaterial.update({
          where: { id: rmId },
          data: { currentStock: { increment: -delta } },
        });
      }
    }

    // 2. Finished product stock deltas (positive outcome delta increments stock)
    const oldProdMap = this.aggregateById(oldOutcomes, 'finishedProductId', 'outcomeQuantity');
    const newProdMap = this.aggregateById(newOutcomes, 'finishedProductId', 'outcomeQuantity');
    const allProdIds = new Set([...oldProdMap.keys(), ...newProdMap.keys()]);

    for (const prodId of allProdIds) {
      const delta = (newProdMap.get(prodId) || 0) - (oldProdMap.get(prodId) || 0);
      if (delta !== 0) {
        const finishedProduct = await tx.product.update({
          where: { id: prodId },
          data: { currentStock: { increment: delta } },
        });
        await tx.stockTransaction.create({
          data: {
            productId: prodId,
            type: 'ADJUSTMENT',
            quantityIn: delta > 0 ? delta : 0,
            quantityOut: delta < 0 ? Math.abs(delta) : 0,
            balance: finishedProduct.currentStock,
            reference: `${isCreate ? 'Production Outcome' : 'Production Outcome Update'} - ${workName}`,
            date: txDate,
          },
        });
      }
    }
  }

  async create(createProductionDto: CreateProductionDto) {
    const intakes = this.normalizeIntakes(createProductionDto);
    const outcomes = this.normalizeOutcomes(createProductionDto);

    if (intakes.length === 0 || outcomes.length === 0) {
      throw new BadRequestException('At least one raw material and one finished product are required');
    }

    const totalIntakeQty = intakes.reduce((sum, i) => sum + i.intakeQuantity, 0);
    const totalOutcomeQty = outcomes.reduce((sum, o) => sum + o.outcomeQuantity, 0);
    const shouldFinish = createProductionDto.finish === true || createProductionDto.status === 'COMPLETED';
    const parsedDate = new Date(createProductionDto.date);
    const initialLogs = outcomes
      .filter((o) => o.outcomeQuantity > 0)
      .map((o) => ({
        finishedProductId: o.finishedProductId,
        outcomeQuantity: o.outcomeQuantity,
        sqM: o.sqM,
        date: parsedDate,
      }));

    return this.prisma.$transaction(async (tx) => {
      const production = await tx.production.create({
        data: {
          date: parsedDate,
          workName: createProductionDto.workName,
          status: shouldFinish ? 'COMPLETED' : 'PENDING',
          completedAt: shouldFinish ? new Date() : null,
          rawMaterialId: intakes[0].rawMaterialId,
          materialCode: intakes[0].materialCode,
          materialBatchCode: intakes[0].materialBatchCode,
          intakeQuantity: totalIntakeQty,
          finishedProductId: outcomes[0].finishedProductId,
          outcomeQuantity: totalOutcomeQty,
          intakes: { create: intakes },
          outcomes: { create: outcomes },
          ...(initialLogs.length > 0 ? { outcomeLogs: { create: initialLogs } } : {}),
        },
        include: PRODUCTION_INCLUDE,
      });

      await this.applyStockDeltas(
        tx,
        [],
        intakes,
        [],
        outcomes,
        createProductionDto.workName,
        parsedDate,
        true,
      );

      return production;
    });
  }

  findAll() {
    return this.prisma.production.findMany({
      include: PRODUCTION_INCLUDE,
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });
  }

  async findOne(id: number) {
    const production = await this.prisma.production.findUnique({
      where: { id },
      include: PRODUCTION_INCLUDE,
    });
    if (!production) {
      throw new NotFoundException('Production entry not found');
    }
    return production;
  }

  async update(id: number, updateData: Partial<CreateProductionDto>) {
    return this.prisma.$transaction(async (tx) => {
      const oldProduction = await tx.production.findUnique({
        where: { id },
        include: PRODUCTION_INCLUDE,
      });

      if (!oldProduction) {
        throw new NotFoundException('Production entry not found');
      }

      if (oldProduction.status === 'COMPLETED') {
        throw new BadRequestException('Completed production cannot be edited');
      }

      const oldIntakes = this.getEffectiveIntakes(oldProduction);
      const oldOutcomes = this.getEffectiveOutcomes(oldProduction);

      const hasNewIntakes =
        (Array.isArray(updateData.intakes) && updateData.intakes.length > 0) || !!updateData.rawMaterialId;
      const hasNewOutcomes =
        (Array.isArray(updateData.outcomes) && updateData.outcomes.length > 0) ||
        !!updateData.finishedProductId ||
        updateData.outcomeQuantity !== undefined;

      let newIntakes: { rawMaterialId: number; materialCode: string | null; materialBatchCode: string | null; intakeQuantity: number; sqM: number }[] =
        oldIntakes.map((i: any) => ({
          rawMaterialId: Number(i.rawMaterialId),
          materialCode: i.materialCode || null,
          materialBatchCode: i.materialBatchCode || null,
          intakeQuantity: Number(i.intakeQuantity || 0),
          sqM: Number(i.sqM || 0),
        }));

      if (hasNewIntakes) {
        newIntakes = this.normalizeIntakes(updateData);
      }

      let newOutcomes: { finishedProductId: number; outcomeQuantity: number; sqM: number }[] =
        oldOutcomes.map((o: any) => ({
          finishedProductId: Number(o.finishedProductId),
          outcomeQuantity: Number(o.outcomeQuantity || 0),
          sqM: Number(o.sqM || 0),
        }));

      if (hasNewOutcomes) {
        if (
          !Array.isArray(updateData.outcomes) &&
          !updateData.finishedProductId &&
          updateData.outcomeQuantity !== undefined &&
          oldOutcomes.length === 1
        ) {
          newOutcomes = [
            {
              finishedProductId: Number(oldOutcomes[0].finishedProductId),
              outcomeQuantity: Math.max(0, Number(updateData.outcomeQuantity) || 0),
              sqM: Number(oldOutcomes[0].sqM || 0),
            },
          ];
        } else {
          newOutcomes = this.normalizeOutcomes(updateData);
        }
      }

      const nextWorkName = updateData.workName ?? oldProduction.workName;
      const nextDate = updateData.date ? new Date(updateData.date) : oldProduction.date;
      const shouldFinish = updateData.finish === true || updateData.status === 'COMPLETED';

      await this.applyStockDeltas(
        tx,
        oldIntakes,
        newIntakes,
        oldOutcomes,
        newOutcomes,
        nextWorkName,
        new Date(),
        false,
      );

      if (hasNewIntakes || oldProduction.intakes.length === 0) {
        await tx.productionIntake.deleteMany({ where: { productionId: id } });
      }
      if (hasNewOutcomes || oldProduction.outcomes.length === 0) {
        await tx.productionOutcome.deleteMany({ where: { productionId: id } });
      }

      const totalIntakeQty = newIntakes.reduce((sum, i) => sum + i.intakeQuantity, 0);
      const totalOutcomeQty = newOutcomes.reduce((sum, o) => sum + o.outcomeQuantity, 0);

      const oldProdQtyMap = this.aggregateById(oldOutcomes, 'finishedProductId', 'outcomeQuantity');
      const oldProdSqMMap = this.aggregateById(oldOutcomes, 'finishedProductId', 'sqM');
      const newProdQtyMap = this.aggregateById(newOutcomes, 'finishedProductId', 'outcomeQuantity');
      const newProdSqMMap = this.aggregateById(newOutcomes, 'finishedProductId', 'sqM');
      const allProdIds = new Set([...oldProdQtyMap.keys(), ...newProdQtyMap.keys()]);

      const logsToCreate: {
        finishedProductId: number;
        outcomeQuantity: number;
        sqM: number;
        date: Date;
      }[] = [];

      if (!oldProduction.outcomeLogs || oldProduction.outcomeLogs.length === 0) {
        for (const [prodId, oldQty] of oldProdQtyMap.entries()) {
          if (oldQty > 0) {
            logsToCreate.push({
              finishedProductId: prodId,
              outcomeQuantity: oldQty,
              sqM: Number((oldProdSqMMap.get(prodId) || 0).toFixed(4)),
              date: oldProduction.date,
            });
          }
        }
      }

      const updateTime = new Date();
      for (const prodId of allProdIds) {
        const deltaQty = (newProdQtyMap.get(prodId) || 0) - (oldProdQtyMap.get(prodId) || 0);
        const deltaSqM = (newProdSqMMap.get(prodId) || 0) - (oldProdSqMMap.get(prodId) || 0);
        if (deltaQty !== 0) {
          logsToCreate.push({
            finishedProductId: prodId,
            outcomeQuantity: deltaQty,
            sqM: Number(deltaSqM.toFixed(4)),
            date: updateTime,
          });
        }
      }

      return tx.production.update({
        where: { id },
        data: {
          date: nextDate,
          workName: nextWorkName,
          status: shouldFinish ? 'COMPLETED' : 'PENDING',
          completedAt: shouldFinish ? new Date() : null,
          rawMaterialId: newIntakes[0]?.rawMaterialId ?? oldProduction.rawMaterialId,
          materialCode: newIntakes[0]?.materialCode ?? null,
          materialBatchCode: newIntakes[0]?.materialBatchCode ?? null,
          intakeQuantity: totalIntakeQty,
          finishedProductId: newOutcomes[0]?.finishedProductId ?? oldProduction.finishedProductId,
          outcomeQuantity: totalOutcomeQty,
          ...(hasNewIntakes || oldProduction.intakes.length === 0
            ? { intakes: { create: newIntakes } }
            : {}),
          ...(hasNewOutcomes || oldProduction.outcomes.length === 0
            ? { outcomes: { create: newOutcomes } }
            : {}),
          ...(logsToCreate.length > 0 ? { outcomeLogs: { create: logsToCreate } } : {}),
        },
        include: PRODUCTION_INCLUDE,
      });
    });
  }

  async finish(id: number, updateData?: Partial<CreateProductionDto>) {
    const payload = { ...(updateData || {}), finish: true, status: 'COMPLETED' };
    return this.update(id, payload);
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.production.findUnique({
        where: { id },
        include: PRODUCTION_INCLUDE,
      });

      if (!existing) {
        throw new NotFoundException('Production entry not found');
      }

      const oldIntakes = this.getEffectiveIntakes(existing);
      const oldOutcomes = this.getEffectiveOutcomes(existing);

      await this.applyStockDeltas(
        tx,
        oldIntakes,
        [],
        oldOutcomes,
        [],
        existing.workName,
        new Date(),
        false,
      );

      await tx.production.delete({ where: { id } });
      return { deleted: true, id };
    });
  }
}
