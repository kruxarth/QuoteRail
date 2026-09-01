import { eq } from 'drizzle-orm';
import {
  approvals,
  auditEvents,
  authAttempts,
  merchants,
  offerings,
  paymentLinks,
  policyEvaluations,
  quoteAcceptances,
  quoteItems,
  quotes,
  resourceReservations,
  resourceSlots,
  rfqMessages,
  rfqs,
  webhookEvents,
} from '@/db/schema';
import type { Database } from '@/db/client';
import { createId } from '@/shared/ids';
import { CURRENCY, MERCHANT_NAME, MERCHANT_SLUG } from '@/shared/constants';
import { rupeesToPaise } from '@/shared/money';
import { OFFERING_SEEDS } from '@/server/catalog/offerings';
import {
  demoDates,
  isStudioFridayEveningBlock,
  seedSlotCalendar,
} from '@/server/availability/slots';
import type { Clock } from '@/shared/clock';

export const MERCHANT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001';

export function offeringIdFor(code: string): string {
  const index = OFFERING_SEEDS.findIndex((item) => item.code === code) + 1;
  return `bbbbbbbb-cccc-4ddd-8eee-ffffffffff${String(index).padStart(2, '0')}`;
}

export async function seedMerchantCatalog(db: Database): Promise<void> {
  await db
    .insert(merchants)
    .values({
      id: MERCHANT_ID,
      slug: MERCHANT_SLUG,
      name: MERCHANT_NAME,
      currency: CURRENCY,
      active: true,
    })
    .onConflictDoUpdate({
      target: merchants.slug,
      set: { name: MERCHANT_NAME, active: true, updatedAt: new Date() },
    });

  for (const seed of OFFERING_SEEDS) {
    await db
      .insert(offerings)
      .values({
        id: offeringIdFor(seed.code),
        merchantId: MERCHANT_ID,
        code: seed.code,
        name: seed.name,
        description: seed.description,
        category: seed.category,
        pricingModel: seed.pricingModel,
        salePriceSubunits: rupeesToPaise(seed.saleRupees),
        costSubunits: rupeesToPaise(seed.costRupees),
        capacityUnits: seed.capacityUnits,
        capacityLabel: seed.capacityLabel,
        capabilities: seed.capabilities,
        active: true,
      })
      .onConflictDoUpdate({
        target: [offerings.merchantId, offerings.code],
        set: {
          name: seed.name,
          description: seed.description,
          category: seed.category,
          pricingModel: seed.pricingModel,
          salePriceSubunits: rupeesToPaise(seed.saleRupees),
          costSubunits: rupeesToPaise(seed.costRupees),
          capacityUnits: seed.capacityUnits,
          capacityLabel: seed.capacityLabel,
          capabilities: seed.capabilities,
          active: true,
          updatedAt: new Date(),
        },
      });
  }
}

export async function seedAvailability(db: Database, clock: Clock): Promise<{
  friday: string;
  thursday: string;
}> {
  const { friday, thursday } = demoDates(clock);
  await db.delete(resourceSlots);
  const calendar = seedSlotCalendar(clock);
  const reserved = OFFERING_SEEDS.filter((item) => item.capacityUnits !== null);
  const rows = [];
  for (const offering of reserved) {
    for (const slot of calendar) {
      const blocked =
        offering.code === 'HALL-STUDIO' &&
        isStudioFridayEveningBlock(slot.date, slot.window, friday);
      rows.push({
        id: createId(),
        offeringId: offeringIdFor(offering.code),
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        bufferStartsAt: slot.bufferStartsAt,
        bufferEndsAt: slot.bufferEndsAt,
        capacityTotal: offering.capacityUnits ?? 1,
        blockedUnits: blocked ? 1 : 0,
        blockReason: blocked ? 'Pre-existing merchant booking' : null,
        active: true,
      });
    }
  }
  if (rows.length) await db.insert(resourceSlots).values(rows);
  return { friday, thursday };
}

export async function clearTransactionalData(db: Database): Promise<void> {
  await db.delete(webhookEvents);
  await db.delete(paymentLinks);
  await db.delete(resourceReservations);
  await db.delete(quoteItems);
  await db.delete(policyEvaluations);
  await db.delete(approvals);
  await db.delete(quoteAcceptances);
  await db.delete(quotes);
  await db.delete(rfqMessages);
  await db.delete(rfqs);
  await db.delete(auditEvents);
  await db.delete(authAttempts);
}

export async function resetDemo(db: Database, clock: Clock) {
  await clearTransactionalData(db);
  await seedMerchantCatalog(db);
  const dates = await seedAvailability(db, clock);
  const [merchant] = await db.select().from(merchants).where(eq(merchants.slug, MERCHANT_SLUG)).limit(1);
  return { ...dates, merchantId: merchant?.id ?? MERCHANT_ID };
}
