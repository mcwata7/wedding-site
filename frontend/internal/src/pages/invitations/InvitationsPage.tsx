import { useState } from 'react'
import { FileDown, Printer } from 'lucide-react'
import { useInvitationCards, useIssueMissingInvitations } from '../../api/hooks'
import { Button, Modal, Table, LoadingSpinner, PageHeader, Badge, useToast } from '../../components'
import { api, ApiRequestError } from '../../api/client'
import { statusColor, fmtDateTime } from '../../lib/format'
import type { InvitationCardRow } from '../../api/types'
import { CardDesignSection } from './CardDesignSection'

const BASE = '/api/v1/internal'

type Row = InvitationCardRow & { id: string }
type PendingDownload = { kind: 'all' } | { kind: 'party'; partyId: string; filename: string }

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function InvitationsPage() {
  const toast = useToast()
  const { data: cardRows, isLoading } = useInvitationCards()
  const issueMissing = useIssueMissingInvitations()

  const [pendingDownload, setPendingDownload] = useState<PendingDownload | null>(null)
  const [missingCount, setMissingCount] = useState(0)

  const missingCountFromMessage = (message: string) => {
    const n = parseInt(message, 10)
    return Number.isNaN(n) ? 1 : n
  }

  const downloadAll = async () => {
    try {
      await api.downloadBlob(`${BASE}/invitation-cards.pdf`, 'invitation-cards.pdf')
      toast.success('Downloaded invitation-cards.pdf')
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'MISSING_INVITATIONS') {
        setMissingCount(missingCountFromMessage(err.message))
        setPendingDownload({ kind: 'all' })
      } else {
        toast.error(err instanceof ApiRequestError ? err.message : 'Failed to download.')
      }
    }
  }

  const downloadCard = async (row: Row) => {
    const filename = `invitation-${slug(row.display_name)}.pdf`
    try {
      await api.downloadBlob(`${BASE}/parties/${row.party_id}/invitation-card.pdf`, filename)
      toast.success(`Downloaded ${filename}`)
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'MISSING_INVITATION') {
        setMissingCount(1)
        setPendingDownload({ kind: 'party', partyId: row.party_id, filename })
      } else {
        toast.error(err instanceof ApiRequestError ? err.message : 'Failed to download.')
      }
    }
  }

  const confirmIssueAndRetry = async () => {
    const pending = pendingDownload
    setPendingDownload(null)
    try {
      await issueMissing.mutateAsync()
      if (pending?.kind === 'all') await api.downloadBlob(`${BASE}/invitation-cards.pdf`, 'invitation-cards.pdf')
      else if (pending) await api.downloadBlob(`${BASE}/parties/${pending.partyId}/invitation-card.pdf`, pending.filename)
      toast.success('Tokens issued and card downloaded.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed to issue tokens.')
    }
  }

  const rows: Row[] = (cardRows ?? []).map(r => ({ ...r, id: r.party_id }))

  const columns = [
    { key: 'display_name', header: 'Party' },
    {
      key: 'invitation_status', header: 'Invitation',
      render: (r: Row) => r.invitation_status
        ? <Badge label={r.invitation_status} className={statusColor(r.invitation_status)} />
        : <Badge label="Not issued" className="bg-gray-100 text-gray-600" />,
    },
    {
      key: 'printable', header: 'Card',
      render: (r: Row) => r.printable
        ? <Badge label="Ready" className="bg-green-100 text-green-700" />
        : <Badge label="Needs token" className="bg-yellow-100 text-yellow-700" />,
    },
    { key: 'sent_at', header: 'Sent', render: (r: Row) => fmtDateTime(r.sent_at) },
    {
      key: 'actions', header: '',
      render: (r: Row) => (
        <div onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => downloadCard(r)}>
            <FileDown size={14} /> PDF
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader title="Invitations">
        <Button onClick={downloadAll}>
          <Printer size={14} /> Download All Cards
        </Button>
      </PageHeader>

      <div className="mb-6">
        <CardDesignSection />
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <Table columns={columns} rows={rows} emptyMessage="No parties yet." />
      )}

      <Modal open={!!pendingDownload} onClose={() => setPendingDownload(null)} title="Issue Missing Invitations">
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            {missingCount === 1 ? "1 party hasn't" : `${missingCount} parties haven't`} been issued an invitation token yet, so the card can't be printed.
            Issue {missingCount === 1 ? 'a token' : 'tokens'} now and continue?
          </p>
          <p className="text-xs text-gray-500">This only mints tokens for parties that don't already have one -- it never rotates a token that's already been printed or sent.</p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setPendingDownload(null)}>Cancel</Button>
            <Button onClick={confirmIssueAndRetry} disabled={issueMissing.isPending}>Issue &amp; Download</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
