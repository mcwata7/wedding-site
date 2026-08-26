import { useState } from 'react'
import {
  useProperties, useRooms, useAssignments, useChangeRequests,
  useCreateProperty, useCreateRoom, useCreateAssignment,
  useResolveChangeRequest, useUpdateResource, useArchiveResource,
  useParties,
} from '../../api/hooks'
import {
  Button, Modal, Field, Input, TextArea, Select, Table,
  LoadingSpinner, PageHeader, useToast, Badge,
} from '../../components'
import { ApiRequestError } from '../../api/client'
import { fmtDate, statusColor } from '../../lib/format'
import type { AccommodationProperty, AccommodationRoom, AccommodationAssignment, ChangeRequest } from '../../api/types'

type Tab = 'properties' | 'rooms' | 'assignments' | 'requests'

export function AccommodationsPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('properties')

  const { data: properties } = useProperties()
  const { data: rooms } = useRooms()
  const { data: assignments } = useAssignments()
  const { data: requests, isLoading: reqLoading } = useChangeRequests()
  const { data: parties } = useParties()

  const createProperty = useCreateProperty()
  const createRoom = useCreateRoom()
  const createAssignment = useCreateAssignment()
  const resolveRequest = useResolveChangeRequest()
  const updateResource = useUpdateResource()
  const archiveResource = useArchiveResource()

  const [showCreateProperty, setShowCreateProperty] = useState(false)
  const [showCreateRoom, setShowCreateRoom] = useState(false)
  const [showCreateAssignment, setShowCreateAssignment] = useState(false)
  const [editItem, setEditItem] = useState<{ resource: string; item: Record<string, unknown> } | null>(null)

  // Property form
  const emptyProp = { name: '', address: '', contact_information: '', notes: '' }
  const [propForm, setPropForm] = useState(emptyProp)

  // Room form
  const emptyRoom = { property_id: '', room_number: '', room_type: '', capacity: '' }
  const [roomForm, setRoomForm] = useState(emptyRoom)

  // Assignment form
  const emptyAssignment = { room_id: '', party_id: '', guest_id: '', check_in: '', check_out: '', status: 'CONFIRMED', coverage_notes: '', override_capacity: 'false' }
  const [assignForm, setAssignForm] = useState(emptyAssignment)

  const submitProperty = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editItem?.resource === 'properties') {
        await updateResource.mutateAsync({ resource: 'properties', id: editItem.item.id as string, body: propForm })
        toast.success('Property updated.')
        setEditItem(null)
      } else {
        await createProperty.mutateAsync(propForm)
        toast.success('Property created.')
        setShowCreateProperty(false)
        setPropForm(emptyProp)
      }
    } catch (err) { toast.error(err instanceof ApiRequestError ? err.message : 'Failed.') }
  }

  const submitRoom = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = { ...roomForm, capacity: Number(roomForm.capacity) }
    if (!body.room_type) delete body.room_type
    try {
      if (editItem?.resource === 'rooms') {
        await updateResource.mutateAsync({ resource: 'rooms', id: editItem.item.id as string, body })
        toast.success('Room updated.')
        setEditItem(null)
      } else {
        await createRoom.mutateAsync(body)
        toast.success('Room created.')
        setShowCreateRoom(false)
        setRoomForm(emptyRoom)
      }
    } catch (err) { toast.error(err instanceof ApiRequestError ? err.message : 'Failed.') }
  }

  const submitAssignment = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = {
      room_id: assignForm.room_id,
      check_in: assignForm.check_in,
      check_out: assignForm.check_out,
      status: assignForm.status,
      override_capacity: assignForm.override_capacity === 'true',
    }
    if (assignForm.coverage_notes) body.coverage_notes = assignForm.coverage_notes
    if (assignForm.party_id) body.party_id = assignForm.party_id
    if (assignForm.guest_id) body.guest_id = assignForm.guest_id
    try {
      await createAssignment.mutateAsync(body)
      toast.success('Assignment created.')
      setShowCreateAssignment(false)
      setAssignForm(emptyAssignment)
    } catch (err) { toast.error(err instanceof ApiRequestError ? err.message : 'Failed.') }
  }

  const handleResolve = async (req: ChangeRequest, action: 'resolve' | 'decline') => {
    try {
      await resolveRequest.mutateAsync({ id: req.id, action })
      toast.success(`Request ${action === 'resolve' ? 'resolved' : 'declined'}.`)
    } catch (err) { toast.error(err instanceof ApiRequestError ? err.message : 'Failed.') }
  }

  const openEditProperty = (p: AccommodationProperty) => {
    setPropForm({ name: p.name, address: p.address ?? '', contact_information: p.contact_information ?? '', notes: p.notes ?? '' })
    setEditItem({ resource: 'properties', item: p as unknown as Record<string, unknown> })
  }

  const openEditRoom = (r: AccommodationRoom) => {
    setRoomForm({ property_id: r.property_id, room_number: r.room_number, room_type: r.room_type ?? '', capacity: r.capacity.toString() })
    setEditItem({ resource: 'rooms', item: r as unknown as Record<string, unknown> })
  }

  const propertyOptions = (properties ?? []).map(p => ({ value: p.id, label: p.name }))
  const roomOptions = (rooms ?? []).map(r => ({ value: r.id, label: `${r.property_name} — ${r.room_number}` }))
  const partyOptions = (parties ?? []).map(p => ({ value: p.id, label: p.display_name }))

  const propCols = [
    { key: 'name', header: 'Property' },
    { key: 'address', header: 'Address', render: (r: AccommodationProperty) => r.address || '—' },
    { key: 'contact_information', header: 'Contact', render: (r: AccommodationProperty) => r.contact_information || '—' },
    {
      key: 'actions', header: '',
      render: (r: AccommodationProperty) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => openEditProperty(r)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={async () => { if (!confirm('Archive?')) return; await archiveResource.mutateAsync({ resource: 'properties', id: r.id }); toast.success('Archived.') }}>Archive</Button>
        </div>
      ),
    },
  ]

  const roomCols = [
    { key: 'property_name', header: 'Property' },
    { key: 'room_number', header: 'Room #' },
    { key: 'room_type', header: 'Type', render: (r: AccommodationRoom) => r.room_type || '—' },
    { key: 'capacity', header: 'Capacity' },
    {
      key: 'actions', header: '',
      render: (r: AccommodationRoom) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => openEditRoom(r)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={async () => { if (!confirm('Archive?')) return; await archiveResource.mutateAsync({ resource: 'rooms', id: r.id }); toast.success('Archived.') }}>Archive</Button>
        </div>
      ),
    },
  ]

  const assignCols = [
    { key: 'property_name', header: 'Property' },
    { key: 'room_number', header: 'Room' },
    { key: 'assignee', header: 'Assignee' },
    { key: 'check_in', header: 'Check-in', render: (r: AccommodationAssignment) => fmtDate(r.check_in) },
    { key: 'check_out', header: 'Check-out', render: (r: AccommodationAssignment) => fmtDate(r.check_out) },
    {
      key: 'status', header: 'Status',
      render: (r: AccommodationAssignment) => (
        <span className="flex items-center gap-1">
          <Badge label={r.status} className={statusColor(r.status)} />
          {r.override_capacity && <Badge label="Override" className="bg-orange-100 text-orange-700" />}
        </span>
      ),
    },
    { key: 'coverage_notes', header: 'Notes', render: (r: AccommodationAssignment) => r.coverage_notes || '—' },
  ]

  const reqCols = [
    { key: 'party_name', header: 'Party' },
    { key: 'request_note', header: 'Request' },
    { key: 'created_at', header: 'Submitted', render: (r: ChangeRequest) => fmtDate(r.created_at) },
    {
      key: 'status', header: 'Status',
      render: (r: ChangeRequest) => <Badge label={r.status} className={statusColor(r.status)} />,
    },
    {
      key: 'actions', header: '',
      render: (r: ChangeRequest) => r.status === 'OPEN' ? (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => handleResolve(r, 'resolve')}>Resolve</Button>
          <Button size="sm" variant="danger" onClick={() => handleResolve(r, 'decline')}>Decline</Button>
        </div>
      ) : null,
    },
  ]

  const tabs: { key: Tab; label: string }[] = [
    { key: 'properties', label: 'Properties' },
    { key: 'rooms', label: 'Rooms' },
    { key: 'assignments', label: 'Assignments' },
    { key: 'requests', label: `Requests${(requests ?? []).filter(r => r.status === 'OPEN').length ? ` (${(requests ?? []).filter(r => r.status === 'OPEN').length})` : ''}` },
  ]

  return (
    <div>
      <PageHeader title="Accommodations">
        {tab === 'properties' && <Button size="sm" onClick={() => { setPropForm(emptyProp); setShowCreateProperty(true) }}><span>+</span> Add Property</Button>}
        {tab === 'rooms' && <Button size="sm" onClick={() => { setRoomForm(emptyRoom); setShowCreateRoom(true) }}><span>+</span> Add Room</Button>}
        {tab === 'assignments' && <Button size="sm" onClick={() => { setAssignForm(emptyAssignment); setShowCreateAssignment(true) }}><span>+</span> Assign Room</Button>}
      </PageHeader>

      <div className="flex gap-2 mb-4">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === t.key ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'properties' && <Table columns={propCols} rows={properties ?? []} />}
      {tab === 'rooms' && <Table columns={roomCols} rows={rooms ?? []} />}
      {tab === 'assignments' && <Table columns={assignCols} rows={assignments ?? []} />}
      {tab === 'requests' && (
        reqLoading ? <LoadingSpinner /> : <Table columns={reqCols} rows={requests ?? []} />
      )}

      {/* Property Modal */}
      <Modal open={showCreateProperty || (editItem?.resource === 'properties')} onClose={() => { setShowCreateProperty(false); setEditItem(null) }} title={editItem?.resource === 'properties' ? 'Edit Property' : 'Add Property'}>
        <form onSubmit={submitProperty} className="space-y-3">
          <Field label="Property Name" required><Input required value={propForm.name} onChange={e => setPropForm(f => ({ ...f, name: e.target.value }))} /></Field>
          <Field label="Address"><Input value={propForm.address} onChange={e => setPropForm(f => ({ ...f, address: e.target.value }))} /></Field>
          <Field label="Contact Information"><Input value={propForm.contact_information} onChange={e => setPropForm(f => ({ ...f, contact_information: e.target.value }))} /></Field>
          <Field label="Notes"><TextArea value={propForm.notes} onChange={e => setPropForm(f => ({ ...f, notes: e.target.value }))} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowCreateProperty(false); setEditItem(null) }}>Cancel</Button>
            <Button type="submit" disabled={createProperty.isPending || updateResource.isPending}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Room Modal */}
      <Modal open={showCreateRoom || (editItem?.resource === 'rooms')} onClose={() => { setShowCreateRoom(false); setEditItem(null) }} title={editItem?.resource === 'rooms' ? 'Edit Room' : 'Add Room'}>
        <form onSubmit={submitRoom} className="space-y-3">
          <Field label="Property" required>
            <Select value={roomForm.property_id} onChange={v => setRoomForm(f => ({ ...f, property_id: v }))} options={propertyOptions} placeholder="Select property…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Room Number" required><Input required value={roomForm.room_number} onChange={e => setRoomForm(f => ({ ...f, room_number: e.target.value }))} /></Field>
            <Field label="Capacity" required><Input required type="number" min="1" value={roomForm.capacity} onChange={e => setRoomForm(f => ({ ...f, capacity: e.target.value }))} /></Field>
          </div>
          <Field label="Room Type"><Input value={roomForm.room_type} onChange={e => setRoomForm(f => ({ ...f, room_type: e.target.value }))} placeholder="e.g. Double, Suite" /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setShowCreateRoom(false); setEditItem(null) }}>Cancel</Button>
            <Button type="submit" disabled={createRoom.isPending || updateResource.isPending}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Assignment Modal */}
      <Modal open={showCreateAssignment} onClose={() => setShowCreateAssignment(false)} title="Assign Room" size="lg">
        <form onSubmit={submitAssignment} className="space-y-3">
          <Field label="Room" required>
            <Select value={assignForm.room_id} onChange={v => setAssignForm(f => ({ ...f, room_id: v }))} options={roomOptions} placeholder="Select room…" />
          </Field>
          <Field label="Party (assign to whole party)">
            <Select value={assignForm.party_id} onChange={v => setAssignForm(f => ({ ...f, party_id: v }))} options={partyOptions} placeholder="Select party…" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Check-in" required><Input required type="date" value={assignForm.check_in} onChange={e => setAssignForm(f => ({ ...f, check_in: e.target.value }))} /></Field>
            <Field label="Check-out" required><Input required type="date" value={assignForm.check_out} onChange={e => setAssignForm(f => ({ ...f, check_out: e.target.value }))} /></Field>
          </div>
          <Field label="Status">
            <Select value={assignForm.status} onChange={v => setAssignForm(f => ({ ...f, status: v }))} options={[{ value: 'CONFIRMED', label: 'Confirmed' }, { value: 'PENDING', label: 'Pending' }, { value: 'CANCELLED', label: 'Cancelled' }]} />
          </Field>
          <Field label="Coverage Notes"><TextArea value={assignForm.coverage_notes} onChange={e => setAssignForm(f => ({ ...f, coverage_notes: e.target.value }))} placeholder="e.g. Flights covered, room only" /></Field>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="override"
              checked={assignForm.override_capacity === 'true'}
              onChange={e => setAssignForm(f => ({ ...f, override_capacity: String(e.target.checked) }))}
              className="rounded border-gray-300"
            />
            <label htmlFor="override" className="text-sm text-yellow-700 font-medium">Override capacity limit (audited)</label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreateAssignment(false)}>Cancel</Button>
            <Button type="submit" disabled={createAssignment.isPending}>Assign</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
