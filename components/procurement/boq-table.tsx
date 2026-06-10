import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatInr, formatQty } from '@/lib/format';
import type { MaterialCategory } from '@/lib/types';

export interface BoqRow {
  id: string;
  description: string;
  category: MaterialCategory;
  qty: number;
  unit: string;
  ratePerUnit: number;
  /** Quantity already covered by orders (placed + delivered). */
  ordered: number;
}

/** Stage BOQ with a slim ordered-vs-remaining progress bar per line. */
export function BoqTable({ rows }: { rows: BoqRow[] }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-hairline bg-surface shadow-card">
      <Table>
        <THead>
          <TR>
            <TH>Material</TH>
            <TH align="right">Quantity</TH>
            <TH align="right">Rate</TH>
            <TH className="min-w-48">Ordered</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((row) => {
            const pct =
              row.qty > 0 ? Math.min(100, (row.ordered / row.qty) * 100) : 0;
            return (
              <TR key={row.id}>
                <TD>
                  <p className="text-sm font-medium text-text">
                    {row.description}
                  </p>
                  <p className="mt-0.5 text-[12px] capitalize text-muted">
                    {row.category}
                  </p>
                </TD>
                <TD align="right" className="whitespace-nowrap text-text">
                  {formatQty(row.qty, row.unit)}
                </TD>
                <TD align="right" className="whitespace-nowrap text-text">
                  {formatInr(row.ratePerUnit)}
                  <span className="text-muted">/{row.unit}</span>
                </TD>
                <TD>
                  <div className="min-w-44">
                    <div className="h-1.5 w-full rounded-full bg-black/[0.06]">
                      <div
                        className="h-1.5 rounded-full bg-chart-green"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[12px] tabular-nums text-muted">
                      {row.ordered.toLocaleString('en-IN')} of{' '}
                      {formatQty(row.qty, row.unit)} ordered
                    </p>
                  </div>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}
