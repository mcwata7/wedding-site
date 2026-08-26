import { useState, useEffect } from 'react'
import { FileDown, Upload, Printer } from 'lucide-react'
import {
  useInvitationCards, useIssueMissingInvitations, useSiteSettings, useUpdateSiteSettings, useUploadMedia,
} from '../../api/hooks'
import {
  Button, Modal, Field, Input, TextArea, Table, LoadingSpinner, PageHeader, Section, useToast, Badge, MediaPicker,
} from '../../components'
import { api, ApiRequestError } from '../../api/client'
import { statusColor, fmtDateTime } from '../../lib/format'
import type { InvitationCardRow } from '../../api/types'

const BASE = '/api/v1/internal'

type Row = InvitationCardRow & { id: string }
type PendingDownload = { kind: 'all' } | { kind: 'party'; partyId: string; filename: string }

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

export function InvitationsPage() {
  const toast = useToast()
  const { data: cardRows, isLoading } = useInvitationCards()
  const { data: settings, isLoading: settingsLoading } = useSiteSettings()
  const updateSettings = useUpdateSiteSettings()
  const uploadMedia = useUploadMedia()
  const issueMissing = useIssueMissingInvitations()

  const [form, setForm] = useState({ invitation_image_id: '', invitation_headline: '', invitation_body: '', invitation_footer: '' })
  useEffect(() => {
    if (settings) {
      setForm({
        invitation_image_id: settings.invitation_image_id ?? '',
        invitation_headline: settings.invitation_headline ?? '',
        invitation_body: settings.invitation_body ?? '',
        invitation_footer: settings.invitation_footer ?? '',
      })
    }
  }, [settings])
  const field = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const [pendingDownload, setPendingDownload] = useState<PendingDownload | null>(null)
  const [missingCount, setMissingCount] = useState(0)

  const saveDesign = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateSettings.mutateAsync({ ...form, invitation_image_id: form.invitation_image_id || null })
      toast.success('Card design saved.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed to save card design.')
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const asset = await uploadMedia.mutateAsync(file)
      setForm(f => ({ ...f, invitation_image_id: asset.id }))
      toast.success('Artwork uploaded. Click Save to use it on the card.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Upload failed.')
    }
  }

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
        {settingsLoading ? <LoadingSpinner /> : (
          <Section title="Card Design">
            <form onSubmit={saveDesign} className="space-y-4">
              <Field label="Artwork">
                <div className="flex items-center gap-3">
                  <MediaPicker
                    value={form.invitation_image_id}
                    onChange={id => setForm(f => ({ ...f, invitation_image_id: id }))}
                    filter={m => m.content_type === 'image/jpeg' || m.content_type === 'image/png'}
                  />
                  <label>
                    <Button size="sm" variant="secondary" type="button" onClick={() => document.getElementById('invitation-artwork-input')?.click()} disabled={uploadMedia.isPending}>
                      <Upload size={14} /> Upload
                    </Button>
                    <input id="invitation-artwork-input" type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleUpload} />
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-500">JPEG or PNG only -- WEBP can't be embedded in the printed PDF.</p>
              </Field>
              <Field label="Headline"><Input value={form.invitation_headline} onChange={field('invitation_headline')} placeholder="Together with joy" /></Field>
              <Field label="Body"><TextArea rows={2} value={form.invitation_body} onChange={field('invitation_body')} placeholder="request the pleasure of your company" /></Field>
              <Field label="Footer caption"><Input value={form.invitation_footer} onChange={field('invitation_footer')} placeholder="Scan to RSVP" /></Field>
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={updateSettings.isPending}>Save Card Design</Button>
              </div>
            </form>
          </Section>
        )}
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
