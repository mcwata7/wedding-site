import { useState, useEffect } from 'react'
import { Plus, Archive, Upload } from 'lucide-react'
import {
  useSiteSettings, useUpdateSiteSettings, useSitePages,
  useThingsToDoItems, useCreateThingToDoItem,
  useFaqItems, useCreateFaqItem,
  useTravelHotels, useCreateTravelHotel, useTravelFlights, useCreateTravelFlight,
  useMediaAssets, useUploadMedia, useUpdateResource, useArchiveResource,
} from '../../api/hooks'
import {
  Button, Modal, Field, Input, TextArea, Table, Select,
  LoadingSpinner, PageHeader, useToast, Badge, MediaPicker,
} from '../../components'
import { ApiRequestError, mediaUrl } from '../../api/client'
import type { ThingToDoItem, FaqItem, TravelHotel, TravelFlight, MediaAsset } from '../../api/types'

type Tab = 'general' | 'pages' | 'travel' | 'faq' | 'things-to-do' | 'media'

// The 10 custom fonts bundled into the guest app (frontend/public/public/fonts/) -- kept in sync
// with the backend's SITE_FONTS set (InternalDataController.java) and the guest app's own copy of
// this list (frontend/public/src/lib/theme.ts). '' = "Default" (the guest app's built-in look).
const FONT_FAMILY_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'TANGERINE', label: 'Tangerine' },
  { value: 'ROUGE_SCRIPT', label: 'Rouge Script' },
  { value: 'MONSIEUR_LA_DOULAISE', label: 'Monsieur La Doulaise' },
  { value: 'GWENDOLYN', label: 'Gwendolyn' },
  { value: 'EPHESIS', label: 'Ephesis' },
  { value: 'LAVISHLY_YOURS', label: 'Lavishly Yours' },
  { value: 'OOOH_BABY', label: 'Oooh Baby' },
  { value: 'CARATTERE', label: 'Carattere' },
  { value: 'BIRTHSTONE', label: 'Birthstone' },
  { value: 'BILBO_SWASH_CAPS', label: 'Bilbo Swash Caps' },
]
const FONT_SIZE_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'SMALL', label: 'Small' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LARGE', label: 'Large' },
]

/** A color field pairing a native swatch with a hex text input (matches CardDesignSection.tsx's
 * QR-color precedent), plus a Reset button -- a native color input has no "empty" state, so
 * without this a planner could never get back to the unthemed default once they'd touched it. */
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#000000'} onChange={e => onChange(e.target.value)} className="h-8 w-8 cursor-pointer rounded border border-gray-300 p-0.5" />
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder="Default" className="w-28" />
        {value && <Button size="sm" variant="ghost" type="button" onClick={() => onChange('')}>Reset</Button>}
      </div>
    </Field>
  )
}

