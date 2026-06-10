'use client';

/**
 * "Site intelligence" card — fetches AI deviation insights for one site via
 * POST /api/ai/insights. Skeleton shimmer while loading, indigo "Claude"
 * badge when the model answered, neutral "Rules engine" badge on fallback,
 * and a refresh button that forces a regeneration. Renders a graceful retry
 * state when the fetch itself fails.
 */

import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Repeat,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/format';
import type { InsightKind, InsightsResult } from '@/lib/ai';

const KIND_ICON: Record<InsightKind, LucideIcon> = {
  deviation: TrendingUp,
  pattern: Repeat,
  risk: AlertTriangle,
  action: ArrowRight,
};

const CONFIDENCE_LABEL: Record<string, string> = {
  high: 'High confidence',
  medium: 'Medium confidence',
  low: 'Low confidence',
};

/** Pure fetch helper — no component state, so effects can chain off it. */
async function fetchInsights(
  siteId: string,
  force: boolean,
): Promise<InsightsResult> {
  const res = await fetch('/api/ai/insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(force ? { siteId, force: true } : { siteId }),
  });
  if (!res.ok) throw new Error(`Insights request failed (${res.status})`);
  return (await res.json()) as InsightsResult;
}

function SkeletonRows() {
  return (
    <div className="mt-5 space-y-5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="mt-0.5 h-4 w-4 shrink-0 animate-pulse rounded-full bg-black/[0.06]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-2/5 animate-pulse rounded-full bg-black/[0.06]" />
            <div className="h-3 w-4/5 animate-pulse rounded-full bg-black/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function InsightsCard({
  siteId,
  className,
}: {
  siteId: string;
  className?: string;
}) {
  const [result, setResult] = useState<InsightsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Initial fetch: setState only happens inside promise callbacks, never
  // synchronously in the effect body (initial `loading: true` covers mount).
  useEffect(() => {
    let cancelled = false;
    fetchInsights(siteId, false)
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [siteId]);

  const reload = (force: boolean) => {
    setLoading(true);
    setFailed(false);
    fetchInsights(siteId, force)
      .then((data) => {
        setResult(data);
        setFailed(false);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  };

  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <Sparkles className="h-[18px] w-[18px] shrink-0 stroke-[1.75] text-ai" />
          <h2 className="text-lg font-semibold tracking-tight text-text">
            Site intelligence
          </h2>
          {result ? (
            <Badge variant={result.source === 'claude' ? 'info' : 'muted'}>
              {result.source === 'claude' ? 'Claude' : 'Rules engine'}
            </Badge>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => reload(true)}
          disabled={loading}
          aria-label="Refresh insights"
          title="Refresh insights"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-text transition hover:bg-black/[0.09] disabled:opacity-50"
        >
          <RefreshCw
            className={cn('h-4 w-4 stroke-[1.75]', loading && 'animate-spin')}
          />
        </button>
      </div>

      {/* Live region: announces skeleton → insights swaps and failure states
          after the refresh button is pressed. */}
      <div aria-live="polite" aria-busy={loading}>
        {loading && !result ? (
          <SkeletonRows />
        ) : failed && !result ? (
          <div className="mt-5 rounded-[12px] bg-black/[0.03] px-4 py-5 text-center">
            <p className="text-[13px] text-muted">
              Insights are unavailable right now.
            </p>
            <button
              type="button"
              onClick={() => reload(false)}
              className="mt-1 text-[13px] font-medium text-accent"
            >
              Try again
            </button>
          </div>
        ) : result ? (
          <>
            <ul className="mt-5">
              {result.insights.map((insight, i) => {
                const Icon = KIND_ICON[insight.kind];
                return (
                  <li
                    key={`${insight.kind}-${i}`}
                    className="flex gap-3 border-t border-hairline py-4 first:border-t-0 first:pt-0 last:pb-0"
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 stroke-[1.75] text-muted" />
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium text-text">
                        {insight.title}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
                        {insight.detail}
                      </p>
                      <p className="mt-1 text-[12px] text-muted">
                        {CONFIDENCE_LABEL[insight.confidence] ?? insight.confidence}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {failed ? (
              <p className="mt-3 text-[12px] text-muted">
                Refresh failed — showing the last generated insights.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </Card>
  );
}
