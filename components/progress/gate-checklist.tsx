'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronDown, Circle } from 'lucide-react';
import { cn } from '@/lib/format';
import type { ChecklistItem } from '@/lib/types';

/** Collapsible concealment-gate checklist shown on a stage card. */
export function GateChecklist({ items }: { items: ChecklistItem[] }) {
  const [open, setOpen] = useState(false);
  const done = items.filter((item) => item.done).length;

  return (
    <div className="mt-4 border-t border-hairline pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-[13px] font-medium text-muted transition-colors hover:text-text"
      >
        <ChevronDown
          size={14}
          strokeWidth={1.75}
          aria-hidden
          className={cn('transition-transform', open && 'rotate-180')}
        />
        Gate checklist
        <span className="font-normal tabular-nums">
          · {done} of {items.length} complete
        </span>
      </button>
      {open ? (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li key={item.label} className="flex items-start gap-2">
              {item.done ? (
                <CheckCircle2
                  size={15}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 text-ok"
                  aria-hidden
                />
              ) : (
                <Circle
                  size={15}
                  strokeWidth={1.75}
                  className="mt-0.5 shrink-0 text-muted/50"
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  'text-[13px]',
                  item.done ? 'text-text' : 'text-muted',
                )}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