export function SitePage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('general')

  // --- General tab ---
  const { data: settings, isLoading: settingsLoading } = useSiteSettings()
  const updateSettings = useUpdateSiteSettings()
  const [form, setForm] = useState<Record<string, string>>({})
  useEffect(() => {
    if (settings) {
      setForm({
        partner_one_name: settings.partner_one_name ?? '',
        partner_two_name: settings.partner_two_name ?? '',
        wedding_start_date: settings.wedding_start_date ?? '',
        wedding_end_date: settings.wedding_end_date ?? '',
        display_timezone: settings.display_timezone ?? 'Asia/Kathmandu',
        site_layout: settings.site_layout ?? 'MULTI_PAGE',
        header_font_family: settings.header_font_family ?? '',
        header_font_color: settings.header_font_color ?? '',
        header_font_size: settings.header_font_size ?? '',
        header_bg_color: settings.header_bg_color ?? '',
        site_font_family: settings.site_font_family ?? '',
        site_font_color: settings.site_font_color ?? '',
        site_font_size: settings.site_font_size ?? '',
        site_bg_color: settings.site_bg_color ?? '',
        tile_bg_color: settings.tile_bg_color ?? '',
        tile_border_color: settings.tile_border_color ?? '',
      })
    }
  }, [settings])
  const field = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateSettings.mutateAsync({
        ...form,
        wedding_start_date: form.wedding_start_date || null,
        wedding_end_date: form.wedding_end_date || null,
      })
      toast.success('General settings saved.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed.')
    }
  }

  // --- Pages tab ---
  const { data: pages, isLoading: pagesLoading } = useSitePages()
  const updateResource = useUpdateResource()
  const archiveResource = useArchiveResource()
  const [editPageId, setEditPageId] = useState<string | null>(null)
  const [pageForm, setPageForm] = useState({ label: '', heading: '', sort_order: '', body: '', image_id: '', hero_image_id: '', hero_tagline: '', home_design_image_id: '', home_design_only: false })
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
    setPageForm({
      label: p.label, heading: p.heading ?? '', sort_order: String(p.sort_order), body: p.body ?? '', image_id: p.image_id ?? '',
      hero_image_id: settings?.hero_image_id ?? '', hero_tagline: settings?.hero_tagline ?? '',
      home_design_image_id: settings?.home_design_image_id ?? '', home_design_only: settings?.home_design_only ?? false,
    })
    setEditPageId(id)
  }

  const savePage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editPageId) return
    try {
      await updateResource.mutateAsync({
        resource: 'site-pages', id: editPageId,
        body: { label: pageForm.label, heading: pageForm.heading, sort_order: Number(pageForm.sort_order), body: pageForm.body, image_id: pageForm.image_id || null },
      })
      if (editingPage?.slug === 'home') {
        await updateSettings.mutateAsync({
          hero_image_id: pageForm.hero_image_id || null, hero_tagline: pageForm.hero_tagline,
          home_design_image_id: pageForm.home_design_image_id || null, home_design_only: pageForm.home_design_only,
        })
      }
      toast.success('Page updated.')
      setEditPageId(null)
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed.')
    }
  }

  // --- Travel tab ---
  const { data: hotels, isLoading: hotelsLoading } = useTravelHotels()
  const createHotel = useCreateTravelHotel()
  const [showCreateHotel, setShowCreateHotel] = useState(false)
  const [editHotel, setEditHotel] = useState<TravelHotel | null>(null)
  const emptyHotelForm = { name: '', address: '', url: '', description: '', sort_order: '0' }
  const [hotelForm, setHotelForm] = useState(emptyHotelForm)
  const hotelField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setHotelForm(f => ({ ...f, [k]: e.target.value }))

  const submitHotel = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = { ...hotelForm, sort_order: Number(hotelForm.sort_order) || 0 }
    try {
      if (editHotel) {
        await updateResource.mutateAsync({ resource: 'travel-hotels', id: editHotel.id, body })
        toast.success('Hotel updated.')
        setEditHotel(null)
      } else {
        await createHotel.mutateAsync(body)
        toast.success('Hotel added.')
        setShowCreateHotel(false)
        setHotelForm(emptyHotelForm)
      }
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed.')
    }
  }

  const openEditHotel = (item: TravelHotel) => {
    setHotelForm({
      name: item.name, address: item.address ?? '', url: item.url ?? '', description: item.description ?? '',
      sort_order: String(item.sort_order),
    })
    setEditHotel(item)
  }

  const archiveHotel = async (item: TravelHotel) => {
    if (!confirm(`Archive "${item.name}"?`)) return
    try {
      await archiveResource.mutateAsync({ resource: 'travel-hotels', id: item.id })
      toast.success('Hotel archived.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Archive failed.')
    }
  }

  const { data: flights, isLoading: flightsLoading } = useTravelFlights()
  const createFlight = useCreateTravelFlight()
  const [showCreateFlight, setShowCreateFlight] = useState(false)
  const [editFlight, setEditFlight] = useState<TravelFlight | null>(null)
  const emptyFlightForm = { route_name: '', duration: '', estimated_cost: '', description: '', sort_order: '0' }
  const [flightForm, setFlightForm] = useState(emptyFlightForm)
  const flightField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFlightForm(f => ({ ...f, [k]: e.target.value }))

  const submitFlight = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = { ...flightForm, sort_order: Number(flightForm.sort_order) || 0 }
    try {
      if (editFlight) {
        await updateResource.mutateAsync({ resource: 'travel-flights', id: editFlight.id, body })
        toast.success('Flight updated.')
        setEditFlight(null)
      } else {
        await createFlight.mutateAsync(body)
        toast.success('Flight added.')
        setShowCreateFlight(false)
        setFlightForm(emptyFlightForm)
      }
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed.')
    }
  }

  const openEditFlight = (item: TravelFlight) => {
    setFlightForm({
      route_name: item.route_name, duration: item.duration ?? '', estimated_cost: item.estimated_cost ?? '',
      description: item.description ?? '', sort_order: String(item.sort_order),
    })
    setEditFlight(item)
  }

  const archiveFlight = async (item: TravelFlight) => {
    if (!confirm(`Archive "${item.route_name}"?`)) return
    try {
      await archiveResource.mutateAsync({ resource: 'travel-flights', id: item.id })
      toast.success('Flight archived.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Archive failed.')
    }
  }

  // --- FAQ tab ---
  const { data: faqItems, isLoading: faqLoading } = useFaqItems()
  const createFaqItem = useCreateFaqItem()
  const [showCreateFaq, setShowCreateFaq] = useState(false)
  const [editFaq, setEditFaq] = useState<FaqItem | null>(null)
  const emptyFaqForm = { question: '', answer: '', sort_order: '0' }
  const [faqForm, setFaqForm] = useState(emptyFaqForm)
  const faqField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setFaqForm(f => ({ ...f, [k]: e.target.value }))

  const submitFaq = async (e: React.FormEvent) => {
    e.preventDefault()
    const body: Record<string, unknown> = { ...faqForm, sort_order: Number(faqForm.sort_order) || 0 }
    try {
      if (editFaq) {
        await updateResource.mutateAsync({ resource: 'faq-items', id: editFaq.id, body })
        toast.success('FAQ item updated.')
        setEditFaq(null)
      } else {
        await createFaqItem.mutateAsync(body)
        toast.success('FAQ item added.')
        setShowCreateFaq(false)
        setFaqForm(emptyFaqForm)
      }
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed.')
    }
  }

  const openEditFaq = (item: FaqItem) => {
    setFaqForm({ question: item.question, answer: item.answer ?? '', sort_order: String(item.sort_order) })
    setEditFaq(item)
  }

  const archiveFaq = async (item: FaqItem) => {
    if (!confirm(`Archive "${item.question}"?`)) return
    try {
      await archiveResource.mutateAsync({ resource: 'faq-items', id: item.id })
      toast.success('FAQ item archived.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Archive failed.')
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
    { key: 'general', label: 'General' },
    { key: 'pages', label: 'Pages' },
    { key: 'travel', label: 'Travel' },
    { key: 'faq', label: 'FAQ' },
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

  const hotelColumns = [
    { key: 'name', header: 'Name' },
    { key: 'sort_order', header: 'Order' },
    {
      key: 'actions', header: '',
      render: (r: TravelHotel) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => openEditHotel(r)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => archiveHotel(r)}><Archive size={14} /></Button>
        </div>
      ),
    },
  ]

  const renderHotelForm = (onClose: () => void) => (
    <form onSubmit={submitHotel} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" required><Input required value={hotelForm.name} onChange={hotelField('name')} /></Field>
        <Field label="Sort Order"><Input type="number" value={hotelForm.sort_order} onChange={hotelField('sort_order')} /></Field>
      </div>
      <Field label="Address"><Input value={hotelForm.address} onChange={hotelField('address')} /></Field>
      <Field label="Link"><Input value={hotelForm.url} onChange={hotelField('url')} placeholder="https://" /></Field>
      <Field label="Description"><TextArea value={hotelForm.description} onChange={hotelField('description')} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={createHotel.isPending || updateResource.isPending}>Save</Button>
      </div>
    </form>
  )

  const flightColumns = [
    { key: 'route_name', header: 'Route' },
    { key: 'sort_order', header: 'Order' },
    {
      key: 'actions', header: '',
      render: (r: TravelFlight) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => openEditFlight(r)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => archiveFlight(r)}><Archive size={14} /></Button>
        </div>
      ),
    },
  ]

  const renderFlightForm = (onClose: () => void) => (
    <form onSubmit={submitFlight} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Route Name" required><Input required value={flightForm.route_name} onChange={flightField('route_name')} placeholder="e.g. JFK → KTM" /></Field>
        <Field label="Sort Order"><Input type="number" value={flightForm.sort_order} onChange={flightField('sort_order')} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Duration"><Input value={flightForm.duration} onChange={flightField('duration')} placeholder="e.g. ~14h incl. layover" /></Field>
        <Field label="Estimated Cost"><Input value={flightForm.estimated_cost} onChange={flightField('estimated_cost')} placeholder="e.g. $900–$1,200 round trip" /></Field>
      </div>
      <Field label="Description"><TextArea value={flightForm.description} onChange={flightField('description')} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={createFlight.isPending || updateResource.isPending}>Save</Button>
      </div>
    </form>
  )

  const faqColumns = [
    { key: 'question', header: 'Question' },
    { key: 'sort_order', header: 'Order' },
    {
      key: 'actions', header: '',
      render: (r: FaqItem) => (
        <div className="flex gap-1" onClick={e => e.stopPropagation()}>
          <Button size="sm" variant="ghost" onClick={() => openEditFaq(r)}>Edit</Button>
          <Button size="sm" variant="ghost" onClick={() => archiveFaq(r)}><Archive size={14} /></Button>
        </div>
      ),
    },
  ]

  const renderFaqForm = (onClose: () => void) => (
    <form onSubmit={submitFaq} className="space-y-3">
      <Field label="Question" required><Input required value={faqForm.question} onChange={faqField('question')} /></Field>
      <Field label="Answer"><TextArea rows={4} value={faqForm.answer} onChange={faqField('answer')} /></Field>
      <Field label="Sort Order"><Input type="number" value={faqForm.sort_order} onChange={faqField('sort_order')} /></Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={createFaqItem.isPending || updateResource.isPending}>Save</Button>
      </div>
    </form>
  )

  return (
    <div>
      <PageHeader title="Wedding Site">
        {tab === 'travel' && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => { setHotelForm(emptyHotelForm); setShowCreateHotel(true) }}>
              <Plus size={14} /> Add Hotel
            </Button>
            <Button size="sm" onClick={() => { setFlightForm(emptyFlightForm); setShowCreateFlight(true) }}>
              <Plus size={14} /> Add Flight
            </Button>
          </div>
        )}
        {tab === 'faq' && (
          <Button size="sm" onClick={() => { setFaqForm(emptyFaqForm); setShowCreateFaq(true) }}>
            <Plus size={14} /> Add Item
          </Button>
        )}
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

      {tab === 'general' && (
        settingsLoading ? <LoadingSpinner /> : (
          <form onSubmit={saveSettings} className="space-y-6 bg-white rounded-lg border border-gray-200 p-6">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Partner One Name"><Input value={form.partner_one_name ?? ''} onChange={field('partner_one_name')} /></Field>
              <Field label="Partner Two Name"><Input value={form.partner_two_name ?? ''} onChange={field('partner_two_name')} /></Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Wedding Start Date"><Input type="date" value={form.wedding_start_date ?? ''} onChange={field('wedding_start_date')} /></Field>
              <Field label="Wedding End Date"><Input type="date" value={form.wedding_end_date ?? ''} onChange={field('wedding_end_date')} /></Field>
              <Field label="Display Timezone"><Input value={form.display_timezone ?? ''} onChange={field('display_timezone')} placeholder="Asia/Kathmandu" /></Field>
            </div>
            <Field label="Guest Site Layout">
              <Select
                value={form.site_layout ?? 'MULTI_PAGE'}
                onChange={v => setForm(f => ({ ...f, site_layout: v }))}
                options={[
                  { value: 'MULTI_PAGE', label: 'Separate pages (a page per tab)' },
                  { value: 'SINGLE_PAGE', label: 'One page (tabs jump to sections)' },
                ]}
              />
              <p className="mt-1 text-xs text-gray-500">RSVP always stays its own page in either layout.</p>
            </Field>

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Header Styling</p>
              <p className="text-xs text-gray-500 mb-3">The sticky navigation bar at the top of the wedding site.</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="Font"><Select value={form.header_font_family ?? ''} onChange={v => setForm(f => ({ ...f, header_font_family: v }))} options={FONT_FAMILY_OPTIONS} /></Field>
                <Field label="Font Size"><Select value={form.header_font_size ?? ''} onChange={v => setForm(f => ({ ...f, header_font_size: v }))} options={FONT_SIZE_OPTIONS} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Font Color" value={form.header_font_color ?? ''} onChange={v => setForm(f => ({ ...f, header_font_color: v }))} />
                <ColorField label="Background Color" value={form.header_bg_color ?? ''} onChange={v => setForm(f => ({ ...f, header_bg_color: v }))} />
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Site Styling</p>
              <p className="text-xs text-gray-500 mb-3">Everything else on the site. Font applies to headings and page titles only — body text stays in the default, more legible typeface regardless of font choice.</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="Font"><Select value={form.site_font_family ?? ''} onChange={v => setForm(f => ({ ...f, site_font_family: v }))} options={FONT_FAMILY_OPTIONS} /></Field>
                <Field label="Font Size"><Select value={form.site_font_size ?? ''} onChange={v => setForm(f => ({ ...f, site_font_size: v }))} options={FONT_SIZE_OPTIONS} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Font Color" value={form.site_font_color ?? ''} onChange={v => setForm(f => ({ ...f, site_font_color: v }))} />
                <ColorField label="Background Color" value={form.site_bg_color ?? ''} onChange={v => setForm(f => ({ ...f, site_bg_color: v }))} />
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-1">Tile Styling</p>
              <p className="text-xs text-gray-500 mb-3">The individual cards in Schedule, Travel, and Things To Do (each event, hotel, flight, and recommendation).</p>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Background Color" value={form.tile_bg_color ?? ''} onChange={v => setForm(f => ({ ...f, tile_bg_color: v }))} />
                <ColorField label="Border Color" value={form.tile_border_color ?? ''} onChange={v => setForm(f => ({ ...f, tile_border_color: v }))} />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={updateSettings.isPending}>Save General</Button>
            </div>
          </form>
        )
      )}

      {tab === 'pages' && (
        pagesLoading ? <LoadingSpinner /> : (
          <div>
            <p className="text-sm text-gray-500 mb-3">Toggle which tabs are visible on the public wedding site, and edit each tab's heading, body copy, and banner image. Travel, FAQ, and Things To Do also have their own tabs above for managing their list items.</p>
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

      {tab === 'travel' && (
        hotelsLoading || flightsLoading ? <LoadingSpinner /> : (
          <div className="space-y-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Hotels</h3>
              <Table columns={hotelColumns} rows={hotels ?? []} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Flights</h3>
              <Table columns={flightColumns} rows={flights ?? []} />
            </div>
          </div>
        )
      )}

      {tab === 'faq' && (
        faqLoading ? <LoadingSpinner /> : <Table columns={faqColumns} rows={faqItems ?? []} />
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
                <img src={mediaUrl(m.id)} alt="" className="w-full h-24 object-cover" />
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

      <Modal open={showCreateHotel} onClose={() => setShowCreateHotel(false)} title="Add Hotel" size="lg">
        {renderHotelForm(() => setShowCreateHotel(false))}
      </Modal>

      <Modal open={!!editHotel} onClose={() => setEditHotel(null)} title="Edit Hotel" size="lg">
        {renderHotelForm(() => setEditHotel(null))}
      </Modal>

      <Modal open={showCreateFlight} onClose={() => setShowCreateFlight(false)} title="Add Flight" size="lg">
        {renderFlightForm(() => setShowCreateFlight(false))}
      </Modal>

      <Modal open={!!editFlight} onClose={() => setEditFlight(null)} title="Edit Flight" size="lg">
        {renderFlightForm(() => setEditFlight(null))}
      </Modal>

      <Modal open={showCreateFaq} onClose={() => setShowCreateFaq(false)} title="Add FAQ Item" size="lg">
        {renderFaqForm(() => setShowCreateFaq(false))}
      </Modal>

      <Modal open={!!editFaq} onClose={() => setEditFaq(null)} title="Edit FAQ Item" size="lg">
        {renderFaqForm(() => setEditFaq(null))}
      </Modal>

      <Modal open={!!editingPage} onClose={() => setEditPageId(null)} title={`Edit — ${editingPage?.label ?? ''}`} size="lg">
        <form onSubmit={savePage} className="space-y-3">
          <Field label="Label" required><Input required value={pageForm.label} onChange={e => setPageForm(f => ({ ...f, label: e.target.value }))} /></Field>
          <Field label="Sort Order"><Input type="number" value={pageForm.sort_order} onChange={e => setPageForm(f => ({ ...f, sort_order: e.target.value }))} /></Field>
          <Field label="Heading"><Input value={pageForm.heading} onChange={e => setPageForm(f => ({ ...f, heading: e.target.value }))} /></Field>
          <Field label="Body"><TextArea rows={5} value={pageForm.body} onChange={e => setPageForm(f => ({ ...f, body: e.target.value }))} /></Field>
          <Field label="Image"><MediaPicker value={pageForm.image_id} onChange={id => setPageForm(f => ({ ...f, image_id: id }))} /></Field>
          {editingPage?.slug === 'home' && (
            <div className="border-t pt-3 space-y-3">
              <p className="text-xs text-gray-500">Home page hero — the full-bleed banner and tagline shown at the top of the site.</p>
              <Field label="Hero Image"><MediaPicker value={pageForm.hero_image_id} onChange={id => setPageForm(f => ({ ...f, hero_image_id: id }))} /></Field>
              <Field label="Hero Tagline"><Input value={pageForm.hero_tagline} onChange={e => setPageForm(f => ({ ...f, hero_tagline: e.target.value }))} /></Field>
            </div>
          )}
          {editingPage?.slug === 'home' && (
            <div className="border-t pt-3 space-y-3">
              <p className="text-xs text-gray-500">Designed elsewhere and uploading it as one image? Upload it below and check the box to show only that image on the Home page — every field above stays saved, it just won't render on the site while this is checked.</p>
              <Field label="Design Image"><MediaPicker value={pageForm.home_design_image_id} onChange={id => setPageForm(f => ({ ...f, home_design_image_id: id }))} /></Field>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={pageForm.home_design_only}
                  onChange={e => setPageForm(f => ({ ...f, home_design_only: e.target.checked }))}
                />
                Show only this image on the Home page
              </label>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditPageId(null)}>Cancel</Button>
            <Button type="submit" disabled={updateResource.isPending || updateSettings.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
