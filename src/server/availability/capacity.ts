import { and, eq, inArray, lt } from 'drizzle-orm';
import { resourceReservations, resourceSlots } from '@/db/schema';
import type { Database, Transaction } from '@/db/client';
import { SETUP_BUFFER_HOURS } from '@/shared/constants';
import { bufferedRange, rangesOverlap, slotRange, type SlotWindow } from '@/shared/clock';
import type { AvailabilityEvidence } from '@/server/policy/engine';

export async function expireStaleReservations(db: Database | Transaction, now: Date): Promise<string[]> {
  const stale = await db
    .select({ id: resourceReservations.id })
    .from(resourceReservations)
    .where(and(eq(resourceReservations.status, 'active'), lt(resourceReservations.expiresAt, now)));
  if (stale.length === 0) return [];
  await db
    .update(resourceReservations)
    .set({ status: 'expired', releasedAt: now, updatedAt: now })
    .where(
      inArray(
        resourceReservations.id,
        stale.map((row) => row.id),
      ),
    );
  return stale.map((row) => row.id);
}

export async function availableUnitsForSlot(
  db: Database | Transaction,
  slotId: string,
  reservedStartsAt: Date,
  reservedEndsAt: Date,
): Promise<{ capacityTotal: number; blockedUnits: number; reservedUnits: number; available: number }> {
  const [slot] = await db
    .select()
    .from(resourceSlots)
    .where(eq(resourceSlots.id, slotId))
    .limit(1);
  if (!slot) {
    return { capacityTotal: 0, blockedUnits: 0, reservedUnits: 0, available: 0 };
  }
  const overlapping = await db
    .select()
    .from(resourceReservations)
    .where(
      and(
        eq(resourceReservations.offeringId, slot.offeringId),
        inArray(resourceReservations.status, ['active', 'committed']),
      ),
    );
  const reservedUnits = overlapping
    .filter((row) => rangesOverlap(reservedStartsAt, reservedEndsAt, row.reservedStartsAt, row.reservedEndsAt))
    .reduce((sum, row) => sum + row.units, 0);
  const available = slot.capacityTotal - slot.blockedUnits - reservedUnits;
  return {
    capacityTotal: slot.capacityTotal,
    blockedUnits: slot.blockedUnits,
    reservedUnits,
    available: Math.max(0, available),
  };
}

export async function resolveSlot(
  db: Database | Transaction,
  offeringId: string,
  date: string,
  window: SlotWindow,
) {
  const range = slotRange(date, window);
  const [slot] = await db
    .select()
    .from(resourceSlots)
    .where(
      and(
        eq(resourceSlots.offeringId, offeringId),
        eq(resourceSlots.startsAt, range.startsAt),
        eq(resourceSlots.endsAt, range.endsAt),
        eq(resourceSlots.active, true),
      ),
    )
    .limit(1);
  return slot ?? null;
}

export async function evidenceForOffering(params: {
  db: Database | Transaction;
  offeringId: string;
  offeringCode: string;
  date: string;
  window: SlotWindow;
  requestedUnits: number;
  exclusive: boolean;
}): Promise<AvailabilityEvidence> {
  const range = slotRange(params.date, params.window);
  const buffered = params.exclusive
    ? bufferedRange(range.startsAt, range.endsAt, SETUP_BUFFER_HOURS)
    : { bufferStartsAt: range.startsAt, bufferEndsAt: range.endsAt };
  const slot = await resolveSlot(params.db, params.offeringId, params.date, params.window);
  if (!slot) {
    return {
      offeringCode: params.offeringCode,
      slotId: null,
      availableUnits: 0,
      requestedUnits: params.requestedUnits,
      overlapConflict: true,
    };
  }
  const capacity = await availableUnitsForSlot(
    params.db,
    slot.id,
    buffered.bufferStartsAt,
    buffered.bufferEndsAt,
  );
  return {
    offeringCode: params.offeringCode,
    slotId: slot.id,
    availableUnits: capacity.available,
    requestedUnits: params.requestedUnits,
    overlapConflict: capacity.available < params.requestedUnits,
  };
}
