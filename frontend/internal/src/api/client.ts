import type { ApiError } from './types'

// Empty by default: relative paths hit the same origin, which nginx proxies to the API in
// local/Docker Compose. Set at build time (e.g. Render static site) when the frontend and API
// are deployed to different origins.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export function mediaUrl(id: string): string {
  return `${API_BASE_URL}/api/v1/media/${id}`
}

let _token: string | null = null
let _onUnauthorized: (() => void) | null = null

export function setToken(token: string | null) {
  _token = token
}

export function setUnauthorizedHandler(fn: () => void) {
  _onUnauthorized = fn
}

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiRequestError'
  }
}

// Shared token/401/error-envelope handling for both the JSON path (request) and the raw
// binary-download path (downloadBlob) -- kept as one function so the two can't drift.
async function rawRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    ...(init.body && !(init.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(init.headers as Record<string, string>),
  }
  if (_token) headers['Authorization'] = `Bearer ${_token}`

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })

  if (res.status === 401) {
    _onUnauthorized?.()
    throw new ApiRequestError('UNAUTHORIZED', 'Session expired. Please log in again.', 401)
  }

  if (!res.ok) {
    let err: ApiError = { code: 'ERROR', message: `Request failed (${res.status})` }
    try {
      err = await res.json()
    } catch {
      // use default
    }
    throw new ApiRequestError(err.code, err.message, res.status)
  }

  return res
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await rawRequest(path, init)
  if (res.status === 204) return undefined as T
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('text/')) return (await res.text()) as T
  return res.json()
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, form: FormData) =>
    request<T>(path, { method: 'POST', body: form }),
  downloadCsv: async (path: string, filename: string) => {
    const csv = await request<string>(path, { headers: { Accept: 'text/csv' } })
    saveBlob(new Blob([csv], { type: 'text/csv' }), filename)
  },
  downloadBlob: async (path: string, filename: string) => {
    const res = await rawRequest(path)
    saveBlob(await res.blob(), filename)
  },
  postBlob: async (path: string, body: unknown): Promise<Blob> => {
    const res = await rawRequest(path, { method: 'POST', body: JSON.stringify(body) })
    return res.blob()
  },
}
