export type Field = {
  field_name: string;
  crop_factor: number;
  fertilizer_week: number;
};

export type WeatherData = {
  date: string;
  et0: number;
};

export type EtcTable = {
  dates: string[];
  fields: Field[];
  et0ByDate: Record<string, number>;
  etcByFieldByDate: Record<string, Record<string, number>>;
  calculatedAt?: string;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!res.ok) {
    const message = (data as any)?.message || `Request failed: ${res.status}`;
    const details = (data as any)?.details;
    const err = new Error(message);
    (err as any).details = details;
    throw err;
  }

  return data as T;
}

export function getHorizon() {
  return request<{ dates: string[] }>('/api/horizon');
}

export function listFields() {
  return request<Field[]>('/api/fields');
}

export function createField(input: Field) {
  return request<Field>('/api/fields', { method: 'POST', body: JSON.stringify(input) });
}

export function updateField(field_name: string, input: { crop_factor: number; fertilizer_week: number }) {
  return request<Field>(`/api/fields/${encodeURIComponent(field_name)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteField(field_name: string) {
  return request<{ ok: true }>(`/api/fields/${encodeURIComponent(field_name)}`, { method: 'DELETE' });
}

export function getWeather(dates: string[]) {
  const qs = new URLSearchParams();
  qs.set('dates', dates.join(','));
  return request<WeatherData[]>(`/api/weather?${qs.toString()}`);
}

export function putWeatherBatch(items: WeatherData[]) {
  return request<{ ok: true }>('/api/weather/batch', { method: 'PUT', body: JSON.stringify({ items }) });
}

export function getEtc(dates: string[]) {
  const qs = new URLSearchParams();
  qs.set('dates', dates.join(','));
  return request<EtcTable>(`/api/etc?${qs.toString()}`);
}

export function recalculateEtc() {
  return request<EtcTable>('/api/etc/recalculate', { method: 'POST' });
}
