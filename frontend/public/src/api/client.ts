import type { ApiError } from './types'

// Empty by default: relative paths hit the same origin, which nginx proxies to the API in
// local/Docker Compose. Set at build time (e.g. Render static site) when the frontend and API
// are deployed to different origins.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

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

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })

  // Only a 401 on a request that actually carried a token means "your session expired". A 401 on
  // the unauthenticated unlock endpoints means the verification answer was wrong, and its body
  // carries the message the guest needs (including how many attempts they have left) -- so let it
  // fall through to the generic handler below rather than replacing it with a session notice.
  if (res.status === 401 && _token) {
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
