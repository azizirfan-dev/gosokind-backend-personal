import 'dotenv/config';
import { prisma } from './src/lib/prisma';

async function checkOrder() {
  const order = await prisma.order.findUnique({
    where: { orderNumber: 'INV-FLOW-001' },
    include: { pickupDriver: true, deliveryDriver: true }
  });

  console.log('Order Status:', order?.status);
  console.log('Pickup Driver:', order?.pickupDriver?.email);
  console.log('Order ID:', order?.id);
}

checkOrder()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
