import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useSiteConfig, useGuestParty, useWeddingRsvp, siteMediaUrl } from '../api/hooks'
import type { WeddingGuest } from '../api/types'
import { LoadingSpinner, ErrorMessage, PageHeading, PageBanner } from '../components'

function GuestResponse({ guest }: { guest: WeddingGuest }) {
  const [status, setStatus] = useState(guest.rsvp_status)
  const [note, setNote] = useState(guest.rsvp_note ?? '')
  const [saved, setSaved] = useState(false)
  const update = useWeddingRsvp()
  useEffect(() => {
    setStatus(guest.rsvp_status)
    setNote(guest.rsvp_note ?? '')
  }, [guest.rsvp_status, guest.rsvp_note])

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaved(false)
    try {
      await update.mutateAsync({ id: guest.id, status, note })
      setSaved(true)
    } catch {
      // The mutation error is displayed below and the guest's draft is preserved.
    }
  }

  return (
    <form onSubmit={save} className="rounded-lg border border-ink/15 p-5 space-y-4">
      <h2 className="font-semibold text-lg">{guest.first_name} {guest.last_name}</h2>
      <label className="block space-y-1" htmlFor={`rsvp-${guest.id}`}>
        <span>Will you attend the wedding?</span>
        <select id={`rsvp-${guest.id}`} value={status} onChange={event => { setStatus(event.target.value as WeddingGuest['rsvp_status']); setSaved(false) }} className="block w-full rounded border border-ink/20 bg-paper p-2" disabled={update.isPending}>
          <option value="PENDING">Not decided yet</option>
          <option value="ATTENDING">Yes, I'll attend</option>
          <option value="DECLINED">Sorry, I can't attend</option>
          {guest.rsvp_status === 'WAITLISTED' && <option value="WAITLISTED" disabled>Waitlisted — contact the couple</option>}
        </select>
      </label>
      <label className="block space-y-1" htmlFor={`rsvp-note-${guest.id}`}>
        <span>Note (optional)</span>
        <textarea id={`rsvp-note-${guest.id}`} value={note} onChange={event => { setNote(event.target.value); setSaved(false) }} className="block w-full rounded border border-ink/20 bg-paper p-2" rows={2} disabled={update.isPending} />
      </label>
      {update.error && <p role="alert" className="text-red-700">{update.error.message}</p>}
      {saved && <p role="status">Your wedding RSVP has been saved.</p>}
      <button type="submit" disabled={update.isPending || status === 'WAITLISTED'} className="rounded bg-accent text-white px-4 py-2 disabled:opacity-50">{update.isPending ? 'Saving…' : 'Save RSVP'}</button>
    </form>
  )
}

export function RsvpPage() {
  const config = useSiteConfig()
  const page = config.data?.pages.find(p => p.slug === 'rsvp')
  const party = useGuestParty(!!page)
  if (config.isLoading) return <LoadingSpinner />
  if (config.error) return <ErrorMessage message={config.error.message} />
  if (!page) return <Navigate to="/" replace />

  return (
    <div>
      <PageBanner src={siteMediaUrl(page.image_id)} />
      <PageHeading title={page.heading || page.label} />
      {page.body && <p className="max-w-2xl mx-auto mb-6 text-ink/80 whitespace-pre-line leading-relaxed">{page.body}</p>}
      <p className="text-center mb-6">Please respond once for each guest in your party. Your response covers the entire wedding.</p>
      {party.isLoading ? <LoadingSpinner /> : party.error ? <ErrorMessage message={party.error.message} /> : (
        <div className="max-w-2xl mx-auto space-y-4">
          {party.data?.guests.map(guest => <GuestResponse key={guest.id} guest={guest} />)}
          {party.data?.guests.length === 0 && <p className="text-center">No active guests were found in your party.</p>}
        </div>
      )}
    </div>
  )
}
