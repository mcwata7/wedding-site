import type { ApiError } from './types'

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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(init.body && !(init.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : {}),
    ...(init.headers as Record<string, string>),
  }
  if (_token) headers['Authorization'] = `Bearer ${_token}`

  const res = await fetch(path, { ...init, headers })

  if (res.status === 401) {
    _onUnauthorized?.()
    throw new ApiRequestError('UNAUTHORIZED', 'Session expired. Please verify again.', 401)
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

  if (res.status === 204) return undefined as T
  const ct = res.headers.get('content-type') ?? ''
  if (ct.includes('text/')) return (await res.text()) as T
  return res.json()
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
}
