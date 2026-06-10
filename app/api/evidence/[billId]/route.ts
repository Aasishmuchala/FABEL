import {
  getBills,
  getClips,
  getDailyCounts,
  getLedger,
  getReconciliations,
  getSite,
  verifyLedger,
} from '@/lib/store';
import { weekDatesOf } from '@/components/reconciliation/week';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ billId: string }> },
) {
  const { billId } = await params;

  const bill = getBills().find((b) => b.id === billId);
  if (!bill) {
    return Response.json({ error: 'Bill not found' }, { status: 404 });
  }

  const site = getSite(bill.siteId);
  const reconciliation = getReconciliations(bill.siteId).find(
    (r) => r.billId === billId,
  );
  const weekDates = new Set(weekDatesOf(bill.weekStart));
  const dailyCounts = getDailyCounts(bill.siteId).filter((c) =>
    weekDates.has(c.date),
  );
  const ledgerEntries = getLedger(bill.siteId).filter((l) =>
    weekDates.has(l.date),
  );
  const clips = getClips(bill.siteId).filter((c) => weekDates.has(c.date));
  const chainStatus = verifyLedger(bill.siteId);

  const pack = {
    kind: 'haazri-evidence-pack',
    version: 1,
    generatedAt: new Date().toISOString(),
    site: site
      ? {
          id: site.id,
          name: site.name,
          city: site.city,
          contractor: site.contractor,
          status: site.status,
        }
      : null,
    bill,
    reconciliation: reconciliation ?? null,
    weekStart: bill.weekStart,
    dailyVerifiedCounts: dailyCounts,
    ledgerEntries,
    chainStatus,
    chainVerified: chainStatus === 'verified',
    chainNote:
      chainStatus === 'verified'
        ? 'Full hash chain recomputed from genesis — all entries match.'
        : chainStatus === 'failed'
          ? 'Hash chain verification FAILED — treat this pack as disputed.'
          : 'No ledger entries recorded for this site yet.',
    evidenceClips: clips,
  };

  return new Response(JSON.stringify(pack, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="haazri-evidence-${billId}.json"`,
    },
  });
}
