import { useState } from 'react'
import { Plus, Archive } from 'lucide-react'
import {
  useEvents, useVenues, useCreateEvent, useCreateVenue,
  useUpdateResource, useArchiveResource, useParties, useAddEligibleParty,
} from '../../api/hooks'
import {
  Button, Modal, Field, Input, TextArea, Select, Table,
  LoadingSpinner, ErrorMessage, PageHeader, useToast, Badge,
} from '../../components'
import { ApiRequestError } from '../../api/client'
import { fmtDateTime, fmtDate } from '../../lib/format'
import type { Event, Venue } from '../../api/types'

export function EventsPage() {
  const toast = useToast()
  const { data: events, isLoading: eventsLoading, error: eventsError } = useEvents()
  const { data: venues } = useVenues()
  const { data: parties } = useParties()

  const createEvent = useCreateEvent()
  const createVenue = useCreateVenue()
  const updateResource = useUpdateResource()
  const archiveResource = useArchiveResource()
  const addEligible = useAddEligibleParty()

  const [tab, setTab] = useState<'events' | 'venues'>('events')

  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [showCreateVenue, setShowCreateVenue] = useState(false)
  const [editEvent, setEditEvent] = useState<Event | null>(null)
  const [editVenue, setEditVenue] = useState<Venue | null>(null)
  const [eligibilityEvent, setEligibilityEvent] = useState<Event | null>(null)

  const emptyEventForm = { name: '', venue_id: '', description: '', starts_at: '', ends_at: '', dress_code: '', capacity: '', rsvp_deadline: '', public_visible: 'true' }
  const [eventForm, setEventForm] = useState<Record<string, string>>(emptyEventForm)

  const emptyVenueForm = { name: '', address: '', contact_information: '', pricing: '', capacity: '', food_score: '', view_score: '', notes: '' }
  const [venueForm, setVenueForm] = useState<Record<string, string>>(emptyVenueForm)

  const setEventField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setEventForm(f => ({ ...f, [k]: e.target.value }))
  const setVenueField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setVenueForm(f => ({ ...f, [k]: e.target.value }))

  const submitEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editEvent) {
        // PATCH /resources/events/{id} — snake_case column allowlist
        const body: Record<string, unknown> = { ...eventForm, public_visible: eventForm.public_visible !== 'false' }
        if (!body.venue_id) delete body.venue_id
        if (!body.capacity) delete body.capacity; else body.capacity = Number(body.capacity)
        if (!body.ends_at) delete body.ends_at
        if (!body.rsvp_deadline) delete body.rsvp_deadline
        await updateResource.mutateAsync({ resource: 'events', id: editEvent.id, body })
        toast.success('Event updated.')
        setEditEvent(null)
      } else {
        // POST /internal/events — camelCase, bound by name to a Java record. name/description/
        // dressCode/capacity must ALWAYS be present (send null, never omit): the INSERT binds
        // them straight from the request body, so a missing key is a missing SQL parameter.
        await createEvent.mutateAsync({
          name: eventForm.name,
          description: eventForm.description || null,
          dressCode: eventForm.dress_code || null,
          capacity: eventForm.capacity ? Number(eventForm.capacity) : null,
          venueId: eventForm.venue_id || null,
          startsAt: eventForm.starts_at,
          endsAt: eventForm.ends_at || null,
          rsvpDeadline: eventForm.rsvp_deadline || null,
          publicVisible: eventForm.public_visible !== 'false',
        })
        toast.success('Event created.')
        setShowCreateEvent(false)
        setEventForm(emptyEventForm)
      }
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed.')
    }
  }

  const submitVenue = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = { ...venueForm }
    if (!body.capacity) delete body.capacity; else body.capacity = Number(body.capacity)
    if (!body.food_score) delete body.food_score; else body.food_score = Number(body.food_score)
    if (!body.view_score) delete body.view_score; else body.view_score = Number(body.view_score)
    try {
      if (editVenue) {
        await updateResource.mutateAsync({ resource: 'venues', id: editVenue.id, body })
        toast.success('Venue updated.')
        setEditVenue(null)
      } else {
        await createVenue.mutateAsync(body)
        toast.success('Venue created.')
        setShowCreateVenue(false)
        setVenueForm(emptyVenueForm)
      }
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed.')
    }
  }

  const openEditEvent = (ev: Event) => {
    setEventForm({
      name: ev.name,
      venue_id: ev.venue_id ?? '',
      description: ev.description ?? '',
      starts_at: ev.starts_at ? ev.starts_at.slice(0, 16) : '',
      ends_at: ev.ends_at ? ev.ends_at.slice(0, 16) : '',
      dress_code: ev.dress_code ?? '',
      capacity: ev.capacity?.toString() ?? '',
      rsvp_deadline: ev.rsvp_deadline ? ev.rsvp_deadline.slice(0, 16) : '',
      public_visible: ev.public_visible === false ? 'false' : 'true',
    })
    setEditEvent(ev)
  }

  const openEditVenue = (v: Venue) => {
    setVenueForm({
      name: v.name, address: v.address ?? '', contact_information: v.contact_information ?? '',
      pricing: v.pricing ?? '', capacity: v.capacity?.toString() ?? '',
      food_score: v.food_score?.toString() ?? '', view_score: v.view_score?.toString() ?? '',
      notes: v.notes ?? '',
    })
    setEditVenue(v)
  }

  const handleArchiveEvent = async (ev: Event) => {
    if (!confirm(`Archive event "${ev.name}"?`)) return
    try {
      await archiveResource.mutateAsync({ resource: 'events', id: ev.id })
      toast.success('Event archived.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Archive failed.')
    }
  }

  const handleArchiveVenue = async (v: Venue) => {
    if (!confirm(`Archive venue "${v.name}"?`)) return
    try {
      await archiveResource.mutateAsync({ resource: 'venues', id: v.id })
      toast.success('Venue archived.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Archive failed.')
    }
  }

  const handleAddEligibility = async (partyId: string) => {
    if (!eligibilityEvent) return
    try {
      await addEligible.mutateAsync({ eventId: eligibilityEvent.id, partyId })
      toast.success('Party marked eligible. RSVPs created.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed.')
    }
  }

  const eventColumns = [
    { key: 'name', header: 'Event' },
    { key: 'starts_at', header: 'Starts', render: (r: Event) => fmtDateTime(r.starts_at) },
    { key: 'venue_name', header: 'Venue', render: (r: Event) => r.venue_name || '—' },
    { key: 'capacity', header: 'Capacity', render: (r: Event) => r.capacity != null ? `${r.attending_count} / ${r.capacity}${r.waitlist_count > 0 ? ` (+${r.waitlist_count} waitlist)` : ''}` : `${r.attending_count} attending` },
    { key: 'rsvp_deadline', header: 'RSVP Deadline', render: (r: Event) => fmtDate(r.rsvp_deadline) },
    { key: 'public_visible', header: 'On Site', render: (r: Event) => r.public_visible === false ? <Badge label="Hidden" className="bg-gray-100 text-gray-600" /> : <Badge label="Visible" className="bg-green-100 text-green-700" /> },
    {
      key: 'actions', header: '',
      render: (r: Event) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => openEditEvent(r)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => setEligibilityEvent(r)}>Eligibility</Button>
          <Button size="sm" variant="ghost" onClick={() => handleArchiveEvent(r)}><Archive size={14} /></Button>
        </div>
      ),
    },
  ]

  const venueColumns = [
    { key: 'name', header: 'Venue' },
    { key: 'address', header: 'Address', render: (r: Venue) => r.address || '—' },
    { key: 'capacity', header: 'Capacity', render: (r: Venue) => r.capacity ?? '—' },
    { key: 'food_score', header: 'Food', render: (r: Venue) => r.food_score ?? '—' },
    { key: 'view_score', header: 'View', render: (r: Venue) => r.view_score ?? '—' },
    {
      key: 'actions', header: '',
      render: (r: Venue) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => openEditVenue(r)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => handleArchiveVenue(r)}><Archive size={14} /></Button>
        </div>
      ),
    },
  ]

  const venueOptions = (venues ?? []).map(v => ({ value: v.id, label: v.name }))

  const EventForm = ({ onClose }: { onClose: () => void }) => (
    <form onSubmit={submitEvent} className="space-y-3">
      <Field label="Event Name" required><Input required value={eventForm.name} onChange={setEventField('name')} /></Field>
      <Field label="Venue">
        <Select value={eventForm.venue_id} onChange={v => setEventForm(f => ({ ...f, venue_id: v }))} options={venueOptions} placeholder="Select venue…" />
      </Field>
      <Field label="Description"><TextArea value={eventForm.description} onChange={setEventField('description')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts At" required><Input required type="datetime-local" value={eventForm.starts_at} onChange={setEventField('starts_at')} /></Field>
        <Field label="Ends At"><Input type="datetime-local" value={eventForm.ends_at} onChange={setEventField('ends_at')} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Dress Code"><Input value={eventForm.dress_code} onChange={setEventField('dress_code')} /></Field>
        <Field label="Capacity"><Input type="number" min="1" value={eventForm.capacity} onChange={setEventField('capacity')} /></Field>
      </div>
      <Field label="RSVP Deadline"><Input type="datetime-local" value={eventForm.rsvp_deadline} onChange={setEventField('rsvp_deadline')} /></Field>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={eventForm.public_visible !== 'false'}
          onChange={e => setEventForm(f => ({ ...f, public_visible: e.target.checked ? 'true' : 'false' }))}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        Show on wedding site Schedule tab
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={createEvent.isPending || updateResource.isPending}>Save</Button>
      </div>
    </form>
  )

  const VenueForm = ({ onClose }: { onClose: () => void }) => (
    <form onSubmit={submitVenue} className="space-y-3">
      <Field label="Venue Name" required><Input required value={venueForm.name} onChange={setVenueField('name')} /></Field>
      <Field label="Address"><Input value={venueForm.address} onChange={setVenueField('address')} /></Field>
      <Field label="Contact Information"><Input value={venueForm.contact_information} onChange={setVenueField('contact_information')} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Capacity"><Input type="number" min="1" value={venueForm.capacity} onChange={setVenueField('capacity')} /></Field>
        <Field label="Food Score (1-10)"><Input type="number" min="1" max="10" value={venueForm.food_score} onChange={setVenueField('food_score')} /></Field>
        <Field label="View Score (1-10)"><Input type="number" min="1" max="10" value={venueForm.view_score} onChange={setVenueField('view_score')} /></Field>
      </div>
      <Field label="Pricing"><Input value={venueForm.pricing} onChange={setVenueField('pricing')} placeholder="e.g. 50000 NPR / day" /></Field>
      <Field label="Notes"><TextArea value={venueForm.notes} onChange={setVenueField('notes')} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={createVenue.isPending || updateResource.isPending}>Save</Button>
      </div>
    </form>
  )

  return (
    <div>
      <PageHeader title="Events & Venues">
        <Button size="sm" variant="secondary" onClick={() => { setVenueForm(emptyVenueForm); setShowCreateVenue(true) }}>
          <Plus size={14} /> Add Venue
        </Button>
        <Button size="sm" onClick={() => { setEventForm(emptyEventForm); setShowCreateEvent(true) }}>
          <Plus size={14} /> Add Event
        </Button>
      </PageHeader>

      <div className="flex gap-2 mb-4">
        {(['events', 'venues'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${tab === t ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        <>
          {eventsLoading && <LoadingSpinner />}
          {eventsError && <ErrorMessage message={(eventsError as Error).message} />}
          {events && <Table columns={eventColumns} rows={events} />}
        </>
      )}

      {tab === 'venues' && (
        <>
          {venues && <Table columns={venueColumns} rows={venues} />}
        </>
      )}

      <Modal open={showCreateEvent} onClose={() => setShowCreateEvent(false)} title="Add Event" size="lg">
        <EventForm onClose={() => setShowCreateEvent(false)} />
      </Modal>

      <Modal open={!!editEvent} onClose={() => setEditEvent(null)} title="Edit Event" size="lg">
        <EventForm onClose={() => setEditEvent(null)} />
      </Modal>

      <Modal open={showCreateVenue} onClose={() => setShowCreateVenue(false)} title="Add Venue" size="lg">
        <VenueForm onClose={() => setShowCreateVenue(false)} />
      </Modal>

      <Modal open={!!editVenue} onClose={() => setEditVenue(null)} title="Edit Venue" size="lg">
        <VenueForm onClose={() => setEditVenue(null)} />
      </Modal>

      {/* Eligibility Modal */}
      <Modal open={!!eligibilityEvent} onClose={() => setEligibilityEvent(null)} title={`Eligibility — ${eligibilityEvent?.name}`} size="lg">
        <p className="text-sm text-gray-600 mb-3">Click a party to mark them eligible for this event. RSVPs will be created automatically for all active guests in the party.</p>
        <div className="space-y-1 max-h-80 overflow-y-auto">
          {(parties ?? []).map(p => (
            <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded hover:bg-gray-50">
              <span className="text-sm text-gray-800">{p.display_name}</span>
              <Button size="sm" variant="secondary" onClick={() => handleAddEligibility(p.id)} disabled={addEligible.isPending}>
                Add
              </Button>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={() => setEligibilityEvent(null)}>Close</Button>
        </div>
      </Modal>
    </div>
  )
}
