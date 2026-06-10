'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Check, ShoppingCart, Star, Truck, X } from 'lucide-react';
import { placeOrderAction } from '@/app/procurement/actions';
import { Badge } from '@/components/ui/badge';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { cn, formatEta, formatInr, formatQty } from '@/lib/format';
import type { MaterialCategory } from '@/lib/types';

export interface OrderFlowItem {
  id: string;
  description: string;
  category: MaterialCategory;
  unit: string;
  ratePerUnit: number;
  qty: number;
  /** BOQ qty minus everything already ordered. */
  remaining: number;
}

export interface OrderFlowVendor {
  id: string;
  name: string;
  city: string;
  rating: number;
  deliveryDays: number;
  priceFactor: number;
  paymentTerms: string;
  categories: MaterialCategory[];
}

interface PlacedSummary {
  id: string;
  totalInr: number;
  etaDate: string;
  vendorName: string;
}

const STEP_LABELS = ['Lines', 'Vendor', 'Review'] as const;

/**
 * Local YYYY-MM-DD for today + n days, computed client-side at quote time so
 * the previewed ETA never goes stale across midnight. Preview only — the
 * store stamps the authoritative etaDate when the order is placed.
 */
function previewEta(deliveryDays: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + deliveryDays);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const PRIMARY_BTN =
  'inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50';
const SECONDARY_BTN =
  'inline-flex h-10 items-center gap-2 rounded-full bg-black/[0.05] px-5 text-[14px] font-medium text-text transition-colors hover:bg-black/[0.09]';

/**
 * Inline three-step order stepper for an in-progress stage: pick BOQ lines,
 * compare vendor quotes, review and place. Mirrors the store's money math
 * (rate = round(boq × priceFactor), lineTotal = round(qty × rate), 18% GST)
 * so the review total matches the persisted order to the rupee.
 */
