/** Join class names, skipping falsy values. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** "₹1,62,500" — rupees with Indian digit grouping. */
export function formatInr(value: number): string {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

/** "28–31" — verified counts always render as a range (en dash). */
export function formatRange(min: number, max: number): string {
  return `${min}–${max}`;
}

/** "+18%" / "-3%" / "0%" — variance percentage, always signed when positive. */
export function formatVariancePct(pct: number): string {
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

function parseDate(date: string): Date {
  // Date-only strings are parsed as local dates to avoid UTC day shifts.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  return new Date(date);
}

/** "12 Jun" — short day-month for tables and axes. */
export function formatDateShort(date: string): string {
  return parseDate(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
  });
}

/** "18,000 no" / "2,800 kg" — quantity with Indian digit grouping + unit. */
export function formatQty(qty: number, unit: string): string {
  return `${qty.toLocaleString('en-IN')} ${unit}`;
}

/** "Today" | "Tomorrow" | "14 Jun" — delivery ETA label (past ETAs → date). */
export function formatEta(date: string): string {
  const target = parseDate(date);
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  return formatDateShort(date);
}

/** "just now" | "8m ago" | "3h ago" | "5d ago" — relative to now. */
export function relativeTime(iso: string): string {
  const diffMs = Date.now() - parseDate(iso).getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
