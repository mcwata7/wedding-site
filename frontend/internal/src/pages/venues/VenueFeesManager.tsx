import { useState } from 'react'
import { Plus, Archive } from 'lucide-react'
import { useVenue, useCreateVenueFee, useUpdateResource, useArchiveResource } from '../../api/hooks'
import { Button, Field, Input, TextArea, Select, Table, useToast } from '../../components'
import { ApiRequestError } from '../../api/client'
import { fmtMoney } from '../../lib/format'
import type { VenueFee } from '../../api/types'

const FEE_TYPE_OPTIONS = [
  { value: 'SANGEET_DAY_CATERING', label: 'Sangeet Day Catering' },
  { value: 'WEDDING_LUNCH_CATERING', label: 'Wedding Lunch Catering' },
  { value: 'WEDDING_DINNER_CATERING', label: 'Wedding Dinner Catering' },
  { value: 'CORKAGE', label: 'Corkage' },
]
const feeTypeLabel = (t: string) => FEE_TYPE_OPTIONS.find(o => o.value === t)?.label ?? t

const emptyFeeForm = { fee_type: 'SANGEET_DAY_CATERING', amount: '', notes: '' }

/** Fees CRUD for one venue: heading, table, and a toggleable inline add/edit form -- mirrors
 * VenueRoomsManager's shape (no <Modal>, so it's safe to embed inside a venue modal too). */
export function VenueFeesManager({ venueId }: { venueId: string }) {
  const toast = useToast()
  const { data } = useVenue(venueId)
  const fees = data?.fees ?? []

  const createFee = useCreateVenueFee()
  const updateResource = useUpdateResource()
  const archiveResource = useArchiveResource()

  const [showForm, setShowForm] = useState(false)
  const [editFee, setEditFee] = useState<VenueFee | null>(null)
  const [feeForm, setFeeForm] = useState<Record<string, string>>(emptyFeeForm)

  const openAdd = () => { setFeeForm(emptyFeeForm); setEditFee(null); setShowForm(true) }
  const openEdit = (f: VenueFee) => {
    setFeeForm({ fee_type: f.fee_type, amount: f.amount?.toString() ?? '', notes: f.notes ?? '' })
    setEditFee(f)
    setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditFee(null); setFeeForm(emptyFeeForm) }

  const submitFee = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = { ...feeForm }
    if (!body.amount) delete body.amount; else body.amount = Number(body.amount)
    try {
      if (editFee) {
        await updateResource.mutateAsync({ resource: 'venue-fees', id: editFee.id, body })
        toast.success('Fee updated.')
      } else {
        await createFee.mutateAsync({ ...body, venue_id: venueId })
        toast.success('Fee added.')
      }
      closeForm()
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed.')
    }
  }

  const handleArchiveFee = async (f: VenueFee) => {
    if (!confirm(`Archive fee "${feeTypeLabel(f.fee_type)}"?`)) return
    try {
      await archiveResource.mutateAsync({ resource: 'venue-fees', id: f.id })
      toast.success('Fee archived.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Archive failed.')
    }
  }

  const feeColumns = [
    { key: 'fee_type', header: 'Fee', render: (f: VenueFee) => feeTypeLabel(f.fee_type) },
    { key: 'amount', header: 'Amount', render: (f: VenueFee) => fmtMoney(f.amount) },
    { key: 'notes', header: 'Notes', render: (f: VenueFee) => f.notes || '—' },
    {
      key: 'actions', header: '',
      render: (f: VenueFee) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => openEdit(f)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => handleArchiveFee(f)}><Archive size={14} /></Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Fees ({fees.length})</h3>
        {!showForm && (
          <Button size="sm" onClick={openAdd}>
            <Plus size={14} /> Add Fee
          </Button>
        )}
      </div>
      <Table columns={feeColumns} rows={fees} />

      {showForm && (
        <form onSubmit={submitFee} className="mt-4 space-y-3 bg-gray-50 rounded-md p-4 border border-gray-200">
          <Field label="Fee Type" required>
            <Select value={feeForm.fee_type} onChange={v => setFeeForm(f => ({ ...f, fee_type: v }))} options={FEE_TYPE_OPTIONS} />
          </Field>
          <Field label="Amount (NPR)"><Input type="number" min="0" value={feeForm.amount} onChange={e => setFeeForm(f => ({ ...f, amount: e.target.value }))} /></Field>
          <Field label="Notes"><TextArea value={feeForm.notes} onChange={e => setFeeForm(f => ({ ...f, notes: e.target.value }))} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={closeForm}>Cancel</Button>
            <Button type="submit" disabled={createFee.isPending || updateResource.isPending}>{editFee ? 'Update Fee' : 'Add Fee'}</Button>
          </div>
        </form>
      )}
    </div>
  )
}
