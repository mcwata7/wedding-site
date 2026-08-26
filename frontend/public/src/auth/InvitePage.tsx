import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

const PENDING_KEY = 'wedding_pending_qr'

/** Landing target for a QR code: /i/:qrToken. Stashes the token and hands off to /unlock,
 * which does the actual lookup + verification-answer exchange. */
export function InvitePage() {
  const { qrToken } = useParams<{ qrToken: string }>()
  const navigate = useNavigate()

  useEffect(() => {
    if (qrToken) sessionStorage.setItem(PENDING_KEY, qrToken)
    navigate('/unlock', { replace: true })
  }, [qrToken, navigate])

  return null
}

export function readPendingQrToken(): string {
  return sessionStorage.getItem(PENDING_KEY) ?? ''
}

export function clearPendingQrToken() {
  sessionStorage.removeItem(PENDING_KEY)
}
