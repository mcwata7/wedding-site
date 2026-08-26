import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGuestAuth } from './GuestAuthContext'
import { readPendingQrToken, clearPendingQrToken } from './InvitePage'
import { api, ApiRequestError } from '../api/client'
import type { InviteLookup, GuestSession } from '../api/types'

/** Two-step guest gate: enter/confirm the QR token, answer the party's verification question. */
export function UnlockPage() {
  const { login } = useGuestAuth()
  const navigate = useNavigate()
  const [qrToken, setQrToken] = useState(readPendingQrToken())
  const [invite, setInvite] = useState<InviteLookup | null>(null)
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<InviteLookup>('/api/v1/guest/invitations/lookup', { qrToken })
      setInvite(res)
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That invitation code was not found.')
    } finally {
      setLoading(false)
    }
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<GuestSession>('/api/v1/guest/sessions', { qrToken, answer })
      clearPendingQrToken()
      login(res.accessToken)
      navigate('/')
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : 'That answer was incorrect.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col justify-center py-12 px-4">
      <div className="mx-auto w-full max-w-sm text-center">
        <h1 className="font-display text-3xl text-ink mb-8">You're Invited</h1>
        <div className="bg-white rounded-lg shadow p-8 text-left">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
          )}
          {!invite ? (
            <form onSubmit={lookup} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink/80 mb-1">Invitation code</label>
                <input
                  required
                  value={qrToken}
                  onChange={e => setQrToken(e.target.value)}
                  placeholder="Paste your invitation code"
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-white rounded-md py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Looking up…' : 'Continue'}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-4">
              <p className="text-sm text-ink/70">Welcome, {invite.partyName}. Please answer to continue:</p>
              <div>
                <label className="block text-sm font-medium text-ink/80 mb-1">{invite.verificationQuestion}</label>
                <input
                  required
                  value={answer}
                  onChange={e => setAnswer(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-accent text-white rounded-md py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading ? 'Verifying…' : 'Unlock'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
