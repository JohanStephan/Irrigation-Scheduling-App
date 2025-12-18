import { useEffect, useMemo, useState } from 'react';
import { getHorizon, getWeather, putWeatherBatch } from '../api';

type Row = { date: string; et0: string };

export function WeatherPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const dates = useMemo(() => rows.map((r) => r.date), [rows]);

  async function load() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const hz = await getHorizon();
      const existing = await getWeather(hz.dates);
      const byDate = new Map(existing.map((w) => [w.date, w.et0] as const));
      setRows(
        hz.dates.map((d) => ({
          date: d,
          et0: byDate.has(d) ? String(byDate.get(d)) : '',
        })),
      );
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function update(date: string, et0: string) {
    setRows((prev) => prev.map((r) => (r.date === date ? { ...r, et0 } : r)));
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const items = rows.map((r) => {
        const n = Number(r.et0);
        if (!Number.isFinite(n) || n < 0) {
          throw new Error(`Invalid ET0 for ${r.date}. Must be a non-negative number.`);
        }
        return { date: r.date, et0: n };
      });
      await putWeatherBatch(items);
      setSuccess('Saved ET0 values.');
    } catch (e: any) {
      setError(e.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Enter ET0 (Next 3 Days)</h1>
        <p className="text-sm text-slate-600">ET0 values are upserted by date (re-entering overwrites).</p>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {success && <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{success}</div>}

      {loading ? (
        <div className="text-sm text-slate-600">Loading…</div>
      ) : (
        <div className="rounded-md border bg-white p-4 space-y-3">
          {dates.length === 0 ? <div className="text-sm text-slate-600">No horizon dates.</div> : null}
          {rows.map((r) => (
            <div key={r.date} className="flex items-center gap-3">
              <div className="w-36 text-sm font-medium">{r.date}</div>
              <input
                className="w-48 rounded-md border px-3 py-2 text-sm"
                inputMode="decimal"
                placeholder="mm/day"
                value={r.et0}
                onChange={(e) => update(r.date, e.target.value)}
              />
            </div>
          ))}

          <div className="pt-2 flex gap-2">
            <button
              className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
              onClick={onSave}
              disabled={saving || loading}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              className="rounded-md bg-white px-3 py-2 text-sm border hover:bg-slate-50 disabled:opacity-50"
              onClick={load}
              disabled={saving || loading}
            >
              Reload
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
