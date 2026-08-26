import { useState, useEffect } from 'react'
import { Plus, Archive, Upload } from 'lucide-react'
import {
  useSiteSettings, useUpdateSiteSettings, useSitePages, useThingsToDoItems, useCreateThingToDoItem,
  useMediaAssets, useUploadMedia, useUpdateResource, useArchiveResource,
} from '../../api/hooks'
import {
  Button, Modal, Field, Input, TextArea, Table,
  LoadingSpinner, PageHeader, useToast, Badge, MediaPicker,
} from '../../components'
import { ApiRequestError } from '../../api/client'
import type { ThingToDoItem, MediaAsset } from '../../api/types'

type Tab = 'content' | 'pages' | 'things-to-do' | 'media'

export function SitePage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('content')

  // --- Content tab ---
  const { data: settings, isLoading: settingsLoading } = useSiteSettings()
  const updateSettings = useUpdateSiteSettings()
  const [form, setForm] = useState<Record<string, string>>({})
  useEffect(() => {
    if (settings) {
      setForm({
        partner_one_name: settings.partner_one_name ?? '',
        partner_two_name: settings.partner_two_name ?? '',
        wedding_date: settings.wedding_date ?? '',
        display_timezone: settings.display_timezone ?? 'Asia/Kathmandu',
        hero_image_id: settings.hero_image_id ?? '',
        hero_tagline: settings.hero_tagline ?? '',
        home_heading: settings.home_heading ?? '',
        home_body: settings.home_body ?? '',
        travel_heading: settings.travel_heading ?? '',
        travel_body: settings.travel_body ?? '',
        things_to_do_heading: settings.things_to_do_heading ?? '',
        things_to_do_body: settings.things_to_do_body ?? '',
        schedule_heading: settings.schedule_heading ?? '',
        schedule_body: settings.schedule_body ?? '',
      })
    }
  }, [settings])
  const field = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateSettings.mutateAsync({ ...form, wedding_date: form.wedding_date || null, hero_image_id: form.hero_image_id || null })
      toast.success('Wedding site content saved.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed.')
    }
  }

  // --- Pages tab ---
  const { data: pages, isLoading: pagesLoading } = useSitePages()
  const updateResource = useUpdateResource()
  const archiveResource = useArchiveResource()
  const [editPageId, setEditPageId] = useState<string | null>(null)
  const [pageForm, setPageForm] = useState({ label: '', sort_order: '', body: '' })
  const editingPage = (pages ?? []).find(p => p.id === editPageId)

  const toggleVisible = async (id: string, visible: boolean) => {
    try {
      await updateResource.mutateAsync({ resource: 'site-pages', id, body: { visible: !visible } })
      toast.success(!visible ? 'Tab is now visible on the wedding site.' : 'Tab hidden from the wedding site.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed.')
    }
  }

  const openEditPage = (id: string) => {
    const p = (pages ?? []).find(x => x.id === id)
    if (!p) return
    setPageForm({ label: p.label, sort_order: String(p.sort_order), body: p.body ?? '' })
    setEditPageId(id)
  }

  const savePage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editPageId) return
    try {
      await updateResource.mutateAsync({ resource: 'site-pages', id: editPageId, body: { label: pageForm.label, sort_order: Number(pageForm.sort_order), body: pageForm.body } })
      toast.success('Page updated.')
      setEditPageId(null)
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed.')
    }
  }

  // --- Things To Do tab ---
  const { data: thingsToDoItems, isLoading: thingsToDoLoading } = useThingsToDoItems()
  const createThingToDoItem = useCreateThingToDoItem()
  const [showCreateThingToDo, setShowCreateThingToDo] = useState(false)
  const [editThingToDo, setEditThingToDo] = useState<ThingToDoItem | null>(null)
  const emptyThingToDoForm = { category: '', title: '', description: '', image_id: '', sort_order: '0' }
  const [thingToDoForm, setThingToDoForm] = useState(emptyThingToDoForm)
  const thingToDoField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setThingToDoForm(f => ({ ...f, [k]: e.target.value }))

  const submitThingToDo = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = { ...thingToDoForm, sort_order: Number(thingToDoForm.sort_order) || 0 }
    if (!body.image_id) delete body.image_id
    try {
      if (editThingToDo) {
        await updateResource.mutateAsync({ resource: 'things-to-do-items', id: editThingToDo.id, body })
        toast.success('Item updated.')
        setEditThingToDo(null)
      } else {
        await createThingToDoItem.mutateAsync(body)
        toast.success('Item created.')
        setShowCreateThingToDo(false)
        setThingToDoForm(emptyThingToDoForm)
      }
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed.')
    }
  }

  const openEditThingToDo = (item: ThingToDoItem) => {
    setThingToDoForm({
      category: item.category, title: item.title, description: item.description ?? '',
      image_id: item.image_id ?? '', sort_order: String(item.sort_order),
    })
    setEditThingToDo(item)
  }

  const archiveThingToDo = async (item: ThingToDoItem) => {
    if (!confirm(`Archive "${item.title}"?`)) return
    try {
      await archiveResource.mutateAsync({ resource: 'things-to-do-items', id: item.id })
      toast.success('Item archived.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Archive failed.')
    }
  }

  // --- Media tab ---
  const { data: media, isLoading: mediaLoading } = useMediaAssets()
  const uploadMedia = useUploadMedia()
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      await uploadMedia.mutateAsync(file)
      toast.success('Image uploaded.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Upload failed.')
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'content', label: 'Content' },
    { key: 'pages', label: 'Pages' },
    { key: 'things-to-do', label: 'Things To Do' },
    { key: 'media', label: 'Media' },
  ]

  const thingsToDoColumns = [
    { key: 'title', header: 'Title' },
    { key: 'category', header: 'Category', render: (r: ThingToDoItem) => <Badge label={r.category} className="bg-indigo-100 text-indigo-700" /> },
    { key: 'sort_order', header: 'Order' },
    {
      key: 'actions', header: '',
      render: (r: ThingToDoItem) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => openEditThingToDo(r)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => archiveThingToDo(r)}><Archive size={14} /></Button>
        </div>
      ),
    },
  ]

  const renderThingToDoForm = (onClose: () => void) => (
    <form onSubmit={submitThingToDo} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category" required><Input required value={thingToDoForm.category} onChange={thingToDoField('category')} placeholder="e.g. Food & Drink" /></Field>
        <Field label="Sort Order"><Input type="number" value={thingToDoForm.sort_order} onChange={thingToDoField('sort_order')} /></Field>
      </div>
      <Field label="Title" required><Input required value={thingToDoForm.title} onChange={thingToDoField('title')} /></Field>
      <Field label="Description"><TextArea value={thingToDoForm.description} onChange={thingToDoField('description')} /></Field>
      <Field label="Photo"><MediaPicker value={thingToDoForm.image_id} onChange={id => setThingToDoForm(f => ({ ...f, image_id: id }))} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={createThingToDoItem.isPending || updateResource.isPending}>Save</Button>
      </div>
    </form>
  )

  return (
    <div>
      <PageHeader title="Wedding Site">
        {tab === 'things-to-do' && (
          <Button size="sm" onClick={() => { setThingToDoForm(emptyThingToDoForm); setShowCreateThingToDo(true) }}>
            <Plus size={14} /> Add Item
          </Button>
        )}
        {tab === 'media' && (
          <label>
            <Button size="sm" type="button" onClick={() => document.getElementById('media-upload-input')?.click()} disabled={uploadMedia.isPending}>
              <Upload size={14} /> Upload Image
            </Button>
            <input id="media-upload-input" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleUpload} />
          </label>
        )}
      </PageHeader>

      <div className="flex gap-2 mb-4">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${tab === t.key ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'content' && (
        settingsLoading ? <LoadingSpinner /> : (
          <form onSubmit={saveSettings} className="space-y-6 bg-white rounded-lg border border-gray-200 p-6">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Partner One Name"><Input value={form.partner_one_name ?? ''} onChange={field('partner_one_name')} /></Field>
              <Field label="Partner Two Name"><Input value={form.partner_two_name ?? ''} onChange={field('partner_two_name')} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Wedding Date"><Input type="date" value={form.wedding_date ?? ''} onChange={field('wedding_date')} /></Field>
              <Field label="Display Timezone"><Input value={form.display_timezone ?? ''} onChange={field('display_timezone')} placeholder="Asia/Kathmandu" /></Field>
            </div>
            <Field label="Hero Image"><MediaPicker value={form.hero_image_id ?? ''} onChange={id => setForm(f => ({ ...f, hero_image_id: id }))} /></Field>
            <Field label="Hero Tagline"><Input value={form.hero_tagline ?? ''} onChange={field('hero_tagline')} /></Field>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Home Tab</h3>
              <div className="space-y-3">
                <Field label="Heading"><Input value={form.home_heading ?? ''} onChange={field('home_heading')} /></Field>
                <Field label="Body"><TextArea rows={4} value={form.home_body ?? ''} onChange={field('home_body')} /></Field>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Schedule Tab</h3>
              <div className="space-y-3">
                <Field label="Heading"><Input value={form.schedule_heading ?? ''} onChange={field('schedule_heading')} /></Field>
                <Field label="Body"><TextArea rows={3} value={form.schedule_body ?? ''} onChange={field('schedule_body')} /></Field>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Travel Tab</h3>
              <div className="space-y-3">
                <Field label="Heading"><Input value={form.travel_heading ?? ''} onChange={field('travel_heading')} /></Field>
                <Field label="Body"><TextArea rows={3} value={form.travel_body ?? ''} onChange={field('travel_body')} /></Field>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Things To Do Tab</h3>
              <div className="space-y-3">
                <Field label="Heading"><Input value={form.things_to_do_heading ?? ''} onChange={field('things_to_do_heading')} /></Field>
                <Field label="Body"><TextArea rows={3} value={form.things_to_do_body ?? ''} onChange={field('things_to_do_body')} /></Field>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={updateSettings.isPending}>Save Content</Button>
            </div>
          </form>
        )
      )}

      {tab === 'pages' && (
        pagesLoading ? <LoadingSpinner /> : (
          <div>
            <p className="text-sm text-gray-500 mb-3">Toggle which tabs are visible on the public wedding site. Home, Schedule, Travel, and Things To Do have dedicated pages; the rest render as simple heading + body text once turned on.</p>
            <Table
              columns={[
                { key: 'label', header: 'Tab' },
                { key: 'sort_order', header: 'Order' },
                { key: 'visible', header: 'Status', render: r => <Badge label={r.visible ? 'Visible' : 'Hidden'} className={r.visible ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'} /> },
                {
                  key: 'actions', header: '',
                  render: r => (
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => openEditPage(r.id)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggleVisible(r.id, r.visible)}>{r.visible ? 'Hide' : 'Show'}</Button>
                    </div>
                  ),
                },
              ]}
              rows={pages ?? []}
            />
          </div>
        )
      )}

      {tab === 'things-to-do' && (
        thingsToDoLoading ? <LoadingSpinner /> : <Table columns={thingsToDoColumns} rows={thingsToDoItems ?? []} />
      )}

      {tab === 'media' && (
        mediaLoading ? <LoadingSpinner /> : (
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {(media ?? []).length === 0 && <p className="text-sm text-gray-500 col-span-full">No images uploaded yet.</p>}
            {(media ?? []).map((m: MediaAsset) => (
              <div key={m.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <img src={`/api/v1/media/${m.id}`} alt="" className="w-full h-24 object-cover" />
                <div className="p-2">
                  <p className="text-xs text-gray-600 truncate" title={m.original_name}>{m.original_name || m.id}</p>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <Modal open={showCreateThingToDo} onClose={() => setShowCreateThingToDo(false)} title="Add Item" size="lg">
        {renderThingToDoForm(() => setShowCreateThingToDo(false))}
      </Modal>

      <Modal open={!!editThingToDo} onClose={() => setEditThingToDo(null)} title="Edit Item" size="lg">
        {renderThingToDoForm(() => setEditThingToDo(null))}
      </Modal>

      <Modal open={!!editingPage} onClose={() => setEditPageId(null)} title={`Edit — ${editingPage?.label ?? ''}`} size="lg">
        <form onSubmit={savePage} className="space-y-3">
          <Field label="Label" required><Input required value={pageForm.label} onChange={e => setPageForm(f => ({ ...f, label: e.target.value }))} /></Field>
          <Field label="Sort Order"><Input type="number" value={pageForm.sort_order} onChange={e => setPageForm(f => ({ ...f, sort_order: e.target.value }))} /></Field>
          <Field label="Body"><TextArea rows={5} value={pageForm.body} onChange={e => setPageForm(f => ({ ...f, body: e.target.value }))} /></Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditPageId(null)}>Cancel</Button>
            <Button type="submit" disabled={updateResource.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
