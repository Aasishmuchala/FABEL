import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Inbox, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  getBills,
  getClips,
  getDailyCounts,
  getLedger,
  getReconciliations,
  getSites,
  verifyLedger,
} from '@/lib/store';
import { Badge, FLAG_BADGE_VARIANT } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { RangeBar } from '@/components/ui/range-bar';
import { SectionHeader } from '@/components/ui/section-header';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import {
  cn,
  formatDateShort,
  formatInr,
  formatRange,
  formatVariancePct,
} from '@/lib/format';
import { BillForm } from '@/components/reconciliation/bill-form';
import {
  EvidenceDrawer,
  type EvidenceDay,
  type EvidenceLedgerEntry,
} from '@/components/reconciliation/evidence-drawer';
import { weekDatesOf } from '@/components/reconciliation/week';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reconciliation',
  description:
    'Weekly contractor bills reconciled against the camera-verified labour ledger.',
};

export default async function ReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>;
}) {
  const { site: siteParam } = await searchParams;
  const sites = getSites();
  const selected = sites.find((s) => s.id === siteParam) ?? sites[0];

  if (!selected) {
    return (
      <EmptyState
        icon={Inbox}
        title="No sites connected"
        description="Connect a site to start reconciling contractor bills."
      />
    );
  }

  const pendingBill = getBills(selected.id).find((b) => b.status === 'pending');
  const reconciliations = getReconciliations(selected.id);
  const dailyCounts = getDailyCounts(selected.id);
  const clips = getClips(selected.id);
  const ledger = getLedger(selected.id);
  const chainStatus = verifyLedger(selected.id);

  // Comparable bars across history rows: shared domain.
  const domainMax =
    reconciliations.length > 0
      ? Math.max(
          ...reconciliations.map((r) =>
            Math.max(r.verifiedMax, r.billedLabourDays),
          ),
        ) * 1.1
      : undefined;

  const totalBilled = reconciliations.reduce(
    (s, r) => s + r.billedLabourDays,
    0,
  );
  const totalVerifiedMin = reconciliations.reduce(
    (s, r) => s + r.verifiedMin,
    0,
  );
  const totalVerifiedMax = reconciliations.reduce(
    (s, r) => s + r.verifiedMax,
    0,
  );
  const totalSavings = reconciliations.reduce((s, r) => s + r.savingsInr, 0);

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-muted">
            Contractor bills vs verified ledger
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-text">
            Reconciliation
          </h1>
        </div>
        <Badge
          variant={
            chainStatus === 'verified'
              ? 'ok'
              : chainStatus === 'failed'
                ? 'danger'
                : 'muted'
          }
        >
          {chainStatus === 'verified' ? (
            <ShieldCheck size={13} aria-hidden />
          ) : chainStatus === 'failed' ? (
            <ShieldAlert size={13} aria-hidden />
          ) : null}
          {chainStatus === 'verified'
            ? 'Ledger chain verified'
            : chainStatus === 'failed'
              ? 'Ledger chain failed'
              : 'No ledger entries yet'}
        </Badge>
      </div>

      {/* Site switcher */}
      <div className="flex flex-wrap gap-2">
        {sites.map((site) => {
          const active = site.id === selected.id;
          return (
            <Link
              key={site.id}
              href={`/reconciliation?site=${site.id}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-text text-white'
                  : 'bg-black/[0.05] text-muted hover:bg-black/[0.09] hover:text-text',
              )}
            >
              {site.name}
            </Link>
          );
        })}
      </div>

      {/* Pending bill */}
      <section className="space-y-4">
        <SectionHeader
          label={selected.contractor}
          title="Pending bill"
          description={
            pendingBill
              ? `Submitted ${formatDateShort(pendingBill.submittedOn)} for the week of ${formatDateShort(pendingBill.weekStart)} — ${formatInr(pendingBill.amountInr)} claimed.`
              : undefined
          }
        />
        {pendingBill ? (
          <Card>
            <BillForm
              key={pendingBill.id}
              siteId={pendingBill.siteId}
              weekStart={pendingBill.weekStart}
              defaultDays={pendingBill.billedLabourDays}
              defaultAmount={pendingBill.amountInr}
            />
          </Card>
        ) : (
          <EmptyState
            icon={Inbox}
            title="No pending bills"
            description="Upload arrives via WhatsApp digest in production."
          />
        )}
      </section>

      {/* History */}
      <section className="space-y-4">
        <SectionHeader
          label="History"
          title="Reconciled weeks"
          description={`${reconciliations.length} ${reconciliations.length === 1 ? 'week' : 'weeks'} reconciled for ${selected.name}.`}
        />
        {reconciliations.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nothing reconciled yet"
            description="Reconcile the first bill above to start the history."
          />
        ) : (
          <div className="overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-card">
            <Table>
              <THead>
                <TR>
                  <TH>Week of</TH>
                  <TH align="right">Billed</TH>
                  <TH className="min-w-44">Verified range</TH>
                  <TH align="right">Variance</TH>
                  <TH align="right">Savings</TH>
                  <TH align="right">Evidence</TH>
                </TR>
              </THead>
              <TBody>
                {reconciliations.map((r) => {
                  const weekDates = new Set(weekDatesOf(r.weekStart));
                  const days: EvidenceDay[] = dailyCounts
                    .filter((c) => weekDates.has(c.date))
                    .map((c) => ({
                      date: c.date,
                      verifiedMin: c.verifiedMin,
                      verifiedMax: c.verifiedMax,
                      confidence: c.confidence,
                    }));
                  const weekClips = clips.filter((c) => weekDates.has(c.date));
                  const weekLedger: EvidenceLedgerEntry[] = ledger
                    .filter((l) => weekDates.has(l.date))
                    .map((l) => ({
                      date: l.date,
                      hash: l.hash,
                      prevHash: l.prevHash,
                    }));
                  return (
                    <TR key={r.billId}>
                      <TD className="whitespace-nowrap text-text">
                        {formatDateShort(r.weekStart)}
                      </TD>
                      <TD align="right" className="text-text">
                        {r.billedLabourDays}
                      </TD>
                      <TD>
                        <div className="min-w-40">
                          <RangeBar
                            min={r.verifiedMin}
                            max={r.verifiedMax}
                            billed={r.billedLabourDays}
                            domainMax={domainMax}
                            showLabels={false}
                          />
                          <p className="mt-1 text-[12px] font-medium tabular-nums text-ok">
                            {formatRange(r.verifiedMin, r.verifiedMax)} verified
                          </p>
                        </div>
                      </TD>
                      <TD align="right">
                        <Badge variant={FLAG_BADGE_VARIANT[r.flag]}>
                          {formatVariancePct(r.variancePct)}
                        </Badge>
                      </TD>
                      <TD
                        align="right"
                        className={r.savingsInr > 0 ? 'text-ok' : 'text-muted'}
                      >
                        {r.savingsInr > 0 ? formatInr(r.savingsInr) : '—'}
                      </TD>
                      <TD align="right">
                        <EvidenceDrawer
                          billId={r.billId}
                          siteName={selected.name}
                          weekStart={r.weekStart}
                          billedLabourDays={r.billedLabourDays}
                          verifiedMin={r.verifiedMin}
                          verifiedMax={r.verifiedMax}
                          variancePct={r.variancePct}
                          flag={r.flag}
                          savingsInr={r.savingsInr}
                          days={days}
                          clips={weekClips}
                          ledgerEntries={weekLedger}
                          chainVerified={chainStatus === 'verified'}
                        />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
        {reconciliations.some((r) => r.flag !== 'ok') ? (
          <Link
            href={`/procurement?site=${selected.id}`}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-accent transition-opacity hover:opacity-80"
          >
            View procurement impact
            <ArrowRight size={13} strokeWidth={1.75} aria-hidden />
          </Link>
        ) : null}
      </section>

      {/* Summary footer strip */}
      {reconciliations.length > 0 ? (
        <Card>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[13px] font-medium text-muted">Total billed</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-text">
                {totalBilled.toLocaleString('en-IN')}
                <span className="ml-1.5 text-sm font-normal tracking-normal text-muted">
                  labour-days
                </span>
              </p>
            </div>
            <div>
              <p className="text-[13px] font-medium text-muted">
                Total verified
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-ok">
                {formatRange(totalVerifiedMin, totalVerifiedMax)}
                <span className="ml-1.5 text-sm font-normal tracking-normal text-muted">
                  labour-days
                </span>
              </p>
            </div>
            <div>
              <p className="text-[13px] font-medium text-muted">
                Detected savings
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-ok">
                {formatInr(totalSavings)}
              </p>
            </div>
            <div className="w-full min-w-56 flex-1 sm:w-auto">
              <RangeBar
                min={totalVerifiedMin}
                max={totalVerifiedMax}
                billed={totalBilled}
              />
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
