import { prisma } from "../lib/prisma";
import { OrderStatus } from "../generated/prisma/client";

// --- PUBLIC METHODS ---

export const checkAvailability = async (driverId: string) => {
  const activeJob = await getActiveJob(driverId);
  if (activeJob) {
    return { available: false, reason: "DRIVER_BUSY" };
  }
  return { available: true };
};

// [cite: frontend-gap] Aggregator untuk Frontend "activeJob"
export const getDriverActiveJob = async (driverId: string) => {
  const job = await getActiveJob(driverId);
  if (!job) return null;

  // Transform ke format Frontend Friendly
  return {
    ...job,
    type: job.pickupDriverId === driverId ? 'PICKUP' : 'DELIVERY'
  };
};

// [cite: frontend-gap] Aggregator untuk Frontend "availableJobs"
export const getAvailableJobs = async () => {
    // Ambil Pickup yg WAITING DAN Delivery yg READY
    const [pickups, deliveries] = await prisma.$transaction([
        prisma.order.findMany({
            where: { status: OrderStatus.WAITING_FOR_PICKUP, pickupDriverId: null },
            include: { customer: { select: { fullName: true } }, address: true, orderItems: true }, // [cite: 194] Relation is 'customer', not 'user'
            orderBy: { createdAt: 'asc' }
        }),
        prisma.order.findMany({
            where: { status: OrderStatus.READY_FOR_DELIVERY, deliveryDriverId: null },
            include: { customer: { select: { fullName: true } }, address: true, orderItems: true },
            orderBy: { updatedAt: 'asc' }
        })
    ]);

    // Gabung dan labeli tipe
    return [
        ...pickups.map(p => ({ ...p, type: 'PICKUP', customerName: p.customer.fullName, address: p.address.address })),
        ...deliveries.map(d => ({ ...d, type: 'DELIVERY', customerName: d.customer.fullName, address: d.address.address }))
    ];
};

export const acceptPickup = async (driverId: string, orderId: string) => {
  await ensureDriverIdle(driverId);

  // ATOMIC LOCK: Update hanya jika status masih WAITING dan Driver NULL
  const res = await prisma.order.updateMany({
    where: {
      id: orderId,
      status: OrderStatus.WAITING_FOR_PICKUP, // [cite: 65]
      pickupDriverId: null, // Mencegah race condition
    },
    data: { pickupDriverId: driverId, status: OrderStatus.PICKUP_ON_THE_WAY }, // [cite: 67]
  });

  if (res.count === 0) throw new Error("ORDER_UNAVAILABLE");
  return { success: true };
};

export const completePickup = async (driverId: string, orderId: string) => {
  // Verifikasi driver yang request adalah driver yang ambil order
  const order = await prisma.order.findFirst({
    where: { id: orderId, pickupDriverId: driverId, status: OrderStatus.PICKUP_ON_THE_WAY },
  });
  
  if (!order) throw new Error("ORDER_NOT_FOUND_OR_INVALID");

  return await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.ARRIVED_AT_OUTLET }, // [cite: 69]
  });
};

export const acceptDelivery = async (driverId: string, orderId: string) => {
  await ensureDriverIdle(driverId);

  const res = await prisma.order.updateMany({
    where: {
      id: orderId,
      status: OrderStatus.READY_FOR_DELIVERY, // [cite: 79]
      deliveryDriverId: null,
    },
    data: { deliveryDriverId: driverId, status: OrderStatus.DELIVERY_ON_THE_WAY }, // [cite: 81]
  });

  if (res.count === 0) throw new Error("ORDER_UNAVAILABLE");
  return { success: true };
};

export const completeDelivery = async (driverId: string, orderId: string) => {
   // Driver menyelesaikan tugas delivery
   const order = await prisma.order.findFirst({
    where: { id: orderId, deliveryDriverId: driverId, status: OrderStatus.DELIVERY_ON_THE_WAY },
  });

  if (!order) throw new Error("ORDER_NOT_FOUND_OR_INVALID");

  return await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.RECEIVED_BY_CUSTOMER }, // [cite: 83]
  });
};

// --- PRIVATE HELPERS (<15 Lines) ---

const getActiveJob = async (driverId: string) => {
  return await prisma.order.findFirst({
    where: {
      OR: [
        { pickupDriverId: driverId, status: OrderStatus.PICKUP_ON_THE_WAY },
        { deliveryDriverId: driverId, status: OrderStatus.DELIVERY_ON_THE_WAY },
      ],
    },
    include: {
      customer: { select: { fullName: true } },
      address: true,
      orderItems: true
    }
  });
};

const ensureDriverIdle = async (driverId: string) => {
  const active = await getActiveJob(driverId);
  if (active) throw new Error("DRIVER_BUSY"); // [cite: 37, 234]
};

export const getDriverHistory = async (driverId: string, limit = 10) => {
  const [pickups, deliveries] = await prisma.$transaction([
    prisma.order.findMany({
      where: { pickupDriverId: driverId, status: { in: [OrderStatus.ARRIVED_AT_OUTLET, OrderStatus.WASHING, OrderStatus.IRONING, OrderStatus.PACKING, OrderStatus.READY_FOR_DELIVERY, OrderStatus.DELIVERY_ON_THE_WAY, OrderStatus.RECEIVED_BY_CUSTOMER, OrderStatus.COMPLETED] } },
      include: { customer: { select: { fullName: true } }, address: true, orderItems: true },
      orderBy: { updatedAt: 'desc' }, take: limit
    }),
    prisma.order.findMany({
      where: { deliveryDriverId: driverId, status: { in: [OrderStatus.RECEIVED_BY_CUSTOMER, OrderStatus.COMPLETED] } },
      include: { customer: { select: { fullName: true } }, address: true, orderItems: true },
      orderBy: { updatedAt: 'desc' }, take: limit
    })
  ]);

  return [
    ...pickups.map(p => ({ ...p, type: 'PICKUP', customerName: p.customer.fullName, address: p.address.address })),
    ...deliveries.map(d => ({ ...d, type: 'DELIVERY', customerName: d.customer.fullName, address: d.address.address }))
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, limit);
};