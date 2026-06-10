'use server';

import { revalidatePath } from 'next/cache';
import { resolveAlert } from '@/lib/store';

/**
 * Marks an alert resolved (resolvedIso = now) and refreshes the pages that
 * surface alert state. The original note is preserved — resolution does not
 * rewrite ledger evidence.
 */
export async function resolveAlertAction(alertId: string): Promise<void> {
  resolveAlert(alertId);
  revalidatePath('/alerts');
  revalidatePath('/');
}
