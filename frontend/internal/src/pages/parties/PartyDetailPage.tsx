import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, QrCode, Truck, Printer, Archive } from 'lucide-react'
import {
  useParty, useCreateGuest, useUpdateResource, useArchiveResource,
  useIssueQr, useRecordDelivery,
} from '../../api/hooks'
import {
  Button, Modal, Field, Input, TextArea, Table, LoadingSpinner,
  ErrorMessage, PageHeader, Section, useToast, Badge,
} from '../../components'
import { api, ApiRequestError } from '../../api/client'
import { fmtDateTime, statusColor } from '../../lib/format'
import type { Guest } from '../../api/types'

export function PartyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, isLoading, error } = useParty(id!)

  const updateResource = useUpdateResource()
  const archiveResource = useArchiveResource()
  const createGuest = useCreateGuest()
  const issueQr = useIssueQr()
  const recordDelivery = useRecordDelivery()

  const [editParty, setEditParty] = useState(false)
  const [editGuest, setEditGuest] = useState<Guest | null>(null)
  const [showAddGuest, setShowAddGuest] = useState(false)
  const [showQr, setShowQr] = useState<{ qrToken: string; expiresAt: string } | null>(null)
  const [showDelivery, setShowDelivery] = useState(false)

  const [partyForm, setPartyForm] = useState({ display_name: '', contact_email: '', contact_phone: '', verification_question: '' })
  const [guestForm, setGuestForm] = useState<Record<string, string>>({})
  const [deliveryForm, setDeliveryForm] = useState({ kind: 'DELIVERY', note: '' })

  const party = data?.party
  const guests = data?.guests ?? []

  if (isLoading) return <LoadingSpinner />
  if (error || !party) return <ErrorMessage message={(error as Error)?.message ?? 'Party not found'} />

  const openEditParty = () => {
    setPartyForm({
      display_name: party.display_name,
      contact_email: party.contact_email ?? '',
      contact_phone: party.contact_phone ?? '',
      verification_question: party.verification_question ?? '',
    })
    setEditParty(true)
  }

  const saveParty = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateResource.mutateAsync({ resource: 'parties', id: id!, body: partyForm })
      toast.success('Party updated.')
      setEditParty(false)
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Update failed.')
    }
  }

  const openEditGuest = (g: Guest) => {
    setGuestForm({
      first_name: g.first_name, last_name: g.last_name,
      relationship_group: g.relationship_group ?? '',
      email: g.email ?? '', phone: g.phone ?? '',
      dietary_requirements: g.dietary_requirements ?? '',
      accessibility_needs: g.accessibility_needs ?? '',
      travel_origin: g.travel_origin ?? '',
      flight_number: g.flight_number ?? '',
      planner_notes: g.planner_notes ?? '',
    })
    setEditGuest(g)
  }

  const saveGuest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editGuest) return
    try {
      await updateResource.mutateAsync({ resource: 'guests', id: editGuest.id, body: guestForm })
      toast.success('Guest updated.')
      setEditGuest(null)
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Update failed.')
    }
  }

  const handleAddGuest = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createGuest.mutateAsync({ partyId: id!, body: {
        firstName: guestForm.first_name,
        lastName: guestForm.last_name,
        relationshipGroup: guestForm.relationship_group,
        email: guestForm.email,
        phone: guestForm.phone,
        dietaryRequirements: guestForm.dietary_requirements,
        accessibilityNeeds: guestForm.accessibility_needs,
        travelOrigin: guestForm.travel_origin,
        flightNumber: guestForm.flight_number,
        plannerNotes: guestForm.planner_notes,
        additionalGuest: guestForm.is_additional_guest === 'true',
      } })
      toast.success('Guest added.')
      setShowAddGuest(false)
      setGuestForm({})
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed to add guest.')
    }
  }

  const handleArchiveGuest = async (g: Guest) => {
    if (!confirm(`Archive ${g.first_name} ${g.last_name}?`)) return
    try {
      await archiveResource.mutateAsync({ resource: 'guests', id: g.id })
      toast.success('Guest archived.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Archive failed.')
    }
  }

  const handleIssueQr = async () => {
    try {
      const result = await issueQr.mutateAsync(id!)
      setShowQr(result)
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed to issue QR.')
    }
  }

  const downloadCard = async () => {
    try {
      const filename = `invitation-${party.display_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}.pdf`
      await api.downloadBlob(`/api/v1/internal/parties/${id}/invitation-card.pdf`, filename)
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed to download invitation card.')
    }
  }

  const handleDelivery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!party.invitation_id) return
    try {
      await recordDelivery.mutateAsync({ invitationId: party.invitation_id, body: deliveryForm })
      toast.success('Delivery recorded.')
      setShowDelivery(false)
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed to record delivery.')
    }
  }

  const guestColumns = [
    { key: 'name', header: 'Name', render: (g: Guest) => `${g.first_name} ${g.last_name}` },
    { key: 'email', header: 'Email', render: (g: Guest) => g.email || '—' },
    { key: 'dietary_requirements', header: 'Dietary', render: (g: Guest) => g.dietary_requirements || '—' },
    { key: 'is_additional_guest', header: 'Type', render: (g: Guest) => g.is_additional_guest ? <Badge label="Additional" className="bg-yellow-100 text-yellow-700" /> : <Badge label="Primary" className="bg-blue-100 text-blue-700" /> },
    {
      key: 'actions', header: '',
      render: (g: Guest) => (
        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => openEditGuest(g)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => handleArchiveGuest(g)}><Archive size={14} /></Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <button onClick={() => navigate('/parties')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft size={14} /> Back to Parties
      </button>

      <PageHeader title={party.display_name}>
        <Button variant="secondary" size="sm" onClick={openEditParty}>Edit Party</Button>
        <Button variant="secondary" size="sm" onClick={handleIssueQr} disabled={issueQr.isPending}>
          <QrCode size={14} /> {party.invitation_id ? 'Re-issue QR' : 'Issue QR'}
        </Button>
        {party.invitation_id && (
          <Button variant="secondary" size="sm" onClick={() => setShowDelivery(true)}>
            <Truck size={14} /> Record Delivery
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={downloadCard}>
          <Printer size={14} /> Download Card
        </Button>
      </PageHeader>

      {/* Invitation status */}
      {party.invitation_status && (
        <div className="mb-6 flex gap-4 text-sm text-gray-600">
          <span>Invitation: <Badge label={party.invitation_status} className={statusColor(party.invitation_status)} /></span>
          {party.sent_at && <span>Sent: {fmtDateTime(party.sent_at)}</span>}
          {party.viewed_at && <span>Viewed: {fmtDateTime(party.viewed_at)}</span>}
          {party.token_expires_at && <span>QR expires: {fmtDateTime(party.token_expires_at)}</span>}
        </div>
      )}

      {/* Party info */}
      <Section title="Party Information">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div><dt className="font-medium text-gray-500">Email</dt><dd>{party.contact_email || '—'}</dd></div>
          <div><dt className="font-medium text-gray-500">Phone</dt><dd>{party.contact_phone || '—'}</dd></div>
          <div><dt className="font-medium text-gray-500">Verification Question</dt><dd>{party.verification_question || '—'}</dd></div>
        </dl>
      </Section>

      {/* Guests */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Guests ({guests.length})</h2>
          <Button size="sm" onClick={() => { setGuestForm({}); setShowAddGuest(true) }}>
            <Plus size={14} /> Add Guest
          </Button>
        </div>
        <Table columns={guestColumns} rows={guests} />
      </div>

      {/* Edit Party Modal */}
      <Modal open={editParty} onClose={() => setEditParty(false)} title="Edit Party">
        <form onSubmit={saveParty} className="space-y-3">
          {(['display_name', 'contact_email', 'contact_phone', 'verification_question'] as const).map(k => (
            <Field key={k} label={k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}>
              <Input value={partyForm[k]} onChange={e => setPartyForm(f => ({ ...f, [k]: e.target.value }))} />
            </Field>
          ))}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditParty(false)}>Cancel</Button>
            <Button type="submit" disabled={updateResource.isPending}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Add / Edit Guest Modal */}
      {(showAddGuest || editGuest) && (
        <Modal
          open={true}
          onClose={() => { setShowAddGuest(false); setEditGuest(null) }}
          title={editGuest ? `Edit ${editGuest.first_name}` : 'Add Guest'}
          size="lg"
        >
          <form onSubmit={editGuest ? saveGuest : handleAddGuest} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name" required>
                <Input required value={guestForm.first_name ?? ''} onChange={e => setGuestForm(f => ({ ...f, first_name: e.target.value }))} />
              </Field>
              <Field label="Last Name" required>
                <Input required value={guestForm.last_name ?? ''} onChange={e => setGuestForm(f => ({ ...f, last_name: e.target.value }))} />
              </Field>
            </div>
            <Field label="Relationship / Group">
              <Input value={guestForm.relationship_group ?? ''} onChange={e => setGuestForm(f => ({ ...f, relationship_group: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <Input type="email" value={guestForm.email ?? ''} onChange={e => setGuestForm(f => ({ ...f, email: e.target.value }))} />
              </Field>
              <Field label="Phone">
                <Input value={guestForm.phone ?? ''} onChange={e => setGuestForm(f => ({ ...f, phone: e.target.value }))} />
              </Field>
            </div>
            <Field label="Dietary Requirements">
              <Input value={guestForm.dietary_requirements ?? ''} onChange={e => setGuestForm(f => ({ ...f, dietary_requirements: e.target.value }))} />
            </Field>
            <Field label="Accessibility Needs">
              <Input value={guestForm.accessibility_needs ?? ''} onChange={e => setGuestForm(f => ({ ...f, accessibility_needs: e.target.value }))} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Travel Origin">
                <Input value={guestForm.travel_origin ?? ''} onChange={e => setGuestForm(f => ({ ...f, travel_origin: e.target.value }))} />
              </Field>
              <Field label="Flight Number">
                <Input value={guestForm.flight_number ?? ''} onChange={e => setGuestForm(f => ({ ...f, flight_number: e.target.value }))} />
              </Field>
            </div>
            <Field label="Planner Notes">
              <TextArea value={guestForm.planner_notes ?? ''} onChange={e => setGuestForm(f => ({ ...f, planner_notes: e.target.value }))} />
            </Field>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="additional"
                checked={guestForm.is_additional_guest === 'true'}
                onChange={e => setGuestForm(f => ({ ...f, is_additional_guest: String(e.target.checked) }))}
                className="rounded border-gray-300"
              />
              <label htmlFor="additional" className="text-sm text-gray-700">Additional guest (plus-one)</label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => { setShowAddGuest(false); setEditGuest(null) }}>Cancel</Button>
              <Button type="submit" disabled={updateResource.isPending || createGuest.isPending}>Save</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* QR Token Modal */}
      <Modal open={!!showQr} onClose={() => setShowQr(null)} title="QR Invitation Token">
        {showQr && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Share this token with the guest's party to authenticate their access. Treat it as a password.</p>
            <div className="font-mono text-sm bg-gray-100 rounded p-3 break-all select-all">{showQr.qrToken}</div>
            {showQr.expiresAt && <p className="text-xs text-gray-500">Expires: {fmtDateTime(showQr.expiresAt)}</p>}
            <p className="text-xs text-amber-600">This token will not be shown again. Save it now.</p>
            <div className="flex justify-end">
              <Button onClick={() => setShowQr(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Delivery Modal */}
      <Modal open={showDelivery} onClose={() => setShowDelivery(false)} title="Record Delivery / Reminder">
        <form onSubmit={handleDelivery} className="space-y-3">
          <Field label="Type">
            <select
              value={deliveryForm.kind}
              onChange={e => setDeliveryForm(f => ({ ...f, kind: e.target.value }))}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="DELIVERY">Invitation Delivery</option>
              <option value="REMINDER">Reminder</option>
            </select>
          </Field>
          <Field label="Note (optional)">
            <TextArea value={deliveryForm.note} onChange={e => setDeliveryForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Delivered in person on Aug 10" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowDelivery(false)}>Cancel</Button>
            <Button type="submit" disabled={recordDelivery.isPending}>Record</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
