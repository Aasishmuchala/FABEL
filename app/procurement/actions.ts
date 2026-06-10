'use server';

import { revalidatePath } from 'next/cache';
import { placeOrder } from '@/lib/store';

export interface PlaceOrderActionInput {
  siteId: string;
  stageId: string;
  vendorId: string;
  lines: Array<{ boqItemId: string; qty: number }>;
}

export type PlaceOrderActionResult =
  | { ok: true; orderId: string; totalInr: number; etaDate: string }
  | { ok: false; error: string };

/**
 * Places a quality-gated material order via the store and revalidates the
 * procurement page. Store errors (quality gate, BOQ caps, …) are returned
 * verbatim so the client can show them inline.
 */
export async function placeOrderAction(
  input: PlaceOrderActionInput,
): Promise<PlaceOrderActionResult> {
  // Server actions are publicly callable endpoints: re-check the payload shape
  // before handing it to the store.
  if (
    !input ||
    typeof input.siteId !== 'string' ||
    typeof input.stageId !== 'string' ||
    typeof input.vendorId !== 'string' ||
    !Array.isArray(input.lines)
  ) {
    return { ok: false, error: 'Invalid order payload — reload and try again.' };
  }

  const result = placeOrder({
    siteId: input.siteId,
    stageId: input.stageId,
    vendorId: input.vendorId,
    lines: input.lines.map((l) => ({
      boqItemId: String(l.boqItemId),
      qty: Number(l.qty),
    })),
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  revalidatePath('/procurement');
  return {
    ok: true,
    orderId: result.order.id,
    totalInr: result.order.totalInr,
    etaDate: result.order.etaDate,
  };
}
