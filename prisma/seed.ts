import { prisma } from "../src/lib/prisma";
import { EmployeeRole, OrderStatus } from "../src/generated/prisma";
import bcrypt from "bcrypt";

async function main() {
  console.log("🚀 Starting Unified Seeding...");
  
  // CLEANUP: Reset data to ensure clean state
  await prisma.bypassRequest.deleteMany({});
  await prisma.stationItemCheck.deleteMany({});
  await prisma.orderStationProcess.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  console.log("🧹 Cleared existing orders and items.");

  const password = await bcrypt.hash("123456", 10);

  // 1. Create Outlet
  const outlet = await prisma.outlet.upsert({
    where: { id: "outlet-pusat" },
    update: {},
    create: {
      id: "outlet-pusat",
      name: "GosokInd Pusat",
      address: "Jl. Sudirman No. 1",
      latitude: -6.2088,
      longitude: 106.8456,
    },
  });

  // 2. Create Employees (All Roles)
  const employees = [
    { email: "driver@gosokind.com", role: EmployeeRole.DRIVER, name: "Aziz Driver" },
    { email: "washing@gosokind.com", role: EmployeeRole.WORKER_WASHING, name: "Fahmi Washing" },
    { email: "ironing@gosokind.com", role: EmployeeRole.WORKER_IRONING, name: "Rafa Ironing" },
    { email: "packing@gosokind.com", role: EmployeeRole.WORKER_PACKING, name: "Joko Packing" },
  ];

  for (const emp of employees) {
    await prisma.employee.upsert({
      where: { email: emp.email },
      update: {},
      create: {
        email: emp.email,
        password: password,
        fullName: emp.name,
        role: emp.role,
        outletId: outlet.id,
      },
    });
  }
  console.log("✅ Employees Seeded (Pass: 123456)");

  // 3. Create Master Data (Laundry Items)
  const itemKaos = await prisma.laundryItem.upsert({
    where: { id: "item-kaos" }, update: {},
    create: { id: "item-kaos", name: "Kaos" }
  });
  const itemCelana = await prisma.laundryItem.upsert({
    where: { id: "item-celana" }, update: {},
    create: { id: "item-celana", name: "Celana" }
  });

  // 4. Create Customer & Address
  const customer = await prisma.customer.upsert({
    where: { email: "customer.test@gmail.com" },
    update: {},
    create: {
      email: "customer.test@gmail.com",
      fullName: "Pak Customer",
      password: password,
      isVerified: true
    }
  });

  const address = await prisma.address.create({
    data: {
      label: "Rumah Utama", address: "Jl. Test No. 123", latitude: 0, longitude: 0,
      customerId: customer.id
    }
  });

  // 5. Create Test Orders for Feature 3
  
  // ORDER 1: Untuk testing DRIVER (Waiting for Pickup)
  await prisma.order.upsert({
    where: { orderNumber: "INV-DRIVER-001" },
    update: {},
    create: {
      orderNumber: "INV-DRIVER-001",
      customerId: customer.id,
      addressId: address.id,
      status: OrderStatus.WAITING_FOR_PICKUP,
      orderItems: {
        create: [
          { laundryItemId: itemKaos.id, quantity: 3 },
          { laundryItemId: itemCelana.id, quantity: 2 }
        ]
      }
    }
  });

  // ORDER 2: Untuk testing WORKER (Ready for Washing)
  await prisma.order.upsert({
    where: { orderNumber: "INV-WASH-001" },
    update: { status: OrderStatus.ARRIVED_AT_OUTLET },
    create: {
      orderNumber: "INV-WASH-001",
      customerId: customer.id,
      addressId: address.id,
      status: OrderStatus.ARRIVED_AT_OUTLET, 
      orderItems: {
        create: { laundryItemId: itemKaos.id, quantity: 10 }
      }
    }
  });

  console.log("✅ Feature 3 Orders Seeded Successfully.");

  // ORDER 3: Untuk testing DRIVER SINGLE JOB POLICY (Driver has active job)
  // [DISABLED FOR E2E FLOW TEST] - Uncomment to test blocking
  /*
  const driver = await prisma.employee.findUnique({ where: { email: "driver@gosokind.com" } });
  if (driver) {
      await prisma.order.upsert({
        where: { orderNumber: "INV-DRIVER-ACTIVE" },
        update: {},
        create: {
          orderNumber: "INV-DRIVER-ACTIVE",
          customerId: customer.id,
          addressId: address.id,
          status: OrderStatus.PICKUP_ON_THE_WAY,
          pickupDriverId: driver.id,
          orderItems: {
            create: { laundryItemId: itemKaos.id, quantity: 5 }
          }
        }
      });
      console.log("✅ Seeded Active Job for Driver (Test Blocking Policy)");
  }
  */

  // NEW: E2E FLOW ORDER (Full Cycle)
  await prisma.order.upsert({
    where: { orderNumber: "INV-FLOW-001" },
    update: { status: OrderStatus.WAITING_FOR_PICKUP, pickupDriverId: null, deliveryDriverId: null },
    create: {
        orderNumber: "INV-FLOW-001",
        customerId: customer.id,
        addressId: address.id,
        status: OrderStatus.WAITING_FOR_PICKUP,
        orderItems: {
            create: { laundryItemId: itemKaos.id, quantity: 5 }
        }
    }
  });

  // NEW: DELIVERY FLOW ORDER
  await prisma.order.upsert({
    where: { orderNumber: "INV-FLOW-DELIVERY" },
    update: { status: OrderStatus.READY_FOR_DELIVERY, deliveryDriverId: null },
    create: {
        orderNumber: "INV-FLOW-DELIVERY",
        customerId: customer.id,
        addressId: address.id,
        status: OrderStatus.READY_FOR_DELIVERY,
        isPaid: true,
        orderItems: {
            create: { laundryItemId: itemCelana.id, quantity: 3 }
        }
    }
  });
  console.log("✅ Seeded E2E Flow Orders (INV-FLOW-001, INV-FLOW-DELIVERY)");

  // ORDER 4: Untuk testing WORKER IRONING
  await prisma.order.upsert({
    where: { orderNumber: "INV-IRON-001" },
    update: { status: OrderStatus.WASHING },
    create: {
        orderNumber: "INV-IRON-001",
        customerId: customer.id,
        addressId: address.id,
        status: OrderStatus.WASHING,
        orderItems: {
            create: { laundryItemId: itemKaos.id, quantity: 5 }
        }
    }
  });

  // ORDER 5: Untuk testing WORKER PACKING
  await prisma.order.upsert({
    where: { orderNumber: "INV-PACK-001" },
    update: { status: OrderStatus.IRONING },
    create: {
        orderNumber: "INV-PACK-001",
        customerId: customer.id,
        addressId: address.id,
        status: OrderStatus.IRONING,
        orderItems: {
            create: { laundryItemId: itemCelana.id, quantity: 5 }
        }
    }
  });

  // 6. BATCH ORDERS (10 Samples)
  console.log("📦 Seeding 10 Batch Orders...");
  for (let i = 1; i <= 10; i++) {
    const paddedId = i.toString().padStart(3, '0');
    const isEven = i % 2 === 0;
    
    await prisma.order.upsert({
      where: { orderNumber: `INV-BATCH-${paddedId}` },
      update: { status: OrderStatus.WAITING_FOR_PICKUP },
      create: {
        orderNumber: `INV-BATCH-${paddedId}`,
        customerId: customer.id,
        addressId: address.id,
        status: OrderStatus.WAITING_FOR_PICKUP,
        orderItems: {
          create: [
            { laundryItemId: itemKaos.id, quantity: isEven ? 5 : 2 },
            { laundryItemId: itemCelana.id, quantity: isEven ? 2 : 5 }
          ]
        }
      }
    });
  }
  console.log("✅ 10 Batch Orders Seeded (INV-BATCH-001 to 010)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());