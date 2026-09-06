import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, QrCode, Truck, Printer, Archive, Lock, LockOpen } from 'lucide-react'
import {
  useParty, useCreateGuest, useUpdateResource, useArchiveResource,
  useIssueQr, useRecordDelivery, useAllVenueRooms, useUpdateRsvp, useUnlockPartyLogin,
} from '../../api/hooks'
import {
  Button, Modal, Field, Input, TextArea, Select, Table, LoadingSpinner,
  ErrorMessage, PageHeader, Section, useToast, Badge,
} from '../../components'
import { api, ApiRequestError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { fmtDateTime, statusColor } from '../../lib/format'
import type { Guest, Rsvp } from '../../api/types'

const RSVP_STATUS_OPTIONS = [
  { value: 'ATTENDING', label: 'Attending' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'WAITLISTED', label: 'Waitlisted' },
]

const RELATIONSHIP_OPTIONS = [
  { value: 'FAMILY', label: 'Family' }, { value: 'RELATIVE', label: 'Relative' },
  { value: 'FRIEND', label: 'Friend' }, { value: 'OTHER', label: 'Other' },
]
const WEDDING_SIDE_OPTIONS = [{ value: 'BRIDE', label: 'Bride' }, { value: 'GROOM', label: 'Groom' }]
const ATTENDANCE_PROBABILITY_OPTIONS = [
  { value: 'CERTAIN', label: 'Certain' }, { value: 'VERY_LIKELY', label: 'Very Likely' },
  { value: 'LIKELY', label: 'Likely' }, { value: 'MAYBE', label: 'Maybe' }, { value: 'UNLIKELY', label: 'Unlikely' },
  { value: 'NA', label: 'N/A' },
]
const PASSPORT_OPTIONS = [{ value: 'NEPALI', label: 'Nepali' }, { value: 'INDIAN', label: 'Indian' }, { value: 'OTHER', label: 'Other' }]

export function PartyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { data, isLoading, error } = useParty(id!)
  const { data: rooms } = useAllVenueRooms()

  const updateResource = useUpdateResource()
  const archiveResource = useArchiveResource()
  const createGuest = useCreateGuest()
  const issueQr = useIssueQr()
  const recordDelivery = useRecordDelivery()
  const updateRsvp = useUpdateRsvp()
  const unlockLogin = useUnlockPartyLogin()
  const { role } = useAuth()

  const [editParty, setEditParty] = useState(false)
  const [editGuest, setEditGuest] = useState<Guest | null>(null)
  const [showAddGuest, setShowAddGuest] = useState(false)
  const [showQr, setShowQr] = useState<{ qrToken: string; expiresAt: string } | null>(null)
  const [showDelivery, setShowDelivery] = useState(false)
  const [editRsvp, setEditRsvp] = useState<{ rsvp: Rsvp; guestName: string; eventName: string } | null>(null)
  const [rsvpForm, setRsvpForm] = useState({ status: '', note: '' })

  const [partyForm, setPartyForm] = useState({ display_name: '', contact_email: '', contact_phone: '', verification_question: '' })
  const [guestForm, setGuestForm] = useState<Record<string, string>>({})
  const [deliveryForm, setDeliveryForm] = useState({ kind: 'DELIVERY', note: '' })

  const party = data?.party
  const guests = data?.guests ?? []
  const events = data?.events ?? []
  const rsvps = data?.rsvps ?? []

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
      is_additional_guest: g.is_additional_guest ? 'true' : 'false',
      wedding_side: g.wedding_side ?? '',
      attendance_probability: g.attendance_probability ?? '',
      is_wedding_party: g.is_wedding_party ? 'true' : 'false',
      passport: g.passport ?? '',
      is_ktm_resident: g.is_ktm_resident ? 'true' : 'false',
      is_child: g.is_child ? 'true' : 'false',
      room_assignment_id: g.room_assignment_id ?? '',
      invite_round: g.invite_round?.toString() ?? '',
    })
    setEditGuest(g)
  }

  const saveGuest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editGuest) return
    const body: Record<string, unknown> = {
      ...guestForm,
      is_additional_guest: guestForm.is_additional_guest === 'true',
      is_wedding_party: guestForm.is_wedding_party === 'true',
      is_ktm_resident: guestForm.is_ktm_resident === 'true',
      is_child: guestForm.is_child === 'true',
    }
    if (!body.room_assignment_id) delete body.room_assignment_id
    if (!body.invite_round) delete body.invite_round; else body.invite_round = Number(body.invite_round)
    try {
      await updateResource.mutateAsync({ resource: 'guests', id: editGuest.id, body })
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
        weddingSide: guestForm.wedding_side || null,
        attendanceProbability: guestForm.attendance_probability || null,
        weddingParty: guestForm.is_wedding_party === 'true',
        passport: guestForm.passport || null,
        ktmResident: guestForm.is_ktm_resident === 'true',
        child: guestForm.is_child === 'true',
        roomAssignmentId: guestForm.room_assignment_id || null,
        inviteRound: guestForm.invite_round ? Number(guestForm.invite_round) : null,
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

  const handleArchiveParty = async () => {
    if (!confirm(`Archive party "${party.display_name}"? This does not archive its guests.`)) return
    try {
      await archiveResource.mutateAsync({ resource: 'parties', id: id! })
      toast.success('Party archived.')
      navigate('/parties')
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

  const openEditRsvp = (rsvp: Rsvp, guestName: string, eventName: string) => {
    setRsvpForm({ status: rsvp.status, note: rsvp.note ?? '' })
    setEditRsvp({ rsvp, guestName, eventName })
  }

  const saveRsvp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editRsvp) return
    try {
      await updateRsvp.mutateAsync({ id: editRsvp.rsvp.id, body: { status: rsvpForm.status, note: rsvpForm.note || undefined } })
      toast.success('RSVP updated.')
      setEditRsvp(null)
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Update failed.')
    }
  }

  const rsvpCounts = {
    ATTENDING: rsvps.filter(r => r.status === 'ATTENDING').length,
    DECLINED: rsvps.filter(r => r.status === 'DECLINED').length,
    PENDING: rsvps.filter(r => r.status === 'PENDING').length,
    WAITLISTED: rsvps.filter(r => r.status === 'WAITLISTED').length,
  }

  const guestColumns = [
    { key: 'name', header: 'Name', render: (g: Guest) => `${g.first_name} ${g.last_name}` },
    { key: 'email', header: 'Email', render: (g: Guest) => g.email || '—' },
    { key: 'dietary_requirements', header: 'Dietary', render: (g: Guest) => g.dietary_requirements || '—' },
    { key: 'is_additional_guest', header: 'Type', render: (g: Guest) => g.is_additional_guest ? <Badge label="Additional" className="bg-yellow-100 text-yellow-700" /> : <Badge label="Primary" className="bg-blue-100 text-blue-700" /> },
    { key: 'wedding_side', header: 'Side', render: (g: Guest) => g.wedding_side ? g.wedding_side[0] + g.wedding_side.slice(1).toLowerCase() : '—' },
    { key: 'attendance_probability', header: 'Probability', render: (g: Guest) => g.attendance_probability ? <Badge label={g.attendance_probability.replace('_', ' ')} className={statusColor(g.attendance_probability)} /> : '—' },
    { key: 'invite_round', header: 'Round', render: (g: Guest) => g.invite_round ?? '—' },
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
        {party.archived && <Badge label="Archived" className="bg-gray-100 text-gray-600" />}
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
        {!party.archived && (
          <Button variant="danger" size="sm" onClick={handleArchiveParty} disabled={archiveResource.isPending}>
            <Archive size={14} /> Archive Party
          </Button>
        )}
      </PageHeader>

      {/* Guest-login lock. Surfaced here because a locked-out party's only route back in is a
          planner noticing -- there's no self-service reset on the guest site. */}
      {(party.login_locked_permanently || party.login_locked_until) && (
        <div className="mb-6 flex items-center gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <Lock size={16} className="shrink-0" />
          <span className="flex-1">
            {party.login_locked_permanently
              ? `Guest login is permanently locked after ${party.login_failed_count ?? 0} incorrect verification answers. Only an admin can unlock it.`
              : `Guest login is temporarily locked until ${fmtDateTime(party.login_locked_until!)} (${party.login_failed_count ?? 0} incorrect answers).`}
          </span>
          {role === 'ADMIN' && (
            <Button
              variant="secondary"
              size="sm"
              disabled={unlockLogin.isPending}
              onClick={async () => {
                try {
                  await unlockLogin.mutateAsync(id!)
                  toast.success('Guest login unlocked.')
                } catch (err) {
                  toast.error(err instanceof ApiRequestError ? err.message : 'Failed to unlock.')
                }
              }}
            >
              <LockOpen size={14} /> Unlock
            </Button>
          )}
        </div>
      )}

      {/* Invitation status */}
      {party.invitation_status && (
        <div className="mb-6 flex gap-4 text-sm text-gray-600">
          <span>Invitation: <Badge label={party.invitation_status} className={statusColor(party.invitation_status)} /></span>
          {party.token && <span>Token: <code className="font-mono">{party.token}</code></span>}
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

      {/* Invitations & RSVPs */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">RSVPs</h2>
          <div className="flex gap-3 text-sm">
            {Object.entries(rsvpCounts).map(([status, count]) => (
              <div key={status} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${statusColor(status)}`}>
                <span className="font-semibold">{count}</span> {status.charAt(0) + status.slice(1).toLowerCase()}
              </div>
            ))}
          </div>
        </div>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500">No events have been created yet.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Guest</th>
                  {events.map(ev => (
                    <th key={ev.id} className="text-left px-3 py-2 font-medium text-gray-500 whitespace-nowrap">
                      {ev.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guests.map(g => (
                  <tr key={g.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 whitespace-nowrap">{g.first_name} {g.last_name}</td>
                    {events.map(ev => {
                      const rsvp = rsvps.find(r => r.guest_id === g.id && r.event_id === ev.id)
                      return (
                        <td key={ev.id} className="px-3 py-2">
                          {rsvp ? (
                            <button onClick={() => openEditRsvp(rsvp, `${g.first_name} ${g.last_name}`, ev.name)}>
                              <Badge label={rsvp.status} className={statusColor(rsvp.status)} />
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
            <div className="grid grid-cols-2 gap-3">
              <Field label="Relationship / Group">
                <Select value={guestForm.relationship_group ?? ''} onChange={v => setGuestForm(f => ({ ...f, relationship_group: v }))} options={RELATIONSHIP_OPTIONS} placeholder="Select…" />
              </Field>
              <Field label="Wedding Side">
                <Select value={guestForm.wedding_side ?? ''} onChange={v => setGuestForm(f => ({ ...f, wedding_side: v }))} options={WEDDING_SIDE_OPTIONS} placeholder="Select…" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Email">
                <Input type="email" value={guestForm.email ?? ''} onChange={e => setGuestForm(f => ({ ...f, email: e.target.value }))} />
              </Field>
              <Field label="Phone">
                <Input value={guestForm.phone ?? ''} onChange={e => setGuestForm(f => ({ ...f, phone: e.target.value }))} />
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Attendance Probability">
                <Select value={guestForm.attendance_probability ?? ''} onChange={v => setGuestForm(f => ({ ...f, attendance_probability: v }))} options={ATTENDANCE_PROBABILITY_OPTIONS} placeholder="Select…" />
              </Field>
              <Field label="Passport">
                <Select value={guestForm.passport ?? ''} onChange={v => setGuestForm(f => ({ ...f, passport: v }))} options={PASSPORT_OPTIONS} placeholder="Select…" />
              </Field>
              <Field label="Invite Round">
                <Input type="number" min="1" value={guestForm.invite_round ?? ''} onChange={e => setGuestForm(f => ({ ...f, invite_round: e.target.value }))} />
              </Field>
            </div>
            <Field label="Room Assignment">
              <Select
                value={guestForm.room_assignment_id ?? ''}
                onChange={v => setGuestForm(f => ({ ...f, room_assignment_id: v }))}
                options={(rooms ?? []).map(r => ({ value: r.id, label: `${r.venue_name} — ${r.room_type}${r.room_number ? ` #${r.room_number}` : ''}` }))}
                placeholder="Unassigned"
              />
            </Field>
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
            <div className="grid grid-cols-2 gap-2">
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
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="weddingParty"
                  checked={guestForm.is_wedding_party === 'true'}
                  onChange={e => setGuestForm(f => ({ ...f, is_wedding_party: String(e.target.checked) }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="weddingParty" className="text-sm text-gray-700">Wedding party</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ktmResident"
                  checked={guestForm.is_ktm_resident === 'true'}
                  onChange={e => setGuestForm(f => ({ ...f, is_ktm_resident: String(e.target.checked) }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="ktmResident" className="text-sm text-gray-700">KTM resident</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isChild"
                  checked={guestForm.is_child === 'true'}
                  onChange={e => setGuestForm(f => ({ ...f, is_child: String(e.target.checked) }))}
                  className="rounded border-gray-300"
                />
                <label htmlFor="isChild" className="text-sm text-gray-700">Child</label>
              </div>
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
            <p className="text-xs text-gray-500">You can view this token again anytime on this page.</p>
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

      {/* Edit RSVP Modal */}
      <Modal open={!!editRsvp} onClose={() => setEditRsvp(null)} title={editRsvp ? `Edit RSVP — ${editRsvp.guestName}` : ''}>
        {editRsvp && (
          <form onSubmit={saveRsvp} className="space-y-3">
            <div className="text-sm text-gray-600">
              <strong>Event:</strong> {editRsvp.eventName}
            </div>
            <Field label="Status" required>
              <Select
                value={rsvpForm.status}
                onChange={v => setRsvpForm(f => ({ ...f, status: v }))}
                options={RSVP_STATUS_OPTIONS}
              />
            </Field>
            <Field label="Planner Note (source of manual change)">
              <TextArea value={rsvpForm.note} onChange={e => setRsvpForm(f => ({ ...f, note: e.target.value }))} placeholder="e.g. Confirmed by phone call on Aug 10" />
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
