import { Injectable } from '@nestjs/common';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  create(createCustomerDto: CreateCustomerDto) {
    const { productRates, ...data } = createCustomerDto;
    return this.prisma.customer.create({
      data: {
        ...data,
        productRates: productRates?.length ? {
          create: productRates
        } : undefined
      },
      include: {
        productRates: {
          include: {
            product: true
          }
        }
      }
    });
  }

  findAll() {
    return this.prisma.customer.findMany({
      orderBy: { id: 'desc' },
      include: {
        productRates: {
          include: {
            product: true
          }
        }
      }
    });
  }

  findOne(id: number) {
    return this.prisma.customer.findUnique({
      where: { id },
      include: {
        productRates: {
          include: {
            product: true
          }
        }
      }
    });
  }

  async update(id: number, updateCustomerDto: UpdateCustomerDto) {
    const { productRates, ...data } = updateCustomerDto;
    
    if (productRates) {
      await this.prisma.customerProductRate.deleteMany({ where: { customerId: id } });
    }

    return this.prisma.customer.update({
      where: { id },
      data: {
        ...data,
        productRates: productRates?.length ? {
          create: productRates
        } : undefined
      },
      include: {
        productRates: {
          include: {
            product: true
          }
        }
      }
    });
  }

  remove(id: number) {
    return this.prisma.customer.delete({
      where: { id },
    });
  }

  async getCustomerRates(customerId: number) {
    return this.prisma.customerProductRate.findMany({
      where: { customerId },
      include: { product: true },
      orderBy: { productId: 'asc' },
    });
  }

  async upsertCustomerRate(customerId: number, productId: number, rate: number) {
    return this.prisma.customerProductRate.upsert({
      where: {
        customerId_productId: { customerId, productId },
      },
      update: { rate },
      create: { customerId, productId, rate },
    });
  }

  async setCustomerRates(customerId: number, rates: { productId: number; rate: number }[], replaceAll = true) {
    if (replaceAll) {
      await this.prisma.customerProductRate.deleteMany({ where: { customerId } });
      const validRates = rates.filter(item => item.productId > 0 && item.rate > 0);
      if (validRates.length > 0) {
        await this.prisma.customerProductRate.createMany({
          data: validRates.map(item => ({
            customerId,
            productId: Number(item.productId),
            rate: Number(item.rate)
          }))
        });
      }
      return this.getCustomerRates(customerId);
    }
    const results = [];
    for (const item of rates) {
      if (item.productId > 0) {
        const res = await this.upsertCustomerRate(customerId, Number(item.productId), Number(item.rate));
        results.push(res);
      }
    }
    return results;
  }
}
