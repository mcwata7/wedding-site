import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, ApiRequestError } from '../api/client'
import { useGuestAuth } from './GuestAuthContext'

interface Contact { email?: string; phone?: string; mailingAddress?: string; complete: boolean }

/** Check once per authenticated session. Skipping is temporary, not profile completion. */
export function ContactGate({ children }: { children: React.ReactNode }) {
  const { logout, contactDismissed, dismissContact } = useGuestAuth()
  const query = useQuery({ queryKey: ['guest-contact'], queryFn: () => api.get<Contact>('/api/v1/guest/contact'), retry: false, enabled: !contactDismissed })
  if (contactDismissed) return <>{children}</>
  if (query.isPending) return <p className="p-8 text-center">Checking your contact information…</p>
  if (query.error) return (
    <div className="p-8 text-center space-y-4">
      <p>{query.error instanceof ApiRequestError ? (query.error.status === 403 ? 'Please sign in again to provide your contact information.' : query.error.message) : 'Unable to check your contact information.'}</p>
      {query.error instanceof ApiRequestError && (query.error.code === 'GUEST_IDENTITY_REQUIRED' || query.error.status === 403)
        ? <button onClick={logout}>Sign in again</button>
        : <button onClick={() => query.refetch()}>Try again</button>}
      <button className="block mx-auto underline" onClick={dismissContact}>Skip for now</button>
    </div>
  )
  if (query.data.complete) return <>{children}</>
  return <ContactForm contact={query.data} onDone={dismissContact} />
}

function ContactForm({ contact, onDone }: { contact: Contact; onDone: () => void }) {
  const [email, setEmail] = useState(contact.email ?? '')
  const [phone, setPhone] = useState(contact.phone ?? '')
  const [mailingAddress, setAddress] = useState(contact.mailingAddress ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError('')
    try {
      await api.patch('/api/v1/guest/contact', { email: email.trim() || null, phone: phone.trim() || null, mailingAddress: mailingAddress.trim() || null })
      onDone()
    } catch (err) { setError(err instanceof ApiRequestError ? err.message : 'Unable to save. Please try again.') }
    finally { setSaving(false) }
  }
  const inputClass = 'block w-full rounded-md border border-gray-300 px-3 py-2 text-ink'
  return (
    <div className="min-h-screen temple-backdrop flex items-center justify-center p-4">
      <form onSubmit={save} className="w-full max-w-md bg-paper rounded-lg p-8 space-y-4">
        <h1 className="font-display text-2xl">Your contact information</h1>
        <p className="text-sm">Help us keep in touch. Your mailing address is shared with your invitation party so we can send your invitation.</p>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <label className="block">Email<input className={inputClass} type="email" autoComplete="email" maxLength={254} value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="block">Phone number<input className={inputClass} type="tel" autoComplete="tel" maxLength={50} value={phone} onChange={e => setPhone(e.target.value)} /></label>
        <label className="block">Party mailing address<textarea className={inputClass} autoComplete="street-address" rows={4} maxLength={2000} placeholder="Include city, postal code and country" value={mailingAddress} onChange={e => setAddress(e.target.value)} /></label>
        <button disabled={saving} className="w-full bg-accent text-white rounded-md py-2 disabled:opacity-50">{saving ? 'Saving…' : 'Save and continue'}</button>
        <button type="button" disabled={saving} className="w-full underline" onClick={onDone}>Skip for now</button>
      </form>
    </div>
  )
}
