import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Inbox, Lock, PackageOpen } from 'lucide-react';
import {
  getBoq,
  getOrderedQty,
  getOrders,
  getSites,
  getStages,
  getVendors,
} from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeader } from '@/components/ui/section-header';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { cn, formatDateShort, formatEta, formatInr } from '@/lib/format';
import { BoqTable, type BoqRow } from '@/components/procurement/boq-table';
import { OrderFlow } from '@/components/procurement/order-flow';
import { StageLadder } from '@/components/procurement/stage-ladder';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Procurement',
  description:
    'Quality-gated material procurement against the stage-by-stage BOQ.',
};

export default async function ProcurementPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; stage?: string }>;
}) {
  const { site: siteParam, stage: stageParam } = await searchParams;
  const sites = getSites();
  const selectedSite = sites.find((s) => s.id === siteParam) ?? sites[0];

  if (!selectedSite) {
    return (
      <EmptyState
        icon={Inbox}
        title="No sites connected"
        description="Connect a site to start planning materials."
      />
    );
  }

  const stages = getStages(selectedSite.id);
  const openStage = stages.find((s) => s.status === 'in-progress');
  const selectedStage =
    stages.find((s) => s.id === stageParam) ?? openStage ?? stages[0];

  if (!selectedStage) {
    return (
      <EmptyState
        icon={Inbox}
        title="No stages defined"
        description="This site has no build stages yet."
      />
    );
  }

  const boqRows: BoqRow[] = getBoq(selectedSite.id, selectedStage.id).map(
    (item) => ({
      id: item.id,
      description: item.description,
      category: item.category,
      qty: item.qty,
      unit: item.unit,
      ratePerUnit: item.ratePerUnit,
      ordered: getOrderedQty(item.id),
    }),
  );

  // Header stats: ordered % is by BOQ value of the OPEN stage; committed ₹ is
  // the value of placed (not yet delivered) orders across the site.
  let orderedPct = 0;
  if (openStage) {
    let budget = 0;
    let orderedValue = 0;
    for (const item of getBoq(selectedSite.id, openStage.id)) {
      budget += item.qty * item.ratePerUnit;
      orderedValue +=
        Math.min(getOrderedQty(item.id), item.qty) * item.ratePerUnit;
    }
    orderedPct = budget > 0 ? Math.round((orderedValue / budget) * 100) : 0;
  }

  const orders = getOrders(selectedSite.id);
  const openOrders = orders.filter((o) => o.status === 'placed');
  const committedInr = openOrders.reduce((s, o) => s + o.totalInr, 0);

  const vendorsAll = getVendors();
  const stageNameById = new Map(stages.map((s) => [s.id, s.name]));
  const vendorNameById = new Map(vendorsAll.map((v) => [v.id, v.name]));

  const vendorOptions = vendorsAll.map((v) => ({
    id: v.id,
    name: v.name,
    city: v.city,
    rating: v.rating,
    deliveryDays: v.deliveryDays,
    priceFactor: v.priceFactor,
    paymentTerms: v.paymentTerms,
    categories: v.categories,
  }));

  const prevStage = stages.find((s) => s.order === selectedStage.order - 1);

  return (
    <div className="space-y-10">
      {/* Page header */}
      <div>
        <p className="text-[13px] font-medium text-muted">
          Quality-gated materials
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-text">
          Procurement
        </h1>
        <p className="mt-1 text-sm text-muted">
          {`Materials unlock stage by stage — each stage's BOQ opens only after the previous quality gate passes.`}
        </p>
      </div>

      {/* Site switcher */}
      <div className="flex flex-wrap gap-2">
        {sites.map((site) => {
          const active = site.id === selectedSite.id;
          return (
            <Link
              key={site.id}
              href={`/procurement?site=${site.id}`}
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

      {/* Compact stat row */}
      <div className="grid overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-card sm:grid-cols-3">
        <div className="px-6 py-5">
          <p className="text-[13px] font-medium text-muted">Open stage</p>
          <p className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-text">
            {openStage ? openStage.name : '—'}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {openStage
              ? `Stage ${openStage.order} of ${stages.length} · quality gate open`
              : 'No stage open for materials'}
          </p>
        </div>
        <div className="border-t border-hairline px-6 py-5 sm:border-l sm:border-t-0">
          <p className="text-[13px] font-medium text-muted">Materials ordered</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-text">
            {orderedPct}%
          </p>
          <div className="mt-2 h-1.5 w-full max-w-40 rounded-full bg-black/[0.06]">
            <div
              className="h-1.5 rounded-full bg-chart-green"
              style={{ width: `${orderedPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[13px] text-muted">
            of BOQ value for the open stage
          </p>
        </div>
        <div className="border-t border-hairline px-6 py-5 sm:border-l sm:border-t-0">
          <p className="text-[13px] font-medium text-muted">Committed</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums text-text">
            {formatInr(committedInr)}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {openOrders.length} open{' '}
            {openOrders.length === 1 ? 'order' : 'orders'} awaiting delivery
          </p>
        </div>
      </div>

      {/* Stage ladder + selected stage panel */}
      <div className="grid items-start gap-6 lg:grid-cols-[340px_1fr]">
        <StageLadder
          stages={stages}
          selectedId={selectedStage.id}
          siteId={selectedSite.id}
        />

        <section className="space-y-4">
          <SectionHeader
            label={`Stage ${selectedStage.order} bill of quantities`}
            title={selectedStage.name}
            actions={
              selectedStage.status === 'verified' ? (
                <Badge variant="ok">
                  <Check size={13} strokeWidth={2} aria-hidden />
                  {selectedStage.verifiedOn
                    ? `Verified ${formatDateShort(selectedStage.verifiedOn)}`
                    : 'Verified'}
                </Badge>
              ) : selectedStage.status === 'in-progress' ? (
                <Badge variant="ok">Quality gate open</Badge>
              ) : (
                <Badge variant="muted">
                  <Lock size={12} strokeWidth={1.75} aria-hidden />
                  Locked
                </Badge>
              )
            }
          />

          {boqRows.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No BOQ lines"
              description="This stage has no budgeted materials."
            />
          ) : (
            <BoqTable rows={boqRows} />
          )}

          {selectedStage.status === 'in-progress' ? (
            <OrderFlow
              siteId={selectedSite.id}
              stageId={selectedStage.id}
              stageName={selectedStage.name}
              items={boqRows.map((row) => ({
                id: row.id,
                description: row.description,
                category: row.category,
                unit: row.unit,
                ratePerUnit: row.ratePerUnit,
                qty: row.qty,
                remaining: Math.max(0, row.qty - row.ordered),
              }))}
              vendors={vendorOptions}
            />
          ) : selectedStage.status === 'locked' ? (
            <div className="flex items-start gap-3 rounded-[18px] border border-dashed border-hairline bg-white/60 px-5 py-4">
              <Lock
                size={16}
                strokeWidth={1.75}
                className="mt-0.5 shrink-0 text-muted"
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium text-text">Ordering locked</p>
                <p className="mt-0.5 text-[13px] text-muted">
                  {selectedStage.gateNote ??
                    (prevStage
                      ? `Blocked by quality gate — verify '${prevStage.name}' first.`
                      : 'Blocked by quality gate.')}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-[18px] border border-dashed border-hairline bg-white/60 px-5 py-4">
              <Check
                size={16}
                strokeWidth={1.75}
                className="mt-0.5 shrink-0 text-ok"
                aria-hidden
              />
              <div>
                <p className="text-sm font-medium text-text">
                  Materials closed
                </p>
                <p className="mt-0.5 text-[13px] text-muted">
                  {selectedStage.verifiedOn
                    ? `Quality gate passed ${formatDateShort(selectedStage.verifiedOn)} — this stage no longer accepts orders.`
                    : 'Quality gate passed — this stage no longer accepts orders.'}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Orders */}
      <section className="space-y-4">
        <SectionHeader
          label="Material orders"
          title="Orders"
          description={`${orders.length} ${orders.length === 1 ? 'order' : 'orders'} for ${selectedSite.name}, newest first.`}
        />
        {orders.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="No orders yet"
            description="Place the first material order from an open stage above."
          />
        ) : (
          <div className="overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-card">
            <Table>
              <THead>
                <TR>
                  <TH>Order</TH>
                  <TH>Stage</TH>
                  <TH>Vendor</TH>
                  <TH align="right">Lines</TH>
                  <TH align="right">Total</TH>
                  <TH>Status</TH>
                  <TH align="right">Placed</TH>
                  <TH align="right">ETA</TH>
                </TR>
              </THead>
              <TBody>
                {orders.map((order) => (
                  <TR key={order.id}>
                    <TD className="whitespace-nowrap font-mono text-[12px] text-muted">
                      {order.id}
                    </TD>
                    <TD className="whitespace-nowrap text-text">
                      {stageNameById.get(order.stageId) ?? order.stageId}
                    </TD>
                    <TD className="whitespace-nowrap text-text">
                      {vendorNameById.get(order.vendorId) ?? order.vendorId}
                    </TD>
                    <TD align="right" className="text-muted">
                      {order.lines.length}
                    </TD>
                    <TD align="right" className="text-text">
                      {formatInr(order.totalInr)}
                    </TD>
                    <TD>
                      <Badge
                        variant={order.status === 'delivered' ? 'ok' : 'muted'}
                      >
                        {order.status === 'delivered' ? 'Delivered' : 'Placed'}
                      </Badge>
                    </TD>
                    <TD align="right" className="whitespace-nowrap text-muted">
                      {formatDateShort(order.placedOn)}
                    </TD>
                    <TD align="right" className="whitespace-nowrap text-muted">
                      {formatEta(order.etaDate)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
