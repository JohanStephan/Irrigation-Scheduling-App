import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isoDate(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getNextThreeDates(): string[] {
  const now = new Date();
  return [1, 2, 3].map((offset) => {
    const d = new Date(now);
    d.setDate(now.getDate() + offset);
    return isoDate(d);
  });
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const FieldSchema = z.object({
  field_name: z.string().trim().min(1),
  crop_factor: z.number().finite().min(0),
  fertilizer_week: z.number().int().min(1),
});

const UpdateFieldSchema = z.object({
  crop_factor: z.number().finite().min(0),
  fertilizer_week: z.number().int().min(1),
});

const PutWeatherSchema = z.object({
  et0: z.number().finite().min(0),
});

const BatchWeatherSchema = z.object({
  items: z
    .array(
      z.object({
        date: z.string().regex(ISO_DATE_RE),
        et0: z.number().finite().min(0),
      }),
    )
    .min(1),
});

function ensureDir(p: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
}

function maybeMigrateLegacyDb(targetPath: string) {
  const repoRoot = path.resolve(__dirname, '../../..');
  const legacy = path.join(repoRoot, 'irrigation.db');
  if (!fs.existsSync(targetPath) && fs.existsSync(legacy)) {
    ensureDir(targetPath);
    fs.copyFileSync(legacy, targetPath);
  }
}

function openDb() {
  const repoRoot = path.resolve(__dirname, '../../..');
  const dbPath = process.env.DB_PATH
    ? path.resolve(repoRoot, process.env.DB_PATH)
    : path.join(repoRoot, 'data', 'irrigation.db');

  maybeMigrateLegacyDb(dbPath);
  ensureDir(dbPath);

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  return { db, dbPath };
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS fields (
      field_name TEXT PRIMARY KEY,
      crop_factor REAL NOT NULL,
      fertilizer_week INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS weather_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      et0 REAL NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_weather_data_date ON weather_data(date);

    CREATE TABLE IF NOT EXISTS etc_calculations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      field_name TEXT NOT NULL,
      date TEXT NOT NULL,
      etc_value REAL NOT NULL,
      calculated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_etc_calculations_field_date ON etc_calculations(field_name, date);
    CREATE INDEX IF NOT EXISTS idx_etc_calculations_calculated_at ON etc_calculations(calculated_at);
  `);
}

function seedDefaultFields(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as c FROM fields').get() as any;
  if ((count?.c ?? 0) > 0) return;
  const insert = db.prepare('INSERT INTO fields (field_name, crop_factor, fertilizer_week) VALUES (?, ?, ?)');
  const txn = db.transaction(() => {
    insert.run('DF1B', 0.0, 1);
    insert.run('SS2B', 0.0, 1);
    insert.run('MF8B', 0.0, 1);
  });
  txn();
}

type Field = {
  field_name: string;
  crop_factor: number;
  fertilizer_week: number;
};

type EtcTable = {
  dates: string[];
  fields: Field[];
  et0ByDate: Record<string, number>;
  etcByFieldByDate: Record<string, Record<string, number>>;
  calculatedAt?: string;
};

function computeEtcTable(db: Database.Database, dates: string[], calculatedAt?: string): EtcTable {
  const fields = db
    .prepare('SELECT field_name, crop_factor, fertilizer_week FROM fields ORDER BY field_name')
    .all() as Field[];

  if (fields.length === 0) {
    const err = new Error('No fields provided. Please add at least one field.');
    (err as any).details = { code: 'NO_FIELDS' };
    throw err;
  }

  const invalid = fields.filter((f) => typeof f.crop_factor !== 'number' || !Number.isFinite(f.crop_factor) || f.crop_factor < 0);
  if (invalid.length > 0) {
    const err = new Error('One or more fields have an invalid crop factor.');
    (err as any).details = { code: 'INVALID_CROP_FACTOR', fields: invalid.map((f) => f.field_name) };
    throw err;
  }

  if (dates.length !== 3) {
    const err = new Error('ETc calculation requires exactly 3 dates.');
    (err as any).details = { code: 'INVALID_DATE_COUNT', expected: 3, got: dates.length };
    throw err;
  }

  const placeholders = dates.map(() => '?').join(',');
  const weather = db
    .prepare(`SELECT date, et0 FROM weather_data WHERE date IN (${placeholders}) ORDER BY date`)
    .all(...dates) as { date: string; et0: number }[];

  const et0ByDate: Record<string, number> = {};
  for (const w of weather) et0ByDate[w.date] = w.et0;

  const missingDates = dates.filter((d) => !(d in et0ByDate));
  if (missingDates.length > 0) {
    const err = new Error('Missing ET0 values for required dates.');
    (err as any).details = { code: 'MISSING_ET0', missingDates };
    throw err;
  }

  const etcByFieldByDate: Record<string, Record<string, number>> = {};
  for (const f of fields) {
    etcByFieldByDate[f.field_name] = {};
    for (const d of dates) {
      const etc = et0ByDate[d] * f.crop_factor;
      etcByFieldByDate[f.field_name][d] = etc;
    }
  }

  return { dates, fields, et0ByDate, etcByFieldByDate, calculatedAt };
}

function persistEtcTable(db: Database.Database, table: EtcTable) {
  const calculatedAt = new Date().toISOString();
  const del = db.prepare('DELETE FROM etc_calculations WHERE field_name = ? AND date = ?');
  const ins = db.prepare(
    'INSERT INTO etc_calculations (field_name, date, etc_value, calculated_at) VALUES (?, ?, ?, ?)',
  );

  const txn = db.transaction(() => {
    for (const field of table.fields) {
      for (const date of table.dates) {
        const etc = table.etcByFieldByDate[field.field_name][date];
        del.run(field.field_name, date);
        ins.run(field.field_name, date, etc, calculatedAt);
      }
    }
  });

  txn();
  return calculatedAt;
}

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: true,
    credentials: false,
  }),
);

const { db, dbPath } = openDb();
initSchema(db);
seedDefaultFields(db);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dbPath });
});

app.get('/api/horizon', (_req, res) => {
  res.json({ dates: getNextThreeDates() });
});

app.get('/api/fields', (_req, res) => {
  const fields = db
    .prepare('SELECT field_name, crop_factor, fertilizer_week FROM fields ORDER BY field_name')
    .all();
  res.json(fields);
});

app.post('/api/fields', (req, res) => {
  const parsed = FieldSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid field input.', details: parsed.error.flatten() });
  }

  const f = parsed.data;
  const exists = db.prepare('SELECT 1 FROM fields WHERE field_name = ?').get(f.field_name);
  if (exists) {
    return res.status(409).json({ message: `Field '${f.field_name}' already exists.`, details: { code: 'DUPLICATE_FIELD' } });
  }

  db.prepare('INSERT INTO fields (field_name, crop_factor, fertilizer_week) VALUES (?, ?, ?)').run(
    f.field_name,
    f.crop_factor,
    f.fertilizer_week,
  );

  res.status(201).json(f);
});

app.put('/api/fields/:field_name', (req, res) => {
  const field_name = String(req.params.field_name);
  const parsed = UpdateFieldSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid field update input.', details: parsed.error.flatten() });
  }

  const result = db
    .prepare('UPDATE fields SET crop_factor = ?, fertilizer_week = ? WHERE field_name = ?')
    .run(parsed.data.crop_factor, parsed.data.fertilizer_week, field_name);

  if (result.changes === 0) {
    return res.status(404).json({ message: `Field '${field_name}' not found.`, details: { code: 'NOT_FOUND' } });
  }

  res.json({ field_name, ...parsed.data });
});

app.delete('/api/fields/:field_name', (req, res) => {
  const field_name = String(req.params.field_name);
  const result = db.prepare('DELETE FROM fields WHERE field_name = ?').run(field_name);
  if (result.changes === 0) {
    return res.status(404).json({ message: `Field '${field_name}' not found.`, details: { code: 'NOT_FOUND' } });
  }
  res.json({ ok: true });
});

app.get('/api/weather', (req, res) => {
  const datesParam = String(req.query.dates ?? '');
  const dates = datesParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const invalid = dates.filter((d) => !ISO_DATE_RE.test(d));
  if (invalid.length > 0) {
    return res.status(400).json({ message: 'Invalid date format.', details: { invalid } });
  }

  if (dates.length === 0) return res.json([]);

  const placeholders = dates.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT date, et0 FROM weather_data WHERE date IN (${placeholders}) ORDER BY date`)
    .all(...dates);

  res.json(rows);
});

app.put('/api/weather/:date', (req, res) => {
  const date = String(req.params.date);
  if (!ISO_DATE_RE.test(date)) {
    return res.status(400).json({ message: 'Invalid date format.', details: { code: 'INVALID_DATE', date } });
  }

  const parsed = PutWeatherSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid weather input.', details: parsed.error.flatten() });
  }

  db.prepare('INSERT OR REPLACE INTO weather_data (date, et0) VALUES (?, ?)').run(date, parsed.data.et0);
  res.json({ ok: true });
});

