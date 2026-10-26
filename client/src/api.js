export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || 'משהו השתבש, נסי שוב');
    this.status = status;
    this.code = body?.error;
    this.fields = body?.fields || {};
    this.body = body;
  }
}

import { DEMO } from './demo/flag.js';

async function request(method, path, body) {
  if (DEMO) {
    const { mockRequest } = await import('./demo/mockApi.js');
    const r = await mockRequest(method, path, body);
    if (!r.ok) throw new ApiError(r.status, r.data);
    return r.data;
  }
  let res;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, { message: 'אין חיבור לשרת. בדקי את האינטרנט ונסי שוב.' });
  }
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get: (p) => request('GET', p),
  post: (p, b = {}) => request('POST', p, b),
  put: (p, b) => request('PUT', p, b),
  patch: (p, b) => request('PATCH', p, b),
  del: (p) => request('DELETE', p),
};

export const qs = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== '' && v != null) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};
