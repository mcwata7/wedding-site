import { useState } from 'react'
import { useRsvps, useUpdateRsvp, useEvents } from '../../api/hooks'
import {
  Button, Modal, Field, Select, TextArea, Table,
  LoadingSpinner, ErrorMessage, PageHeader, useToast, Badge,
} from '../../components'
import { ApiRequestError } from '../../api/client'
import { fmtDateTime, statusColor } from '../../lib/format'
import type { Rsvp } from '../../api/types'

const STATUS_OPTIONS = [
  { value: 'ATTENDING', label: 'Attending' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'WAITLISTED', label: 'Waitlisted' },
]

export function RsvpsPage() {
  const toast = useToast()
  const { data: events } = useEvents()
  const [eventId, setEventId] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editRsvp, setEditRsvp] = useState<Rsvp | null>(null)
  const [editForm, setEditForm] = useState({ status: '', note: '' })

  const { data: rsvps, isLoading, error } = useRsvps(eventId || undefined)
  const updateRsvp = useUpdateRsvp()

  const filtered = (rsvps ?? []).filter(r => !statusFilter || r.status === statusFilter)

  const openEdit = (r: Rsvp) => {
    setEditForm({ status: r.status, note: r.note ?? '' })
    setEditRsvp(r)
  }

  const saveRsvp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editRsvp) return
    try {
      await updateRsvp.mutateAsync({ id: editRsvp.id, body: { status: editForm.status, note: editForm.note || undefined } })
      toast.success('RSVP updated.')
      setEditRsvp(null)
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Update failed.')
    }
  }

  const columns = [
    { key: 'party_name', header: 'Party' },
    { key: 'name', header: 'Guest', render: (r: Rsvp) => `${r.first_name} ${r.last_name}` },
    { key: 'event_name', header: 'Event' },
    {
      key: 'status', header: 'Status',
      render: (r: Rsvp) => <Badge label={r.status} className={statusColor(r.status)} />,
    },
    { key: 'note', header: 'Note', render: (r: Rsvp) => r.note || '—' },
    { key: 'source', header: 'Source', render: (r: Rsvp) => r.source || '—' },
    { key: 'updated_at', header: 'Updated', render: (r: Rsvp) => fmtDateTime(r.updated_at) },
    {
      key: 'actions', header: '',
      render: (r: Rsvp) => (
        <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); openEdit(r) }}>Edit</Button>
      ),
    },
  ]

  const counts = {
    ATTENDING: (rsvps ?? []).filter(r => r.status === 'ATTENDING').length,
    DECLINED: (rsvps ?? []).filter(r => r.status === 'DECLINED').length,
    PENDING: (rsvps ?? []).filter(r => r.status === 'PENDING').length,
    WAITLISTED: (rsvps ?? []).filter(r => r.status === 'WAITLISTED').length,
  }

  return (
    <div>
      <PageHeader title="RSVPs" />

      {/* Summary badges */}
      <div className="flex gap-3 mb-4 text-sm">
        {Object.entries(counts).map(([status, count]) => (
          <div key={status} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${statusColor(status)}`}>
            <span className="font-semibold">{count}</span> {status.charAt(0) + status.slice(1).toLowerCase()}
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="w-48">
          <Select
            value={eventId}
            onChange={setEventId}
            options={(events ?? []).map(e => ({ value: e.id, label: e.name }))}
            placeholder="All events"
          />
        </div>
        <div className="w-40">
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_OPTIONS}
            placeholder="All statuses"
          />
        </div>
      </div>

      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message={(error as Error).message} />}
      {rsvps && <Table columns={columns} rows={filtered} emptyMessage="No RSVPs match the selected filters." />}

      {/* Edit RSVP Modal */}
      <Modal open={!!editRsvp} onClose={() => setEditRsvp(null)} title={editRsvp ? `Edit RSVP — ${editRsvp.first_name} ${editRsvp.last_name}` : ''}>
        {editRsvp && (
          <form onSubmit={saveRsvp} className="space-y-3">
            <div className="text-sm text-gray-600">
              <strong>Event:</strong> {editRsvp.event_name} &nbsp;&bull;&nbsp; <strong>Party:</strong> {editRsvp.party_name}
            </div>
            <Field label="Status" required>
              <Select
                value={editForm.status}
                onChange={v => setEditForm(f => ({ ...f, status: v }))}
                options={STATUS_OPTIONS}
              />
            </Field>
            <Field label="Planner Note (source of manual change)">
              <TextArea value={editForm.note} onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Confirmed by phone call on Aug 10" />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setEditRsvp(null)}>Cancel</Button>
              <Button type="submit" disabled={updateRsvp.isPending}>Save</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
