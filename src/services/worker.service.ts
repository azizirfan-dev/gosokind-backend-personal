import { prisma } from "../lib/prisma";
import { StationType, OrderStatus } from "../generated/prisma/client";

interface ProcessOrderPayload {
  orderId: string;
  workerId: string;
  station: StationType;
  items: { laundryItemId: string; quantity: number }[];
}

// --- PUBLIC METHODS ---

// [cite: 240, 241] Melihat daftar pesanan yang MASUK ke station
export const getIncomingOrders = async (station: StationType, page: number, limit: number) => {
  const targetStatus = getStatusForStation(station);
  if (!targetStatus) return { data: [], meta: { page, limit, total: 0, lastPage: 0 } };

  const [data, total] = await prisma.$transaction([
    prisma.order.findMany({
      where: { status: targetStatus },
      include: { orderItems: { include: { laundryItem: true } } },
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where: { status: targetStatus } })
  ]);

  return { data, meta: { page, limit, total, lastPage: Math.ceil(total / limit) } };
};

//  Melihat history pekerjaan worker
export const getWorkerHistory = async (workerId: string, page: number, limit: number) => {
  const [data, total] = await prisma.$transaction([
    prisma.orderStationProcess.findMany({
      where: { workerId },
      include: { order: { include: { orderItems: { include: { laundryItem: true } } } } },
      orderBy: { completedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.orderStationProcess.count({ where: { workerId } })
  ]);

  return { data, meta: { page, limit, total, lastPage: Math.ceil(total / limit) } };
};

export const processStationOrder = async (payload: ProcessOrderPayload) => {
  const { orderId, workerId, station, items } = payload;
  const dbOrderItems = await fetchOrderItems(orderId);
  
  validateItemQuantities(items, dbOrderItems);

  return await createStationProcess(orderId, workerId, station, items);
};

// --- PRIVATE HELPERS (<15 Lines) ---

const getStatusForStation = (station: StationType): OrderStatus | null => {
  if (station === StationType.WASHING) return OrderStatus.ARRIVED_AT_OUTLET; // Siap Cuci [cite: 70]
  if (station === StationType.IRONING) return OrderStatus.WASHING; // Siap Setrika (dari Washing) [cite: 72]
  if (station === StationType.PACKING) return OrderStatus.IRONING; // Siap Packing (dari Ironing) [cite: 74]
  return null;
};

const fetchOrderItems = async (orderId: string) => {
  return await prisma.orderItem.findMany({ where: { orderId } });
};

const validateItemQuantities = (
  inputItems: ProcessOrderPayload["items"],
  dbItems: { laundryItemId: string; quantity: number }[]
) => {
  if (inputItems.length !== dbItems.length) throw new Error("QTY_MISMATCH");

  const mismatches = [];

  for (const inputItem of inputItems) {
    const dbItem = dbItems.find((oi) => oi.laundryItemId === inputItem.laundryItemId);
    
    if (!dbItem || dbItem.quantity !== inputItem.quantity) {
        mismatches.push({
            itemId: inputItem.laundryItemId,
            expected: dbItem?.quantity || 0,
            actual: inputItem.quantity
        });
    }
  }

  if (mismatches.length > 0) {
      const error: any = new Error("QTY_MISMATCH");
      error.details = mismatches;
      throw error;
  }
};

const determineNextStatus = (station: StationType, isPaid: boolean): OrderStatus | null => {
  if (station === StationType.WASHING) return OrderStatus.WASHING; // Output: Ready for Ironing
  if (station === StationType.IRONING) return OrderStatus.IRONING; // Output: Ready for Packing
  if (station === StationType.PACKING) {
    return isPaid ? OrderStatus.READY_FOR_DELIVERY : OrderStatus.WAITING_FOR_PAYMENT;
  }
  return null;
};

const createStationProcess = async (
  orderId: string, workerId: string, station: StationType, items: ProcessOrderPayload["items"]
) => {
  return await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, select: { isPaid: true } });
    const nextStatus = determineNextStatus(station, order.isPaid);

    if (nextStatus) {
      await tx.order.update({ where: { id: orderId }, data: { status: nextStatus } });
    }

    return await tx.orderStationProcess.create({
      data: {
        orderId, station, workerId, completedAt: new Date(),
        itemChecks: { create: items.map((i) => ({ laundryItemId: i.laundryItemId, inputQuantity: i.quantity })) },
      },
      include: { itemChecks: true },
    });
  });
};