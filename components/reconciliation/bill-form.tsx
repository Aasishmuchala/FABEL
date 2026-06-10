'use client';

import { useState, useTransition } from 'react';
import { ScanLine } from 'lucide-react';
import { reconcileBill } from '@/app/reconciliation/actions';
import { cn, formatDateShort } from '@/lib/format';

interface FieldErrors {
  days?: string;
  amount?: string;
  form?: string;
}

export function BillForm({
  siteId,
  weekStart,
  defaultDays,
  defaultAmount,
}: {
  siteId: string;
  weekStart: string;
  defaultDays: number;
  defaultAmount: number;
}) {
  const [days, setDays] = useState(String(defaultDays));
  const [amount, setAmount] = useState(String(defaultAmount));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: FieldErrors = {};
    const parsedDays = Number(days);
    const parsedAmount = Number(amount);
    if (!days.trim() || !Number.isFinite(parsedDays) || parsedDays <= 0) {
      next.days = 'Enter a positive number of labour-days.';
    }
    if (!amount.trim() || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      next.amount = 'Enter a positive bill amount in rupees.';
    }
    setErrors(next);
    if (next.days || next.amount) return;

    startTransition(async () => {
      const result = await reconcileBill({
        siteId,
        weekStart,
        billedLabourDays: parsedDays,
        amountInr: parsedAmount,
      });
      if (!result.ok) {
        setErrors({ form: result.error ?? 'Something went wrong — try again.' });
      }
    });
  }

  const inputClass = (invalid: boolean) =>
    cn(
      'w-full rounded-lg border bg-surface-2 px-3 py-2 text-sm tabular-nums text-text outline-none transition-colors',
      'placeholder:text-muted/60 focus:border-teal/50',
      invalid ? 'border-red/60' : 'border-line',
    );

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="bill-week"
            className="text-[11px] uppercase tracking-[0.14em] text-muted"
          >
            Week starting
          </label>
          <input
            id="bill-week"
            type="text"
            readOnly
            value={`${formatDateShort(weekStart)} (${weekStart})`}
            className="mt-1.5 w-full cursor-default rounded-lg border border-line bg-surface px-3 py-2 text-sm tabular-nums text-muted outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="bill-days"
            className="text-[11px] uppercase tracking-[0.14em] text-muted"
          >
            Billed labour-days
          </label>
          <input
            id="bill-days"
            type="number"
            min={1}
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            aria-invalid={Boolean(errors.days)}
            className={cn('mt-1.5', inputClass(Boolean(errors.days)))}
          />
          {errors.days ? (
            <p className="mt-1 text-xs text-red">{errors.days}</p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor="bill-amount"
            className="text-[11px] uppercase tracking-[0.14em] text-muted"
          >
            Bill amount (₹)
          </label>
          <input
            id="bill-amount"
            type="number"
            min={1}
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-invalid={Boolean(errors.amount)}
            className={cn('mt-1.5', inputClass(Boolean(errors.amount)))}
          />
          {errors.amount ? (
            <p className="mt-1 text-xs text-red">{errors.amount}</p>
          ) : null}
        </div>
      </div>

      {errors.form ? <p className="text-xs text-red">{errors.form}</p> : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <ScanLine size={16} aria-hidden />
          {isPending ? 'Reconciling…' : 'Reconcile against ledger'}
        </button>
        <p className="text-xs text-muted">
          Compares billed days with the verified range for this week.
        </p>
      </div>
    </form>
  );
}