app.put('/api/weather/batch', (req, res) => {
  const parsed = BatchWeatherSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid weather batch input.', details: parsed.error.flatten() });
  }

  const upsert = db.prepare('INSERT OR REPLACE INTO weather_data (date, et0) VALUES (?, ?)');
  const txn = db.transaction(() => {
    for (const item of parsed.data.items) {
      upsert.run(item.date, item.et0);
    }
  });
  txn();

  res.json({ ok: true });
});

app.get('/api/etc', (req, res) => {
  const datesParam = String(req.query.dates ?? '');
  const dates = datesParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const invalid = dates.filter((d) => !ISO_DATE_RE.test(d));
  if (invalid.length > 0) {
    return res.status(400).json({ message: 'Invalid date format.', details: { invalid } });
  }

  try {
    const table = computeEtcTable(db, dates);
    return res.json(table);
  } catch (e: any) {
    return res.status(400).json({ message: e.message ?? 'Could not compute ETc.', details: e.details });
  }
});

app.post('/api/etc/recalculate', (_req, res) => {
  const dates = getNextThreeDates();
  try {
    const table = computeEtcTable(db, dates);
    const calculatedAt = persistEtcTable(db, table);
    return res.json({ ...table, calculatedAt });
  } catch (e: any) {
    return res.status(400).json({ message: e.message ?? 'Could not recalculate ETc.', details: e.details });
  }
});

const port = Number(process.env.API_PORT ?? 3001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
});
