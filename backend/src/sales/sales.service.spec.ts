import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from './sales.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SalesService - Last Edited Sale Rate Persistence', () => {
  let service: SalesService;
  let mockTx: any;
  let mockPrisma: any;

  beforeEach(async () => {
    mockTx = {
      settings: {
        findUnique: jest.fn().mockResolvedValue({
          id: 1,
          invoicePrefix: 'INV-',
          enableCustomerWiseRate: false,
          enableInvoiceEdit: true,
          invoiceEditDays: 30,
        }),
      },
      sale: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 1, invoiceNo: 'INV-00001', items: [] }),
        update: jest.fn().mockResolvedValue({ id: 1, invoiceNo: 'INV-00001', items: [] }),
      },
      saleItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      customer: {
        findFirst: jest.fn().mockResolvedValue({ id: 99, name: 'Cash Customer' }),
        create: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 1 }),
      },
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 10,
          sellingRate: 150,
          wholesaleRate: 130,
          mrp: 180,
          currentStock: 20,
        }),
        update: jest.fn().mockResolvedValue({ currentStock: 19 }),
      },
      customerProductRate: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
      serviceItem: {
        findUnique: jest.fn().mockResolvedValue({ id: 5, rate: 200 }),
        update: jest.fn(),
      },
      stockTransaction: {
        create: jest.fn().mockResolvedValue({ id: 1 }),
      },
    };

    mockPrisma = {
      $transaction: jest.fn(async (cb: any) => cb(mockTx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
  });

  const makePayload = (overrides: Record<string, any> = {}) => ({
    invoiceNo: 'INV-00001',
    date: '2026-11-11',
    customerId: 0,
    rateType: 'Retail Rate',
    paymentModeId: 1,
    subtotal: 120,
    tax: 0,
    discount: 0,
    grandTotal: 120,
    items: [
      {
        productId: 10,
        isService: false,
        quantity: 1,
        rate: 120,
        discount: 0,
        tax: 0,
        amount: 120,
      },
    ],
    ...overrides,
  });

  it('persists a lowered retail sellingRate on the product for future sales', async () => {
    await service.create(makePayload({ items: [{ productId: 10, quantity: 2, rate: 120, amount: 240 }] }) as any, 1);

    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        currentStock: { decrement: 2 },
        sellingRate: 120,
      },
    });
  });

  it('persists wholesaleRate and mrp according to rateType', async () => {
    await service.create(
      makePayload({
        rateType: 'Wholesale Rate',
        items: [{ productId: 10, quantity: 1, rate: 115, amount: 115 }],
      }) as any,
      1,
    );

    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        currentStock: { decrement: 1 },
        wholesaleRate: 115,
      },
    });

    await service.create(
      makePayload({
        rateType: 'MRP',
        items: [{ productId: 10, quantity: 1, rate: 175, amount: 175 }],
      }) as any,
      1,
    );

    expect(mockTx.product.update).toHaveBeenLastCalledWith({
      where: { id: 10 },
      data: {
        currentStock: { decrement: 1 },
        mrp: 175,
      },
    });
  });

  it('updates CustomerProductRate when customer-wise rate exists without overwriting product sellingRate', async () => {
    mockTx.settings.findUnique.mockResolvedValueOnce({
      id: 1,
      invoicePrefix: 'INV-',
      enableCustomerWiseRate: true,
    });
    mockTx.customerProductRate.findUnique.mockResolvedValueOnce({
      id: 77,
      customerId: 42,
      productId: 10,
      rate: 140,
    });

    await service.create(
      makePayload({
        customerId: 42,
        items: [{ productId: 10, quantity: 1, rate: 135, amount: 135 }],
      }) as any,
      1,
    );

    expect(mockTx.customerProductRate.update).toHaveBeenCalledWith({
      where: { id: 77 },
      data: { rate: 135 },
    });
    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { currentStock: { decrement: 1 } },
    });
  });

  it('updates Unified POS service item rate when edited during a sale', async () => {
    await service.create(
      makePayload({
        items: [
          {
            isService: true,
            serviceItemId: 5,
            itemName: 'Printing Setup',
            quantity: 1,
            rate: 165,
            amount: 165,
          },
        ],
      }) as any,
      1,
    );

    expect(mockTx.serviceItem.update).toHaveBeenCalledWith({
      where: { id: 5 },
      data: { rate: 165 },
    });
  });

  it('persists newly edited rate when updating an existing sale', async () => {
    mockTx.sale.findUnique.mockResolvedValueOnce({
      id: 50,
      invoiceNo: 'INV-00001',
      date: new Date(),
      items: [],
    });

    await service.update(
      50,
      makePayload({
        items: [{ productId: 10, quantity: 1, rate: 95, amount: 95 }],
      }),
      1,
    );

    expect(mockTx.product.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: {
        currentStock: { decrement: 1 },
        sellingRate: 95,
      },
    });
  });
});

