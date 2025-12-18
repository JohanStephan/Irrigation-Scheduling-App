import { useEffect, useMemo, useState } from 'react';
import { createField, deleteField, listFields, updateField, type Field } from '../api';

type FormState = {
  field_name: string;
  crop_factor: string;
  fertilizer_week: string;
};

function parseCropFactor(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error('Crop factor must be a non-negative number.');
  return n;
}

function parseFertilizerWeek(v: string) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw new Error('Fertilizer week must be an integer >= 1.');
  return n;
}

export function FieldsPage() {
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<FormState>({ field_name: '', crop_factor: '0', fertilizer_week: '1' });
  const [editing, setEditing] = useState<Field | null>(null);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(
    () => [...fields].sort((a, b) => a.field_name.localeCompare(b.field_name)),
    [fields],
  );

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await listFields();
      setFields(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate() {
    setSaving(true);
    setError(null);
    try {
      const name = form.field_name.trim();
      if (!name) throw new Error('Field name cannot be empty.');
      const input: Field = {
        field_name: name,
        crop_factor: parseCropFactor(form.crop_factor),
        fertilizer_week: parseFertilizerWeek(form.fertilizer_week),
      };
      const created = await createField(input);
      setFields((prev) => [...prev, created]);
      setForm({ field_name: '', crop_factor: '0', fertilizer_week: '1' });
    } catch (e: any) {
      setError(e.message ?? 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveEdit() {
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateField(editing.field_name, {
        crop_factor: editing.crop_factor,
        fertilizer_week: editing.fertilizer_week,
      });
      setFields((prev) => prev.map((f) => (f.field_name === updated.field_name ? updated : f)));
      setEditing(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(field_name: string) {
    if (!confirm(`Delete field '${field_name}'?`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteField(field_name);
      setFields((prev) => prev.filter((f) => f.field_name !== field_name));
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Fields</h1>
        <p className="text-sm text-slate-600">Manage fields and crop factors (Kc).</p>
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="rounded-md border bg-white p-4 space-y-3">
        <div className="font-medium">Add field</div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="text-xs text-slate-600 mb-1">Field name</div>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={form.field_name}
              onChange={(e) => setForm((p) => ({ ...p, field_name: e.target.value }))}
            />
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">Crop factor (Kc)</div>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              inputMode="decimal"
              value={form.crop_factor}
              onChange={(e) => setForm((p) => ({ ...p, crop_factor: e.target.value }))}
            />
          </div>
          <div>
            <div className="text-xs text-slate-600 mb-1">Fertilizer week</div>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm"
              inputMode="numeric"
              value={form.fertilizer_week}
              onChange={(e) => setForm((p) => ({ ...p, fertilizer_week: e.target.value }))}
            />
          </div>
        </div>
        <button
          className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
          onClick={onCreate}
          disabled={saving}
        >
          Add
        </button>
      </div>

      <div className="rounded-md border bg-white overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-left">Field</th>
              <th className="px-3 py-2 text-right">Kc</th>
              <th className="px-3 py-2 text-right">Fertilizer week</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-3 py-3 text-slate-600" colSpan={4}>
                  Loading…
                </td>
              </tr>
            ) : sorted.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-slate-600" colSpan={4}>
                  No fields.
                </td>
              </tr>
            ) : (
              sorted.map((f) => (
                <tr key={f.field_name} className="border-t">
                  <td className="px-3 py-2 font-medium">{f.field_name}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.crop_factor.toFixed(2)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{f.fertilizer_week}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                      onClick={() => setEditing(f)}
                      disabled={saving}
                    >
                      Edit
                    </button>
                    <button
                      className="ml-2 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:bg-red-100"
                      onClick={() => onDelete(f.field_name)}
                      disabled={saving}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-md border bg-white p-4 space-y-3">
            <div className="text-lg font-semibold">Edit {editing.field_name}</div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Crop factor (Kc)</div>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                inputMode="decimal"
                value={String(editing.crop_factor)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setEditing((p) => (p ? { ...p, crop_factor: Number.isFinite(n) ? n : p.crop_factor } : p));
                }}
              />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Fertilizer week</div>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm"
                inputMode="numeric"
                value={String(editing.fertilizer_week)}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setEditing((p) => (p ? { ...p, fertilizer_week: Number.isFinite(n) ? Math.trunc(n) : p.fertilizer_week } : p));
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                className="rounded-md bg-white px-3 py-2 text-sm border hover:bg-slate-50"
                onClick={() => setEditing(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                onClick={async () => {
                  try {
                    // Validate before sending
                    if (editing.crop_factor < 0 || !Number.isFinite(editing.crop_factor)) throw new Error('Crop factor must be >= 0.');
                    if (!Number.isInteger(editing.fertilizer_week) || editing.fertilizer_week < 1) throw new Error('Fertilizer week must be an integer >= 1.');
                    await onSaveEdit();
                  } catch (e: any) {
                    setError(e.message ?? 'Invalid values');
                  }
                }}
                disabled={saving}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
