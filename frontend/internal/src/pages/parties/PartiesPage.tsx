import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Upload, QrCode, Pencil } from 'lucide-react'
import { useParties, useCreateParty, useImportGuests, useBulkPartyAction } from '../../api/hooks'
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
  const bulkAction = useBulkPartyAction()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkModal, setBulkModal] = useState<'issueQr' | 'verification' | null>(null)
  const [verification, setVerification] = useState({ question: '', answer: '' })
  const [bulkResult, setBulkResult] = useState<{
    summary: string; failed: { id: string; name: string; message: string }[]
  } | null>(null)
  const selectedParties = (parties ?? []).filter(p => selectedIds.has(p.id))
  const allSelected = !!parties?.length && selectedParties.length === parties.length
  const partialSelected = selectedParties.length > 0 && !allSelected

  const closeBulkModal = () => {
    if (bulkAction.isPending) return
    setBulkModal(null)
    setVerification({ question: '', answer: '' })
    bulkAction.reset()
  }

  const handleBulkAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bulkModal || !selectedParties.length || bulkAction.isPending) return
    const kind = bulkModal
    const targets = [...selectedParties]
    if (kind === 'verification' && (!verification.question.trim() || !verification.answer.trim())) {
      toast.error('Enter a verification question and answer for all selected parties.')
      return
    }
    if (kind === 'verification' && new TextEncoder().encode(verification.answer.trim().toLowerCase()).length > 72) {
      toast.error('Verification answer must be at most 72 bytes.')
      return
    }
    setBulkResult(null)
    const result = await bulkAction.mutateAsync(kind === 'issueQr'
      ? { kind, partyIds: targets.map(p => p.id) }
      : { kind, partyIds: targets.map(p => p.id), question: verification.question.trim(), answer: verification.answer })
    const summary = kind === 'issueQr'
      ? `QR codes issued for ${result.succeeded.length} of ${targets.length} parties.`
      : `Verification question and answer updated for ${result.succeeded.length} of ${targets.length} parties.`
    setBulkResult({ summary, failed: result.failed.map(f => ({ ...f, name: targets.find(p => p.id === f.id)!.display_name })) })
    // Retrying a partial batch must not repeat successful QR issuance.
    setSelectedIds(new Set(result.failed.map(f => f.id)))
    setBulkModal(null)
    setVerification({ question: '', answer: '' })
    bulkAction.reset()
    if (result.failed.length) toast.error(`${summary} ${result.failed.length} failed; see details below.`)
    else toast.success(summary)
  }

  // Create party form state
  const [form, setForm] = useState({
    displayName: '',
    verificationQuestion: '', verificationAnswer: '',
  })

  const [importResult, setImportResult] = useState<{ partiesCreated: number; guestsCreated: number } | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createParty.mutateAsync({
        displayName: form.displayName,
        verificationQuestion: form.verificationQuestion,
        verificationAnswer: form.verificationAnswer,
      })
      toast.success('Party created.')
      setShowCreate(false)
      setForm({ displayName: '', verificationQuestion: '', verificationAnswer: '' })
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
    {
      key: 'select',
      header: <input
        type="checkbox" aria-label="Select all displayed parties"
        checked={allSelected} ref={node => { if (node) node.indeterminate = partialSelected }}
        disabled={!parties?.length || bulkAction.isPending}
        onChange={e => setSelectedIds(e.target.checked ? new Set(parties?.map(p => p.id)) : new Set())}
        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />,
      render: (r: Party) => <input
        type="checkbox" aria-label={`Select ${r.display_name}`}
        checked={selectedIds.has(r.id)} disabled={bulkAction.isPending}
        onClick={e => e.stopPropagation()}
        onChange={e => {
          const checked = e.target.checked
          setSelectedIds(ids => {
            const next = new Set(ids)
            if (checked) next.add(r.id)
            else next.delete(r.id)
            return next
          })
        }}
        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />,
    },
    { key: 'display_name', header: 'Party Name' },
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
        <Button variant="secondary" size="sm" disabled={bulkAction.isPending} onClick={() => setShowImport(true)}>
          <Upload size={14} /> Bulk Import
        </Button>
        <Button size="sm" disabled={bulkAction.isPending} onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Add Party
        </Button>
      </PageHeader>

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search parties…"
          value={q}
          disabled={bulkAction.isPending}
          onChange={e => { setQ(e.target.value); setSelectedIds(new Set()); setBulkResult(null) }}
          className="block w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <span className="text-sm text-gray-700" role="status">{selectedParties.length} selected</span>
        <Button size="sm" variant="secondary" disabled={!selectedParties.length || bulkAction.isPending} onClick={() => setBulkModal('issueQr')}>
          <QrCode size={14} /> Issue QR
        </Button>
        <Button size="sm" variant="secondary" disabled={!selectedParties.length || bulkAction.isPending} onClick={() => setBulkModal('verification')}>
          <Pencil size={14} /> Edit Verification
        </Button>
        {!!selectedParties.length && <Button size="sm" variant="ghost" disabled={bulkAction.isPending} onClick={() => setSelectedIds(new Set())}>Clear selection</Button>}
      </div>

      {bulkResult && (
        <div role="status" className={`mb-4 rounded-md border p-4 text-sm ${bulkResult.failed.length ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-green-200 bg-green-50 text-green-800'}`}>
          <p>{bulkResult.summary}</p>
          {!!bulkResult.failed.length && <>
            <p className="mt-2">Failed parties remain selected. Check their current values before retrying.</p>
            <ul className="mt-2 list-disc pl-5">{bulkResult.failed.map(f => <li key={f.id}>{f.name}: {f.message}</li>)}</ul>
          </>}
          <Link to="/invitations" className="mt-2 inline-block font-medium underline">View and print invitation cards</Link>
        </div>
      )}

      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage message={(error as Error).message} />}
      {parties && (
        <Table
          columns={columns}
          rows={parties}
          onRowClick={bulkAction.isPending ? undefined : r => navigate(`/parties/${r.id}`)}
        />
      )}

      <Modal open={!!bulkModal} onClose={closeBulkModal} title={bulkModal === 'issueQr' ? 'Issue QR for Selected Parties' : 'Edit Verification for Selected Parties'}>
        <form onSubmit={handleBulkAction} className="space-y-4">
          <p className="text-sm text-gray-600">Apply to all {selectedParties.length} selected parties:</p>
          <ul className="max-h-32 list-disc overflow-y-auto pl-5 text-sm text-gray-700">
            {selectedParties.map(p => <li key={p.id}>{p.display_name}</li>)}
          </ul>
          {bulkModal === 'issueQr' ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Each party will receive its own new QR code. Existing QR codes will be replaced and invitation status will reset to Draft. Reprint any previously printed cards for these parties.
            </p>
          ) : <>
            <p className="text-sm text-gray-600">The same question and answer will replace the current values for every selected party. Existing guest sessions and login locks stay in place.</p>
            <Field label="Verification Question" required>
              <Input aria-label="Verification Question" required disabled={bulkAction.isPending} value={verification.question} onChange={e => setVerification(v => ({ ...v, question: e.target.value }))} />
            </Field>
            <Field label="New Verification Answer" required>
              <Input aria-label="New Verification Answer" type="password" autoComplete="new-password" required disabled={bulkAction.isPending} value={verification.answer} onChange={e => setVerification(v => ({ ...v, answer: e.target.value }))} />
              <p className="mt-1 text-xs text-gray-500">Case-insensitive. The existing answers are never displayed.</p>
            </Field>
          </>}
          {bulkAction.isPending && <p role="status" className="text-sm text-indigo-700">Applying changes to selected parties…</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" disabled={bulkAction.isPending} onClick={closeBulkModal}>Cancel</Button>
            <Button type="submit" disabled={bulkAction.isPending || !selectedParties.length}>
              {bulkAction.isPending ? 'Applying…' : `${bulkModal === 'issueQr' ? 'Issue QR for' : 'Apply to'} ${selectedParties.length} ${selectedParties.length === 1 ? 'party' : 'parties'}`}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Create Party Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Party">
        <form onSubmit={handleCreate} className="space-y-3">
          <Field label="Party Display Name" required>
            <Input required value={form.displayName} onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))} placeholder="e.g. Smith Family" />
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