export function OrderFlow({
  siteId,
  stageId,
  stageName,
  items,
  vendors,
}: {
  siteId: string;
  stageId: string;
  stageName: string;
  items: OrderFlowItem[];
  vendors: OrderFlowVendor[];
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [qtyInput, setQtyInput] = useState<Record<string, string>>({});
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedSummary | null>(null);
  const [isPending, startTransition] = useTransition();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const placedRef = useRef<HTMLDivElement>(null);
  const restoreTriggerRef = useRef(false);

  // Every step transition swaps out the control that held focus, so steer
  // keyboard/screen-reader focus to the step heading (or the success
  // confirmation) instead of letting it drop to <body>.
  useEffect(() => {
    if (!open) return;
    if (placed) placedRef.current?.focus();
    else headingRef.current?.focus();
  }, [open, step, placed]);

  // After closeFlow the trigger button remounts — hand focus back to it.
  useEffect(() => {
    if (open || !restoreTriggerRef.current) return;
    restoreTriggerRef.current = false;
    triggerRef.current?.focus();
  }, [open]);

  const available = items.filter((it) => it.remaining > 0);

  function openFlow() {
    const nextQty: Record<string, string> = {};
    const nextChecked: Record<string, boolean> = {};
    for (const it of available) {
      nextQty[it.id] = String(it.remaining);
      nextChecked[it.id] = true;
    }
    setQtyInput(nextQty);
    setChecked(nextChecked);
    setVendorId(null);
    setError(null);
    setPlaced(null);
    setStep(1);
    setOpen(true);
  }

  function closeFlow() {
    restoreTriggerRef.current = true;
    setOpen(false);
    setPlaced(null);
    setError(null);
    setStep(1);
  }

  function lineValid(it: OrderFlowItem): boolean {
    const raw = (qtyInput[it.id] ?? '').trim();
    if (!raw) return false;
    const q = Number(raw);
    return Number.isFinite(q) && q > 0 && q <= it.remaining;
  }

  const selected = available.filter((it) => checked[it.id]);
  const step1Valid = selected.length > 0 && selected.every(lineValid);

  const neededCategories = Array.from(new Set(selected.map((it) => it.category)));
  const eligibleVendors = vendors.filter((v) =>
    neededCategories.every((c) => v.categories.includes(c)),
  );
  const quotes = eligibleVendors
    .map((vendor) => {
      const lines = selected.map((it) => {
        const qty = Number(qtyInput[it.id]);
        const rate = Math.round(it.ratePerUnit * vendor.priceFactor);
        return { item: it, qty, rate, lineTotal: Math.round(qty * rate) };
      });
      const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
      const total = Math.round(subtotal * 1.18);
      return {
        vendor,
        lines,
        subtotal,
        total,
        gst: total - subtotal,
        etaDate: previewEta(vendor.deliveryDays),
      };
    })
    .sort(
      (a, b) => a.total - b.total || a.vendor.name.localeCompare(b.vendor.name),
    );
  const selectedQuote = quotes.find((q) => q.vendor.id === vendorId);

  function handlePlace() {
    const quote = selectedQuote;
    if (!quote || isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await placeOrderAction({
        siteId,
        stageId,
        vendorId: quote.vendor.id,
        lines: quote.lines.map((l) => ({ boqItemId: l.item.id, qty: l.qty })),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setPlaced({
        id: result.orderId,
        totalInr: result.totalInr,
        etaDate: result.etaDate,
        vendorName: quote.vendor.name,
      });
    });
  }

  if (!open) {
    if (available.length === 0) {
      return (
        <p className="text-[13px] text-muted">
          {`Every line in this stage's BOQ is fully ordered.`}
        </p>
      );
    }
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={openFlow}
        className={PRIMARY_BTN}
      >
        <ShoppingCart size={16} strokeWidth={1.75} aria-hidden />
        Order materials
      </button>
    );
  }

  if (placed) {
    return (
      <div className="rounded-[18px] border border-hairline bg-surface p-6 shadow-card">
        <div
          ref={placedRef}
          tabIndex={-1}
          className="flex flex-col items-center py-4 text-center outline-none"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ok-bg text-ok">
            <Check size={18} strokeWidth={2} aria-hidden />
          </span>
          <p className="mt-3 text-sm font-semibold text-text">Order placed</p>
          <p className="mt-1 text-[13px] tabular-nums text-muted">
            {placed.id} · {formatInr(placed.totalInr)} incl. GST ·{' '}
            {placed.vendorName} · ETA {formatEta(placed.etaDate)}
          </p>
          <button type="button" onClick={closeFlow} className={cn(SECONDARY_BTN, 'mt-5')}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-[18px] border border-hairline bg-surface p-6 shadow-card">
      {/* Header + step indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium text-muted">Order materials</p>
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="mt-0.5 text-base font-semibold tracking-tight text-text outline-none"
          >
            {stageName}
          </h3>
        </div>
        <button
          type="button"
          onClick={closeFlow}
          aria-label="Cancel order"
          className="rounded-full p-1.5 text-muted transition-colors hover:bg-black/[0.05] hover:text-text"
        >
          <X size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <ol className="flex flex-wrap items-center gap-2">
        {STEP_LABELS.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const done = n < step;
          const current = n === step;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium tabular-nums',
                  done && 'bg-ok-bg text-ok',
                  current && 'bg-accent text-white',
                  !done && !current && 'bg-black/[0.05] text-muted',
                )}
              >
                {done ? <Check size={12} strokeWidth={2} aria-hidden /> : n}
              </span>
              <span
                className={cn(
                  'text-[13px] font-medium',
                  current ? 'text-text' : 'text-muted',
                )}
              >
                {label}
              </span>
              {i < STEP_LABELS.length - 1 ? (
                <span className="h-px w-6 bg-hairline" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>

      {/* Step 1 — pick lines + quantities */}
      {step === 1 ? (
        <div className="space-y-3">
          {available.map((it) => {
            const isChecked = Boolean(checked[it.id]);
            const invalid = isChecked && !lineValid(it);
            return (
              <div
                key={it.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
                  isChecked ? 'border-accent/40 bg-accent/[0.03]' : 'border-hairline',
                )}
              >
                <input
                  id={`line-${it.id}`}
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) =>
                    setChecked((prev) => ({ ...prev, [it.id]: e.target.checked }))
                  }
                  className="h-4 w-4 accent-accent"
                />
                <label htmlFor={`line-${it.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <p className="text-sm font-medium text-text">{it.description}</p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    <span className="capitalize">{it.category}</span> ·{' '}
                    {formatQty(it.remaining, it.unit)} remaining ·{' '}
                    {formatInr(it.ratePerUnit)}/{it.unit}
                  </p>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={it.remaining}
                    value={qtyInput[it.id] ?? ''}
                    disabled={!isChecked}
                    onChange={(e) =>
                      setQtyInput((prev) => ({ ...prev, [it.id]: e.target.value }))
                    }
                    aria-label={`Quantity for ${it.description}`}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? `qty-error-${it.id}` : undefined}
                    className={cn(
                      'w-28 rounded-xl border bg-surface px-3 py-1.5 text-sm tabular-nums text-text outline-none transition-colors disabled:opacity-50',
                      invalid ? 'border-danger' : 'border-hairline focus:border-accent',
                    )}
                  />
                  <span className="text-[13px] text-muted">{it.unit}</span>
                </div>
                {invalid ? (
                  <p id={`qty-error-${it.id}`} className="w-full text-[12px] text-danger">
                    Enter a quantity above 0, up to{' '}
                    {formatQty(it.remaining, it.unit)}.
                  </p>
                ) : null}
              </div>
            );
          })}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={closeFlow} className={SECONDARY_BTN}>
              Cancel
            </button>
            <button
              type="button"
              disabled={!step1Valid}
              onClick={() => {
                setError(null);
                setStep(2);
              }}
              className={PRIMARY_BTN}
            >
              Continue to vendors
            </button>
          </div>
        </div>
      ) : null}

      {/* Step 2 — vendor selection */}
      {step === 2 ? (
        <div className="space-y-3">
          {quotes.length === 0 ? (
            <p className="text-[13px] text-muted">
              No single vendor covers all selected categories — split the order
              and try again.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {quotes.map((q, idx) => {
                const sel = q.vendor.id === vendorId;
                return (
                  <button
                    type="button"
                    key={q.vendor.id}
                    onClick={() => setVendorId(q.vendor.id)}
                    aria-pressed={sel}
                    className={cn(
                      'rounded-2xl border p-4 text-left transition-colors',
                      sel
                        ? 'border-accent bg-accent/[0.04]'
                        : 'border-hairline hover:border-line-bright',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text">
                          {q.vendor.name}
                        </p>
                        <p className="mt-0.5 text-[12px] text-muted">
                          {q.vendor.city}
                        </p>
                      </div>
                      {idx === 0 ? <Badge variant="ok">Best price</Badge> : null}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Star
                          size={12}
                          strokeWidth={1.75}
                          className="fill-current text-text"
                          aria-hidden
                        />
                        {q.vendor.rating.toFixed(1)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Truck size={13} strokeWidth={1.75} aria-hidden />
                        ETA {formatEta(q.etaDate)}
                      </span>
                      <span>{q.vendor.paymentTerms}</span>
                    </div>
                    <p className="mt-3 text-lg font-semibold tabular-nums tracking-tight text-text">
                      {formatInr(q.total)}{' '}
                      <span className="text-[12px] font-normal text-muted">
                        incl. GST
                      </span>
                    </p>
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={() => setStep(1)} className={SECONDARY_BTN}>
              Back
            </button>
            <button
              type="button"
              disabled={!selectedQuote}
              onClick={() => {
                setError(null);
                setStep(3);
              }}
              className={PRIMARY_BTN}
            >
              Review order
            </button>
          </div>
        </div>
      ) : null}

      {/* Step 3 — review + place */}
      {step === 3 && selectedQuote ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-hairline">
            <Table>
              <THead>
                <TR>
                  <TH>Line</TH>
                  <TH align="right">Qty</TH>
                  <TH align="right">Rate</TH>
                  <TH align="right">Amount</TH>
                </TR>
              </THead>
              <TBody>
                {selectedQuote.lines.map((l) => (
                  <TR key={l.item.id}>
                    <TD className="text-text">{l.item.description}</TD>
                    <TD align="right" className="whitespace-nowrap text-text">
                      {formatQty(l.qty, l.item.unit)}
                    </TD>
                    <TD align="right" className="whitespace-nowrap text-text">
                      {formatInr(l.rate)}
                      <span className="text-muted">/{l.item.unit}</span>
                    </TD>
                    <TD align="right" className="text-text">
                      {formatInr(l.lineTotal)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          <div className="ml-auto w-full max-w-64 space-y-1.5 text-sm">
            <div className="flex justify-between text-muted">
              <span>Subtotal</span>
              <span className="tabular-nums">
                {formatInr(selectedQuote.subtotal)}
              </span>
            </div>
            <div className="flex justify-between text-muted">
              <span>GST 18%</span>
              <span className="tabular-nums">{formatInr(selectedQuote.gst)}</span>
            </div>
            <div className="flex justify-between border-t border-hairline pt-1.5 font-semibold text-text">
              <span>Total</span>
              <span className="tabular-nums">
                {formatInr(selectedQuote.total)}
              </span>
            </div>
          </div>

          <p className="text-[13px] text-muted">
            Supplied by{' '}
            <span className="font-medium text-text">
              {selectedQuote.vendor.name}
            </span>{' '}
            · ETA {formatEta(selectedQuote.etaDate)} ·{' '}
            {selectedQuote.vendor.paymentTerms}
          </p>

          {error ? (
            <div
              role="alert"
              className="rounded-xl bg-danger-bg px-4 py-3 text-[13px] font-medium text-danger"
            >
              {error}
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={() => setStep(2)} className={SECONDARY_BTN}>
              Back
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={handlePlace}
              className={PRIMARY_BTN}
            >
              {isPending ? 'Placing order…' : 'Place order'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
