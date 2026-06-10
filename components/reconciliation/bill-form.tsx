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
      'w-full rounded-xl border bg-surface px-3 py-2 text-sm tabular-nums text-text outline-none transition-colors',
      'placeholder:text-muted/60 focus:border-accent',
      invalid ? 'border-danger/50' : 'border-hairline',
    );

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor="bill-week"
            className="text-[13px] font-medium text-muted"
          >
            Week starting
          </label>
          <input
            id="bill-week"
            type="text"
            readOnly
            value={`${formatDateShort(weekStart)} (${weekStart})`}
            className="mt-1.5 w-full cursor-default rounded-xl border border-hairline bg-surface-2 px-3 py-2 text-sm tabular-nums text-muted outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="bill-days"
            className="text-[13px] font-medium text-muted"
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
            aria-describedby={errors.days ? 'bill-days-error' : undefined}
            className={cn('mt-1.5', inputClass(Boolean(errors.days)))}
          />
          {errors.days ? (
            <p id="bill-days-error" className="mt-1 text-xs text-danger">
              {errors.days}
            </p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor="bill-amount"
            className="text-[13px] font-medium text-muted"
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
            aria-describedby={errors.amount ? 'bill-amount-error' : undefined}
            className={cn('mt-1.5', inputClass(Boolean(errors.amount)))}
          />
          {errors.amount ? (
            <p id="bill-amount-error" className="mt-1 text-xs text-danger">
              {errors.amount}
            </p>
          ) : null}
        </div>
      </div>

      {errors.form ? (
        <p role="alert" className="text-xs text-danger">
          {errors.form}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          <ScanLine size={16} strokeWidth={1.75} aria-hidden />
          {isPending ? 'Reconciling…' : 'Reconcile against ledger'}
        </button>
        <p className="text-[13px] text-muted">
          Compares billed days with the verified range for this week.
        </p>
      </div>
    </form>
  );
}
