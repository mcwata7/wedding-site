import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Upload } from 'lucide-react'
import { useParties, useCreateParty, useImportGuests } from '../../api/hooks'
import {
  Button, Modal, Field, Input, Table, LoadingSpinner, ErrorMessage,
  PageHeader, useToast, Badge,
} from '../../components'
import { ApiRequestError } from '../../api/client'
import type { Party } from '../../api/types'

export function PartiesPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const { data: parties, isLoading, error } = useParties(q || undefined)
  const createParty = useCreateParty()
  const importGuests = useImportGuests()

  // Create party form state
  const [form, setForm] = useState({
    displayName: '', contactEmail: '', contactPhone: '',
    verificationQuestion: '', verificationAnswer: '',
  })

  const [importResult, setImportResult] = useState<{ partiesCreated: number; guestsCreated: number } | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createParty.mutateAsync({
        displayName: form.displayName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        verificationQuestion: form.verificationQuestion,
        verificationAnswer: form.verificationAnswer,
      })
      toast.success('Party created.')
      setShowCreate(false)
      setForm({ displayName: '', contactEmail: '', contactPhone: '', verificationQuestion: '', verificationAnswer: '' })
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed to create party.')
    }
  }

  const handleImport = async () => {
    const file = fileRef.current?.files?.[0]
    if (!file) { toast.error('Please select a CSV file.'); return }
    try {
      const result = await importGuests.mutateAsync(file)
      setImportResult(result)
      toast.success(`Imported ${result.guestsCreated} guests in ${result.partiesCreated} parties.`)
      if (fileRef.current) fileRef.current.value = ''
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Import failed.')
    }
  }

  const columns = [
    { key: 'display_name', header: 'Party Name' },
    { key: 'contact_email', header: 'Email', render: (r: Party) => r.contact_email || '—' },
    { key: 'contact_phone', header: 'Phone', render: (r: Party) => r.contact_phone || '—' },
    {
      key: 'archived', header: 'Status',
      render: (r: Party) => r.archived
        ? <Badge label="Archived" className="bg-gray-100 text-gray-600" />
        : <Badge label="Active" className="bg-green-100 text-green-700" />,
    },
  ]

  return (
    <div>
      <PageHeader title="Parties & Guests">
        <Button variant="secondary" size="sm" onClick={() => setShowImport(true)}>
          <Upload size={14} /> Bulk Import
        </Button>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Add Party
        </Button>
      </PageHeader>

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search parties…"
          value={q}
          onChange={e => setQ(e.target.value)}
          className="block w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message={(error as Error).message} />}
      {parties && (
        <Table
          columns={columns}
          rows={parties}
          onRowClick={r => navigate(`/parties/${r.id}`)}
        />
      )}

      {/* Create Party Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Party">
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Party Display Name" required>
            <Input required value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="e.g. Smith Family" />
          </Field>
          <Field label="Contact Email">
            <Input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} />
          </Field>
          <Field label="Contact Phone">
            <Input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} />
          </Field>
          <Field label="Verification Question" required>
            <Input required value={form.verificationQuestion} onChange={e => setForm(f => ({ ...f, verificationQuestion: e.target.value }))} placeholder="e.g. What city did the couple meet?" />
          </Field>
          <Field label="Verification Answer" required>
            <Input required value={form.verificationAnswer} onChange={e => setForm(f => ({ ...f, verificationAnswer: e.target.value }))} placeholder="Case-insensitive" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" disabled={createParty.isPending}>
              {createParty.isPending ? 'Creating…' : 'Create Party'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Import Modal */}
      <Modal open={showImport} onClose={() => { setShowImport(false); setImportResult(null) }} title="Bulk Guest Import">
        {importResult ? (
          <div>
            <div className="rounded-md bg-green-50 border border-green-200 p-4 text-sm text-green-800">
              Successfully imported {importResult.guestsCreated} guests across {importResult.partiesCreated} parties.
            </div>
            <div className="flex justify-end mt-4">
              <Button onClick={() => { setShowImport(false); setImportResult(null) }}>Done</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Upload a CSV file with party and guest data. Download the template from the <strong>Reports</strong> page if you need the format.
            </p>
            <Field label="CSV File">
              <input ref={fileRef} type="file" accept=".csv" className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-50" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowImport(false)}>Cancel</Button>
              <Button onClick={handleImport} disabled={importGuests.isPending}>
                {importGuests.isPending ? 'Importing…' : 'Import'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
