import { useState } from 'react'
import { Plus, Archive } from 'lucide-react'
import { useVenue, useCreateVenueRoom, useUpdateResource, useArchiveResource } from '../../api/hooks'
import { Button, Field, Input, TextArea, Table, useToast } from '../../components'
import { ApiRequestError } from '../../api/client'
import { fmtMoney } from '../../lib/format'
import type { VenueRoom } from '../../api/types'

const emptyRoomForm = { room_type: '', room_number: '', capacity: '', max_available: '', nepali_rate: '', foreigner_rate: '', notes: '' }

/** Rooms CRUD for one venue: heading, table, and a toggleable inline add/edit form (not a
 * <Modal> -- this is embedded inside the venue's own Add/Edit modal on EventsPage, and also
 * used standalone on VenueDetailPage, so it can't assume it's safe to stack a second overlay). */
export function VenueRoomsManager({ venueId }: { venueId: string }) {
  const toast = useToast()
  const { data } = useVenue(venueId)
  const rooms = data?.rooms ?? []

  const createRoom = useCreateVenueRoom()
  const updateResource = useUpdateResource()
  const archiveResource = useArchiveResource()

  const [showForm, setShowForm] = useState(false)
  const [editRoom, setEditRoom] = useState<VenueRoom | null>(null)
  const [roomForm, setRoomForm] = useState<Record<string, string>>(emptyRoomForm)

  const openAdd = () => { setRoomForm(emptyRoomForm); setEditRoom(null); setShowForm(true) }
  const openEdit = (r: VenueRoom) => {
    setRoomForm({
      room_type: r.room_type ?? '', room_number: r.room_number ?? '', capacity: r.capacity?.toString() ?? '', max_available: r.max_available?.toString() ?? '',
      nepali_rate: r.nepali_rate?.toString() ?? '', foreigner_rate: r.foreigner_rate?.toString() ?? '', notes: r.notes ?? '',
    })
    setEditRoom(r)
    setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditRoom(null); setRoomForm(emptyRoomForm) }

  const submitRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = { ...roomForm }
    // room_number is unique per venue -- omit rather than send '', or a second blank room would
    // violate that constraint (Postgres treats NULL, not '', as "no value" for uniqueness).
    if (!body.room_type) delete body.room_type
    if (!body.room_number) delete body.room_number
    for (const k of ['capacity', 'max_available', 'nepali_rate', 'foreigner_rate']) {
      if (!body[k]) delete body[k]; else body[k] = Number(body[k])
    }
    try {
      if (editRoom) {
        await updateResource.mutateAsync({ resource: 'venue-rooms', id: editRoom.id, body })
        toast.success('Room updated.')
      } else {
        await createRoom.mutateAsync({ ...body, venue_id: venueId })
        toast.success('Room added.')
      }
      closeForm()
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed.')
    }
  }

  const handleArchiveRoom = async (r: VenueRoom) => {
    if (!confirm(`Archive room type "${r.room_type}"?`)) return
    try {
      await archiveResource.mutateAsync({ resource: 'venue-rooms', id: r.id })
      toast.success('Room archived.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Archive failed.')
    }
  }

  const roomColumns = [
    { key: 'room_type', header: 'Room Type', render: (r: VenueRoom) => r.room_type || '—' },
    { key: 'room_number', header: 'Room #', render: (r: VenueRoom) => r.room_number || '—' },
    { key: 'capacity', header: 'Capacity', render: (r: VenueRoom) => r.capacity != null ? `${r.capacity} / room` : '—' },
    { key: 'max_available', header: 'Rooms Available', render: (r: VenueRoom) => r.max_available ?? '—' },
    { key: 'nepali_rate', header: 'Nepali Rate', render: (r: VenueRoom) => fmtMoney(r.nepali_rate) },
    { key: 'foreigner_rate', header: 'Foreigner Rate', render: (r: VenueRoom) => fmtMoney(r.foreigner_rate) },
    {
      key: 'actions', header: '',
      render: (r: VenueRoom) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => handleArchiveRoom(r)}><Archive size={14} /></Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Rooms ({rooms.length})</h3>
        {!showForm && (
          <Button size="sm" onClick={openAdd}>
            <Plus size={14} /> Add Room
          </Button>
        )}
      </div>
      <Table columns={roomColumns} rows={rooms} />

      {showForm && (
        <form onSubmit={submitRoom} className="mt-4 space-y-3 bg-gray-50 rounded-md p-4 border border-gray-200">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Room Type"><Input value={roomForm.room_type} onChange={e => setRoomForm(f => ({ ...f, room_type: e.target.value }))} placeholder="e.g. Deluxe Double" /></Field>
            <Field label="Room # (for a specific bookable room)"><Input value={roomForm.room_number} onChange={e => setRoomForm(f => ({ ...f, room_number: e.target.value }))} placeholder="e.g. 204" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Capacity (people/room)"><Input type="number" min="1" value={roomForm.capacity} onChange={e => setRoomForm(f => ({ ...f, capacity: e.target.value }))} /></Field>
            <Field label="Rooms Available"><Input type="number" min="0" value={roomForm.max_available} onChange={e => setRoomForm(f => ({ ...f, max_available: e.target.value }))} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nepali Rate (NPR)"><Input type="number" min="0" value={roomForm.nepali_rate} onChange={e => setRoomForm(f => ({ ...f, nepali_rate: e.target.value }))} /></Field>
            <Field label="Foreigner Rate (NPR)"><Input type="number" min="0" value={roomForm.foreigner_rate} onChange={e => setRoomForm(f => ({ ...f, foreigner_rate: e.target.value }))} /></Field>
          </div>
          <Field label="Notes"><TextArea value={roomForm.notes} onChange={e => setRoomForm(f => ({ ...f, notes: e.target.value }))} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={closeForm}>Cancel</Button>
            <Button type="submit" disabled={createRoom.isPending || updateResource.isPending}>{editRoom ? 'Update Room' : 'Add Room'}</Button>
          </div>
        </form>
      )}
    </div>
  )
}
