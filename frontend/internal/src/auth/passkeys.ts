import { browserSupportsWebAuthn, startAuthentication, startRegistration, type PublicKeyCredentialRequestOptionsJSON, type PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser'
import { api } from '../api/client'

export interface PlannerSession {
  accessToken: string
  role: string
  hasPasskey?: boolean
  enrollmentToken?: string
}
interface LoginOptions {
  hasPasskey: boolean
  challengeId?: string
  publicKey?: PublicKeyCredentialRequestOptionsJSON
}
export const passkeysSupported = () => window.isSecureContext && !/^[\d.]+$/.test(window.location.hostname) && !window.location.hostname.includes(':') && browserSupportsWebAuthn()
export const loginOptions = (email: string) => api.post<LoginOptions>('/api/v1/auth/planner/passkeys/login/options', { email, origin: window.location.origin })
export async function signInWithPasskey(email: string): Promise<PlannerSession> {
  const options = await loginOptions(email)
  if (!options.hasPasskey || !options.publicKey || !options.challengeId) throw new Error('No passkey is available for this account on this website. Use your password instead.')
  const credential = await startAuthentication({ optionsJSON: options.publicKey })
  return api.post<PlannerSession>('/api/v1/auth/planner/passkeys/login/finish', { challengeId: options.challengeId, credential })
}
export async function registerPasskey(enrollmentToken: string): Promise<void> {
  const options = await api.post<{ challengeId: string; publicKey: PublicKeyCredentialCreationOptionsJSON }>('/api/v1/internal/passkeys/register/options', { enrollmentToken, origin: window.location.origin })
  const credential = await startRegistration({ optionsJSON: options.publicKey })
  await api.post('/api/v1/internal/passkeys/register/finish', { challengeId: options.challengeId, credential })
}
export function passkeyError(error: unknown): string {
  if (error instanceof Error && (error.name === 'NotAllowedError' || error.name === 'AbortError')) return 'The passkey request was cancelled or timed out. Try again or use your password.'
  return error instanceof Error ? error.message : 'The passkey request failed. Please try again.'
}
