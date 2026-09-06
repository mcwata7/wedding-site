import { useState } from 'react'
import {
  useAllVenueRooms, useAssignments, useChangeRequests,
  useCreateAssignment, useResolveChangeRequest, useParties,
} from '../../api/hooks'
import {
  Button, Modal, Field, Input, TextArea, Select, Table,
  LoadingSpinner, PageHeader, useToast, Badge,
} from '../../components'
import { ApiRequestError } from '../../api/client'
import { fmtDate, statusColor } from '../../lib/format'
import type { AccommodationAssignment, ChangeRequest } from '../../api/types'

type Tab = 'assignments' | 'requests'

export function AccommodationsPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('assignments')

  const { data: rooms } = useAllVenueRooms()
  const { data: assignments } = useAssignments()
  const { data: requests, isLoading: reqLoading } = useChangeRequests()
  const { data: parties } = useParties()

  const createAssignment = useCreateAssignment()
  const resolveRequest = useResolveChangeRequest()

  const [showCreateAssignment, setShowCreateAssignment] = useState(false)

  // Assignment form
  const emptyAssignment = { room_id: '', party_id: '', guest_id: '', check_in: '', check_out: '', status: 'CONFIRMED', coverage_notes: '', override_capacity: 'false' }
  const [assignForm, setAssignForm] = useState(emptyAssignment)

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

  const roomOptions = (rooms ?? []).map(r => ({ value: r.id, label: `${r.venue_name} — ${r.room_type}${r.room_number ? ` #${r.room_number}` : ''}` }))
  const partyOptions = (parties ?? []).map(p => ({ value: p.id, label: p.display_name }))

  const assignCols = [
    { key: 'venue_name', header: 'Venue' },
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
    { key: 'assignments', label: 'Assignments' },
    { key: 'requests', label: `Requests${(requests ?? []).filter(r => r.status === 'OPEN').length ? ` (${(requests ?? []).filter(r => r.status === 'OPEN').length})` : ''}` },
  ]

  return (
    <div>
      <PageHeader title="Accommodations">
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

      {tab === 'assignments' && <Table columns={assignCols} rows={assignments ?? []} />}
      {tab === 'requests' && (
        reqLoading ? <LoadingSpinner /> : <Table columns={reqCols} rows={requests ?? []} />
      )}

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
