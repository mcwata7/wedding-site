import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import {
  useVenue, useUpdateResource,
} from '../../api/hooks'
import {
  Button, Modal, Field, Input, TextArea, MediaPicker,
  LoadingSpinner, ErrorMessage, PageHeader, Section, useToast,
} from '../../components'
import { ApiRequestError, mediaUrl } from '../../api/client'
import { fmtMoney } from '../../lib/format'
import { VenueRoomsManager } from './VenueRoomsManager'
import { VenueFeesManager } from './VenueFeesManager'

export function VenueDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, isLoading, error } = useVenue(id!)

  const updateResource = useUpdateResource()

  const [editVenue, setEditVenue] = useState(false)

  const emptyVenueForm = { name: '', address: '', contact_information: '', capacity: '', notes: '', image_id: '', distance_from_ktm_km: '', transportation_required: 'false', room_block_min: '', room_block_max: '' }
  const [venueForm, setVenueForm] = useState<Record<string, string>>(emptyVenueForm)

  const venue = data?.venue
  const rooms = data?.rooms ?? []
  const fees = data?.fees ?? []

  if (isLoading) return <LoadingSpinner />
  if (error || !venue) return <ErrorMessage message={(error as Error)?.message ?? 'Venue not found'} />

  const openEditVenue = () => {
    setVenueForm({
      name: venue.name, address: venue.address ?? '', contact_information: venue.contact_information ?? '',
      capacity: venue.capacity?.toString() ?? '', notes: venue.notes ?? '', image_id: venue.image_id ?? '',
      distance_from_ktm_km: venue.distance_from_ktm_km?.toString() ?? '',
      transportation_required: venue.transportation_required ? 'true' : 'false',
      room_block_min: venue.room_block_min?.toString() ?? '', room_block_max: venue.room_block_max?.toString() ?? '',
    })
    setEditVenue(true)
  }

  const saveVenue = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = { ...venueForm, transportation_required: venueForm.transportation_required === 'true' }
    for (const k of ['capacity', 'distance_from_ktm_km', 'room_block_min', 'room_block_max']) {
      if (!body[k]) delete body[k]; else body[k] = Number(body[k])
    }
    if (!body.image_id) delete body.image_id
    try {
      await updateResource.mutateAsync({ resource: 'venues', id: id!, body })
      toast.success('Venue updated.')
      setEditVenue(false)
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Update failed.')
    }
  }

  const totalBeds = rooms.reduce((sum, r) => sum + (r.capacity ?? 0) * (r.max_available ?? 0), 0)
  const totalRoomCount = rooms.reduce((sum, r) => sum + (r.max_available ?? 0), 0)
  const totalFees = fees.reduce((sum, f) => sum + (f.amount ?? 0), 0)

  return (
    <div>
      <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to Events & Venues
      </button>

      <PageHeader title={venue.name}>
        <Button variant="secondary" size="sm" onClick={openEditVenue}>Edit Venue</Button>
      </PageHeader>

      <Section title="Venue Information">
        {venue.image_id && (
          <img src={mediaUrl(venue.image_id)} alt="" className="w-full max-h-64 object-cover rounded-md border border-gray-200 mb-4" />
        )}
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="font-medium text-gray-500">Address</dt><dd>{venue.address || '—'}</dd></div>
          <div><dt className="font-medium text-gray-500">Distance from KTM</dt><dd>{venue.distance_from_ktm_km != null ? `${venue.distance_from_ktm_km} km` : '—'}</dd></div>
          <div><dt className="font-medium text-gray-500">Transportation Required</dt><dd>{venue.transportation_required ? 'Yes' : 'No'}</dd></div>
          <div><dt className="font-medium text-gray-500">Room Block</dt><dd>{venue.room_block_min ?? '—'} – {venue.room_block_max ?? '—'}</dd></div>
          <div><dt className="font-medium text-gray-500">Capacity</dt><dd>{venue.capacity ?? '—'}</dd></div>
          <div><dt className="font-medium text-gray-500">Contact</dt><dd>{venue.contact_information || '—'}</dd></div>
          <div className="col-span-2"><dt className="font-medium text-gray-500">Notes</dt><dd>{venue.notes || '—'}</dd></div>
        </dl>
        <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-700">
          <strong>{totalRoomCount}</strong> rooms across all types, sleeping up to <strong>{totalBeds}</strong> guests.
          Total fees: <strong>{fmtMoney(totalFees)}</strong>.
        </div>
      </Section>

      <div className="mt-6">
        <VenueRoomsManager venueId={id!} />
      </div>

      <div className="mt-6">
        <VenueFeesManager venueId={id!} />
      </div>

      {/* Edit Venue Modal */}
      <Modal open={editVenue} onClose={() => setEditVenue(false)} title="Edit Venue" size="lg">
        <form onSubmit={saveVenue} className="space-y-3">
          <Field label="Venue Name" required><Input required value={venueForm.name} onChange={e => setVenueForm(f => ({ ...f, name: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Distance from KTM (km)"><Input type="number" step="0.1" min="0" value={venueForm.distance_from_ktm_km} onChange={e => setVenueForm(f => ({ ...f, distance_from_ktm_km: e.target.value }))} /></Field>
            <Field label="Capacity"><Input type="number" min="1" value={venueForm.capacity} onChange={e => setVenueForm(f => ({ ...f, capacity: e.target.value }))} /></Field>
          </div>
          <Field label="Address"><Input value={venueForm.address} onChange={e => setVenueForm(f => ({ ...f, address: e.target.value }))} /></Field>
          <Field label="Contact Information"><Input value={venueForm.contact_information} onChange={e => setVenueForm(f => ({ ...f, contact_information: e.target.value }))} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Room Block Min"><Input type="number" min="0" value={venueForm.room_block_min} onChange={e => setVenueForm(f => ({ ...f, room_block_min: e.target.value }))} /></Field>
            <Field label="Room Block Max"><Input type="number" min="0" value={venueForm.room_block_max} onChange={e => setVenueForm(f => ({ ...f, room_block_max: e.target.value }))} /></Field>
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
          <Field label="Notes"><TextArea value={venueForm.notes} onChange={e => setVenueForm(f => ({ ...f, notes: e.target.value }))} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditVenue(false)}>Cancel</Button>
            <Button type="submit" disabled={updateResource.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
