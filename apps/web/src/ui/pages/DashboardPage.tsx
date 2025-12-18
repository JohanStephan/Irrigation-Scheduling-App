import { useEffect, useMemo, useState } from 'react';
import { getEtc, getHorizon, recalculateEtc, type EtcTable } from '../api';

function format2(n: number) {
  return n.toFixed(2);
}

export function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState<EtcTable | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<any>(null);

  const dates = table?.dates ?? [];
  const fields = table?.fields ?? [];

  const hasData = useMemo(() => !!table && dates.length > 0 && fields.length > 0, [table, dates.length, fields.length]);

  async function load() {
    setLoading(true);
    setError(null);
    setDetails(null);
    try {
      const hz = await getHorizon();
      const etc = await getEtc(hz.dates);
      setTable(etc);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
      setDetails(e.details);
    } finally {
      setLoading(false);
    }
  }

  async function onRecalc() {
    setLoading(true);
    setError(null);
    setDetails(null);
    try {
      const etc = await recalculateEtc();
      setTable(etc);
    } catch (e: any) {
      setError(e.message ?? 'Failed to recalculate');
      setDetails(e.details);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">ETc Table</h1>
          <p className="text-sm text-slate-600">ETc = ET0 × Kc for the next 3 dates</p>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
            onClick={onRecalc}
            disabled={loading}
          >
            Recalculate
          </button>
          <button
            className="rounded-md bg-white px-3 py-2 text-sm border hover:bg-slate-50 disabled:opacity-50"
            onClick={load}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="font-medium">{error}</div>
          {details ? <pre className="mt-2 whitespace-pre-wrap text-xs text-red-700">{JSON.stringify(details, null, 2)}</pre> : null}
        </div>
      )}

      {loading && <div className="text-sm text-slate-600">Loading…</div>}

      {!loading && !hasData && !error && (
        <div className="rounded-md border bg-white p-4 text-sm text-slate-700">
          No data yet. Add fields, enter ET0 for the next 3 dates, then click Recalculate.
        </div>
      )}

      {!loading && table && dates.length > 0 && (
        <div className="overflow-x-auto rounded-md border bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-left">Field</th>
                {dates.map((d) => (
                  <th key={d} className="px-3 py-2 text-right">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.field_name} className="border-t">
                  <td className="px-3 py-2 font-medium">{f.field_name}</td>
                  {dates.map((d) => {
                    const v = table.etcByFieldByDate?.[f.field_name]?.[d];
                    return (
                      <td key={d} className="px-3 py-2 text-right tabular-nums">
                        {typeof v === 'number' ? format2(v) : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && table && dates.length > 0 && (
        <div className="text-xs text-slate-500">
          {table.calculatedAt ? `Last calculated at: ${table.calculatedAt}` : null}
        </div>
      )}
    </div>
  );
}
