import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { api, ApiRequestError } from '../api/client'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<{ accessToken: string; role: string }>('/api/v1/auth/planner/login', { email, password })
      login(res.accessToken, res.role)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-center text-2xl font-bold text-gray-900 mb-8">Wedding Planner</h1>
        <div className="bg-white rounded-lg shadow p-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-6">Planner sign in</h2>
          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white rounded-md py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-gray-400">Session expires when you close this tab.</p>
      </div>
    </div>
  )
}
