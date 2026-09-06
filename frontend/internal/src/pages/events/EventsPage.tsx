import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Archive } from 'lucide-react'
import {
  useEvents, useVenues, useCreateEvent, useCreateVenue,
  useUpdateResource, useArchiveResource,
} from '../../api/hooks'
import {
  Button, Modal, Field, Input, TextArea, Select, Table,
  LoadingSpinner, ErrorMessage, PageHeader, useToast, Badge, MediaPicker,
} from '../../components'
import { ApiRequestError, mediaUrl } from '../../api/client'
import { fmtDateTime, fmtDate, fmtMoney } from '../../lib/format'
import type { Event, Venue } from '../../api/types'
import { VenueRoomsManager } from '../venues/VenueRoomsManager'
import { VenueFeesManager } from '../venues/VenueFeesManager'

export function EventsPage() {
  const toast = useToast()
  const navigate = useNavigate()
  const { data: events, isLoading: eventsLoading, error: eventsError } = useEvents()
  const { data: venues } = useVenues()

  const createEvent = useCreateEvent()
  const createVenue = useCreateVenue()
  const updateResource = useUpdateResource()
  const archiveResource = useArchiveResource()

  const [tab, setTab] = useState<'events' | 'venues'>('events')

  const [showCreateEvent, setShowCreateEvent] = useState(false)
  const [editEvent, setEditEvent] = useState<Event | null>(null)

  // Venue modal: null activeVenueId means a new, unsaved venue (no id to hang rooms off yet);
  // a string means an existing venue, whose Rooms section is shown immediately.
  const [showVenueModal, setShowVenueModal] = useState(false)
  const [activeVenueId, setActiveVenueId] = useState<string | null>(null)

  const emptyEventForm = { name: '', venue_id: '', description: '', starts_at: '', ends_at: '', dress_code: '', capacity: '', rsvp_deadline: '', public_visible: 'true' }
  const [eventForm, setEventForm] = useState<Record<string, string>>(emptyEventForm)

  const emptyVenueForm = { name: '', address: '', contact_information: '', capacity: '', notes: '', image_id: '', distance_from_ktm_km: '', transportation_required: 'false', room_block_min: '', room_block_max: '' }
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
    const body: Record<string, unknown> = { ...venueForm, transportation_required: venueForm.transportation_required === 'true' }
    for (const k of ['capacity', 'distance_from_ktm_km', 'room_block_min', 'room_block_max']) {
      if (!body[k]) delete body[k]; else body[k] = Number(body[k])
    }
    if (!body.image_id) delete body.image_id
    try {
      if (activeVenueId) {
        await updateResource.mutateAsync({ resource: 'venues', id: activeVenueId, body })
        toast.success('Venue updated.')
      } else {
        // Keep the modal open and switch into "editing" mode for the venue just created, so
        // its Rooms/Fees sections (which need a venue_id) become available without reopening.
        const created = await createVenue.mutateAsync(body)
        setActiveVenueId(created.id)
        toast.success('Venue created. Add rooms and fees below, then close when done.')
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
      capacity: v.capacity?.toString() ?? '', notes: v.notes ?? '', image_id: v.image_id ?? '',
      distance_from_ktm_km: v.distance_from_ktm_km?.toString() ?? '',
      transportation_required: v.transportation_required ? 'true' : 'false',
      room_block_min: v.room_block_min?.toString() ?? '', room_block_max: v.room_block_max?.toString() ?? '',
    })
    setActiveVenueId(v.id)
    setShowVenueModal(true)
  }

  const openAddVenue = () => {
    setVenueForm(emptyVenueForm)
    setActiveVenueId(null)
    setShowVenueModal(true)
  }

  const closeVenueModal = () => {
    setShowVenueModal(false)
    setActiveVenueId(null)
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
          <Button size="sm" variant="ghost" onClick={() => handleArchiveEvent(r)}><Archive size={14} /></Button>
        </div>
      ),
    },
  ]

  const venueColumns = [
    {
      key: 'image_id', header: '',
      render: (r: Venue) => r.image_id
        ? <img src={mediaUrl(r.image_id)} alt="" className="h-10 w-10 rounded object-cover border border-gray-200" />
        : <div className="h-10 w-10 rounded bg-gray-100" />,
    },
    { key: 'name', header: 'Venue' },
    { key: 'distance_from_ktm_km', header: 'Dist. from KTM', render: (r: Venue) => r.distance_from_ktm_km != null ? `${r.distance_from_ktm_km} km` : '—' },
    { key: 'room_block_rooms', header: 'Rooms', render: (r: Venue) => r.room_block_rooms ?? '—' },
    { key: 'total_fees', header: 'Fees', render: (r: Venue) => fmtMoney(r.total_fees) },
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

  const renderEventForm = (onClose: () => void) => (
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

  const renderVenueForm = (onClose: () => void) => (
    <form onSubmit={submitVenue} className="space-y-3">
      <Field label="Venue Name" required><Input required value={venueForm.name} onChange={setVenueField('name')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Distance from KTM (km)"><Input type="number" step="0.1" min="0" value={venueForm.distance_from_ktm_km} onChange={setVenueField('distance_from_ktm_km')} /></Field>
        <Field label="Capacity"><Input type="number" min="1" value={venueForm.capacity} onChange={setVenueField('capacity')} /></Field>
      </div>
      <Field label="Address"><Input value={venueForm.address} onChange={setVenueField('address')} /></Field>
      <Field label="Contact Information"><Input value={venueForm.contact_information} onChange={setVenueField('contact_information')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Room Block Min"><Input type="number" min="0" value={venueForm.room_block_min} onChange={setVenueField('room_block_min')} /></Field>
        <Field label="Room Block Max"><Input type="number" min="0" value={venueForm.room_block_max} onChange={setVenueField('room_block_max')} /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={venueForm.transportation_required === 'true'}
          onChange={e => setVenueForm(f => ({ ...f, transportation_required: e.target.checked ? 'true' : 'false' }))}
          className="rounded border-gray-300"
        />
        Guests need transportation arranged
      </label>
      <Field label="Venue Image">
        <MediaPicker value={venueForm.image_id} onChange={v => setVenueForm(f => ({ ...f, image_id: v }))} filter={m => m.content_type.startsWith('image/')} />
      </Field>
      <Field label="Notes"><TextArea value={venueForm.notes} onChange={setVenueField('notes')} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Close</Button>
        <Button type="submit" disabled={createVenue.isPending || updateResource.isPending}>Save</Button>
      </div>
    </form>
  )

  return (
    <div>
      <PageHeader title="Events & Venues">
        <Button size="sm" variant="secondary" onClick={openAddVenue}>
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
          {venues && <Table columns={venueColumns} rows={venues} onRowClick={v => navigate(`/venues/${v.id}`)} />}
        </>
      )}

      <Modal open={showCreateEvent} onClose={() => setShowCreateEvent(false)} title="Add Event" size="lg">
        {renderEventForm(() => setShowCreateEvent(false))}
      </Modal>

      <Modal open={!!editEvent} onClose={() => setEditEvent(null)} title="Edit Event" size="lg">
        {renderEventForm(() => setEditEvent(null))}
      </Modal>

      <Modal open={showVenueModal} onClose={closeVenueModal} title={activeVenueId ? 'Edit Venue' : 'Add Venue'} size="xl">
        {renderVenueForm(closeVenueModal)}
        {activeVenueId && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <VenueRoomsManager venueId={activeVenueId} />
          </div>
        )}
        {activeVenueId && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <VenueFeesManager venueId={activeVenueId} />
          </div>
        )}
      </Modal>
    </div>
  )
}
