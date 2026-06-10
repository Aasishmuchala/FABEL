'use server';

import { revalidatePath } from 'next/cache';
import { getSite, mondayOf, submitBill } from '@/lib/store';

export interface ReconcileBillInput {
  siteId: string;
  weekStart: string;
  billedLabourDays: number;
  amountInr: number;
}

export interface ReconcileBillResult {
  ok: boolean;
  error?: string;
}

export async function reconcileBill(
  input: ReconcileBillInput,
): Promise<ReconcileBillResult> {
  const { siteId, weekStart, billedLabourDays, amountInr } = input;

  if (!siteId || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return { ok: false, error: 'Invalid bill reference — reload and try again.' };
  }
  // Server actions are publicly callable endpoints: never write a phantom
  // bill for an unknown site or a shifted/incomplete billing week.
  if (!getSite(siteId)) {
    return { ok: false, error: 'Unknown site — reload and try again.' };
  }
  if (weekStart !== mondayOf(weekStart)) {
    return {
      ok: false,
      error: 'Billing weeks start on a Monday — reload and try again.',
    };
  }
  {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (weekStart >= mondayOf(today)) {
      return {
        ok: false,
        error:
          'This week is still in progress — bills reconcile against completed weeks only.',
      };
    }
  }
  if (!Number.isFinite(billedLabourDays) || billedLabourDays <= 0) {
    return { ok: false, error: 'Billed labour-days must be a positive number.' };
  }
  if (!Number.isFinite(amountInr) || amountInr <= 0) {
    return { ok: false, error: 'Bill amount must be a positive number.' };
  }

  try {
    submitBill({
      siteId,
      weekStart,
      billedLabourDays: Math.round(billedLabourDays),
      amountInr: Math.round(amountInr),
    });
  } catch {
    return { ok: false, error: 'Could not reconcile the bill — try again.' };
  }

  revalidatePath('/reconciliation');
  return { ok: true };
}
