import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  useBudgetCategories, useBudgetContributors, useBudgetLineItems, useBudgetSummary,
  useCreateBudgetCategory, useCreateBudgetContributor, useCreateBudgetLineItem,
  useUpdateResource, useArchiveResource,
} from '../../api/hooks'
import {
  Button, Modal, Field, Input, TextArea, Select, Table,
  LoadingSpinner, PageHeader, useToast, Badge,
} from '../../components'
import { ApiRequestError } from '../../api/client'
import { fmtMoney } from '../../lib/format'
import type { BudgetLineItem, BudgetSummary } from '../../api/types'

type Tab = 'summary' | 'line-items' | 'categories' | 'contributors'

const CURRENCIES = ['NPR', 'USD', 'GBP', 'EUR', 'AUD', 'CAD', 'INR'].map(c => ({ value: c, label: c }))
const PAYMENT_STATUSES = ['UNPAID', 'PARTIAL', 'PAID'].map(s => ({ value: s, label: s }))

export function BudgetPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('summary')

  const { data: categories, isLoading: catLoading } = useBudgetCategories()
  const { data: contributors } = useBudgetContributors()
  const { data: lineItems, isLoading: itemsLoading } = useBudgetLineItems()
  const { data: summary, isLoading: summaryLoading } = useBudgetSummary()

  const createCategory = useCreateBudgetCategory()
  const createContributor = useCreateBudgetContributor()
  const createLineItem = useCreateBudgetLineItem()
  const updateResource = useUpdateResource()
  const archiveResource = useArchiveResource()

  const [showCreateCat, setShowCreateCat] = useState(false)
  const [showCreateContrib, setShowCreateContrib] = useState(false)
  const [showCreateItem, setShowCreateItem] = useState(false)
  const [editItem, setEditItem] = useState<BudgetLineItem | null>(null)
  const [nameForm, setNameForm] = useState('')

  const emptyItemForm = { category_id: '', description: '', currency: 'NPR', planned_amount: '', actual_amount: '', payment_status: 'UNPAID', due_date: '', notes: '' }
  const [itemForm, setItemForm] = useState(emptyItemForm)

  const submitCat = async (e: React.FormEvent) => {
    e.preventDefault()
    try { await createCategory.mutateAsync({ name: nameForm }); toast.success('Category created.'); setShowCreateCat(false); setNameForm('') }
    catch (err) { toast.error(err instanceof ApiRequestError ? err.message : 'Failed.') }
  }

  const submitContrib = async (e: React.FormEvent) => {
    e.preventDefault()
    try { await createContributor.mutateAsync({ name: nameForm }); toast.success('Contributor created.'); setShowCreateContrib(false); setNameForm('') }
    catch (err) { toast.error(err instanceof ApiRequestError ? err.message : 'Failed.') }
  }

  const submitItem = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = {
      category_id: itemForm.category_id,
      description: itemForm.description,
      currency: itemForm.currency,
      payment_status: itemForm.payment_status,
    }
    if (itemForm.planned_amount) body.planned_amount = Number(itemForm.planned_amount)
    if (itemForm.actual_amount) body.actual_amount = Number(itemForm.actual_amount)
    if (itemForm.due_date) body.due_date = itemForm.due_date
    if (itemForm.notes) body.notes = itemForm.notes

    try {
      if (editItem) {
        await updateResource.mutateAsync({ resource: 'line-items', id: editItem.id, body })
        toast.success('Line item updated.')
        setEditItem(null)
      } else {
        await createLineItem.mutateAsync(body)
        toast.success('Line item created.')
        setShowCreateItem(false)
        setItemForm(emptyItemForm)
      }
    } catch (err) { toast.error(err instanceof ApiRequestError ? err.message : 'Failed.') }
  }

  const openEditItem = (item: BudgetLineItem) => {
    setItemForm({
      category_id: item.category_id,
      description: item.description,
      currency: item.currency,
      planned_amount: item.planned_amount?.toString() ?? '',
      actual_amount: item.actual_amount?.toString() ?? '',
      payment_status: item.payment_status ?? 'UNPAID',
      due_date: item.due_date ?? '',
      notes: item.notes ?? '',
    })
    setEditItem(item)
  }

  const categoryOptions = (categories ?? []).map(c => ({ value: c.id, label: c.name }))

  const summaryCols = [
    { key: 'category', header: 'Category' },
    { key: 'currency', header: 'Currency' },
    { key: 'planned_amount', header: 'Planned', render: (r: BudgetSummary) => fmtMoney(r.planned_amount, r.currency) },
    { key: 'actual_amount', header: 'Actual', render: (r: BudgetSummary) => fmtMoney(r.actual_amount, r.currency) },
    {
      key: 'diff', header: 'Remaining',
      render: (r: BudgetSummary) => {
        const diff = (r.planned_amount ?? 0) - (r.actual_amount ?? 0)
        return <span className={diff < 0 ? 'text-red-600 font-medium' : 'text-gray-700'}>{fmtMoney(diff, r.currency)}</span>
      },
    },
  ]

  const itemCols = [
    { key: 'category_name', header: 'Category' },
    { key: 'description', header: 'Description' },
    { key: 'currency', header: 'Currency' },
    { key: 'planned_amount', header: 'Planned', render: (r: BudgetLineItem) => fmtMoney(r.planned_amount, r.currency) },
    { key: 'actual_amount', header: 'Actual', render: (r: BudgetLineItem) => fmtMoney(r.actual_amount, r.currency) },
    {
      key: 'payment_status', header: 'Status',
      render: (r: BudgetLineItem) => {
        const colors: Record<string, string> = { PAID: 'bg-green-100 text-green-700', PARTIAL: 'bg-yellow-100 text-yellow-700', UNPAID: 'bg-red-100 text-red-700' }
        return <Badge label={r.payment_status ?? 'UNPAID'} className={colors[r.payment_status ?? 'UNPAID'] ?? ''} />
      },
    },
    { key: 'due_date', header: 'Due', render: (r: BudgetLineItem) => r.due_date || '—' },
    {
      key: 'actions', header: '',
      render: (r: BudgetLineItem) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => openEditItem(r)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={async () => { if (!confirm('Archive?')) return; await archiveResource.mutateAsync({ resource: 'line-items', id: r.id }); toast.success('Archived.') }}>Archive</Button>
        </div>
      ),
    },
  ]

  const tabs: { key: Tab; label: string }[] = [
    { key: 'summary', label: 'Summary' },
    { key: 'line-items', label: 'Line Items' },
    { key: 'categories', label: 'Categories' },
    { key: 'contributors', label: 'Contributors' },
  ]

  const ItemForm = ({ onClose }: { onClose: () => void }) => (
    <form onSubmit={submitItem} className="space-y-3">
      <Field label="Category" required>
        <Select value={itemForm.category_id} onChange={v => setItemForm(f => ({ ...f, category_id: v }))} options={categoryOptions} placeholder="Select category…" />
      </Field>
      <Field label="Description" required><Input required value={itemForm.description} onChange={e => setItemForm(f => ({ ...f, description: e.target.value }))} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Currency">
          <Select value={itemForm.currency} onChange={v => setItemForm(f => ({ ...f, currency: v }))} options={CURRENCIES} />
        </Field>
        <Field label="Planned Amount"><Input type="number" min="0" step="0.01" value={itemForm.planned_amount} onChange={e => setItemForm(f => ({ ...f, planned_amount: e.target.value }))} /></Field>
        <Field label="Actual Amount"><Input type="number" min="0" step="0.01" value={itemForm.actual_amount} onChange={e => setItemForm(f => ({ ...f, actual_amount: e.target.value }))} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Payment Status">
          <Select value={itemForm.payment_status} onChange={v => setItemForm(f => ({ ...f, payment_status: v }))} options={PAYMENT_STATUSES} />
        </Field>
        <Field label="Due Date"><Input type="date" value={itemForm.due_date} onChange={e => setItemForm(f => ({ ...f, due_date: e.target.value }))} /></Field>
      </div>
      <Field label="Notes"><TextArea value={itemForm.notes} onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={createLineItem.isPending || updateResource.isPending}>Save</Button>
      </div>
    </form>
  )

  return (
    <div>
      <PageHeader title="Budget">
        {tab === 'line-items' && <Button size="sm" onClick={() => { setItemForm(emptyItemForm); setShowCreateItem(true) }}><Plus size={14} /> Add Line Item</Button>}
        {tab === 'categories' && <Button size="sm" onClick={() => { setNameForm(''); setShowCreateCat(true) }}><Plus size={14} /> Add Category</Button>}
        {tab === 'contributors' && <Button size="sm" onClick={() => { setNameForm(''); setShowCreateContrib(true) }}><Plus size={14} /> Add Contributor</Button>}
      </PageHeader>

      <div className="flex gap-2 mb-4">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === t.key ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        summaryLoading ? <LoadingSpinner /> : summary && <Table columns={summaryCols} rows={summary.map((r, i) => ({ ...r, id: `${r.category}-${r.currency}-${i}` }))} emptyMessage="No budget items found." />
      )}

      {tab === 'line-items' && (
        itemsLoading ? <LoadingSpinner /> : lineItems && <Table columns={itemCols} rows={lineItems} />
      )}

      {tab === 'categories' && (
        catLoading ? <LoadingSpinner /> : categories && (
          <Table
            columns={[
              { key: 'name', header: 'Category Name' },
              {
                key: 'actions', header: '',
                render: r => (
                  <Button size="sm" variant="ghost" onClick={async e => { e.stopPropagation(); if (!confirm('Archive?')) return; await archiveResource.mutateAsync({ resource: 'categories', id: r.id }); toast.success('Archived.') }}>Archive</Button>
                ),
              },
            ]}
            rows={categories}
          />
        )
      )}

      {tab === 'contributors' && (
        contributors && (
          <Table
            columns={[
              { key: 'name', header: 'Contributor Name' },
              {
                key: 'actions', header: '',
                render: r => (
                  <Button size="sm" variant="ghost" onClick={async e => { e.stopPropagation(); if (!confirm('Archive?')) return; await archiveResource.mutateAsync({ resource: 'contributors', id: r.id }); toast.success('Archived.') }}>Archive</Button>
                ),
              },
            ]}
            rows={contributors}
          />
        )
      )}

      <Modal open={showCreateCat} onClose={() => setShowCreateCat(false)} title="Add Category" size="sm">
        <form onSubmit={submitCat} className="space-y-3">
          <Field label="Name" required><Input required value={nameForm} onChange={e => setNameForm(e.target.value)} autoFocus /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreateCat(false)}>Cancel</Button>
            <Button type="submit" disabled={createCategory.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showCreateContrib} onClose={() => setShowCreateContrib(false)} title="Add Contributor" size="sm">
        <form onSubmit={submitContrib} className="space-y-3">
          <Field label="Name" required><Input required value={nameForm} onChange={e => setNameForm(e.target.value)} autoFocus /></Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreateContrib(false)}>Cancel</Button>
            <Button type="submit" disabled={createContributor.isPending}>Create</Button>
          </div>
        </form>
      </Modal>

      <Modal open={showCreateItem} onClose={() => setShowCreateItem(false)} title="Add Line Item" size="lg">
        <ItemForm onClose={() => setShowCreateItem(false)} />
      </Modal>

      <Modal open={!!editItem} onClose={() => setEditItem(null)} title="Edit Line Item" size="lg">
        <ItemForm onClose={() => setEditItem(null)} />
      </Modal>
    </div>
  )
}
