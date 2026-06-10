/**
 * Seed script — creates one demo store and a few waiting tickets so the PoC
 * is demoable right after `npm run db:setup` (design.md §3.6 PoC scope).
 *
 * It also prints the signed scan URL for the demo store so you can open/scan it.
 */
import { PrismaClient } from '@prisma/client';
import { createHmac } from 'node:crypto';

const prisma = new PrismaClient();

// Fixed store id so the printed scan URL is stable across re-seeds.
const DEMO_STORE_ID = '11111111-1111-1111-1111-111111111111';

function signStore(storeId: string, secret: string): string {
  return createHmac('sha256', secret).update(storeId).digest('hex');
}

async function main() {
  const secret = process.env.STORE_QR_SECRET ?? 'poc-dev-store-qr-secret-change-me';
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

  // Reset demo data (idempotent re-seed).
  await prisma.ticket.deleteMany({ where: { storeId: DEMO_STORE_ID } });
  await prisma.store.deleteMany({ where: { id: DEMO_STORE_ID } });

  const store = await prisma.store.create({
    data: {
      id: DEMO_STORE_ID,
      name: 'On Running — Demo Store',
      timezone: 'Asia/Shanghai',
      staffCount: 2,
      readyTimeoutMinutes: 5,
      recallWindowMinutes: 15,
      servingAlertMinutes: 20,
    },
  });

  // A few pre-existing waiting tickets (each needs its own anonymous client).
  for (let i = 1; i <= 4; i++) {
    const client = await prisma.client.create({ data: {} });
    await prisma.ticket.create({
      data: {
        storeId: store.id,
        clientId: client.id,
        number: i,
        status: 'WAITING',
      },
    });
  }

  const sig = signStore(store.id, secret);
  const scanUrl = `${webOrigin}/s/${store.id}?sig=${sig}`;

  console.log('\nSeed complete.');
  console.log(`  Store: ${store.name} (${store.id})`);
  console.log(`  Pre-seeded waiting tickets: 4`);
  console.log(`  Scan URL (open this to take a ticket):\n    ${scanUrl}`);
  console.log(`  Admin page: ${webOrigin}/admin/${store.id}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
