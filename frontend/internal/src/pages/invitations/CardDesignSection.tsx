import { useEffect, useRef, useState } from 'react'
import { useSiteSettings, useUpdateSiteSettings, usePreviewInvitationCard } from '../../api/hooks'
import { Button, Field, Input, Select, LoadingSpinner, Section, useToast, MediaPicker } from '../../components'
import { ApiRequestError } from '../../api/client'
import { DIMS, ELEMENTS, withDefaultLayout, type Orientation } from './cardLayout'
import type { CardLayout, QrLayout, TextLayout, SiteSettings } from '../../api/types'

type ElementKey = (typeof ELEMENTS)[number]['key']

type FormState = {
  front: string
  back: string
  orientation: Orientation
  layout: CardLayout
}

function toFormState(settings: SiteSettings): FormState {
  return {
    front: settings.invitation_front_image_id ?? '',
    back: settings.invitation_back_image_id ?? '',
    orientation: settings.invitation_orientation ?? 'PORTRAIT',
    layout: withDefaultLayout(settings.invitation_card_layout),
  }
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/** Fits every element's x/y (and the QR's size) into the given orientation's bounds -- switching
 * orientation can otherwise leave a saved position that's valid in the old orientation but out of
 * bounds in the new one (a 148mm-tall portrait y is illegal once landscape's height caps at
 * 105mm). Returns whether anything actually moved, so the caller can tell the planner. */
function fitToOrientation(layout: CardLayout, o: Orientation): { layout: CardLayout; changed: boolean } {
  const { w, h } = DIMS[o]
  const maxQrSize = Math.min(w, h)
  const qr: QrLayout = { ...layout.qr, x: clamp(layout.qr.x, 0, w), y: clamp(layout.qr.y, 0, h), size: clamp(layout.qr.size, 20, maxQrSize) }
  const inviteUrl: TextLayout = { ...layout.inviteUrl, x: clamp(layout.inviteUrl.x, 0, w), y: clamp(layout.inviteUrl.y, 0, h) }
  const guestNames: TextLayout = { ...layout.guestNames, x: clamp(layout.guestNames.x, 0, w), y: clamp(layout.guestNames.y, 0, h) }
  const next = { qr, inviteUrl, guestNames }
  const changed = JSON.stringify(next) !== JSON.stringify(layout)
  return { layout: next, changed }
}

export function CardDesignSection() {
  const toast = useToast()
  const { data: settings, isLoading } = useSiteSettings()
  const updateSettings = useUpdateSiteSettings()
  const preview = usePreviewInvitationCard()

  const [form, setForm] = useState<FormState | null>(null)
  useEffect(() => { if (settings) setForm(toFormState(settings)) }, [settings])

  const [previewUrls, setPreviewUrls] = useState<{ front: string | null; back: string | null }>({ front: null, back: null })
  const previewUrlsRef = useRef<{ front: string | null; back: string | null }>({ front: null, back: null })

  // Debounced live preview: re-renders a sample card a few hundred ms after the last edit, so
  // tuning 12+ numeric/color inputs isn't blind. Front and back are fetched as two separate
  // single-page PDFs (rather than one two-page PDF paged via a `#page=` fragment) because browsers'
  // embedded PDF viewers don't reliably honor different page fragments when the same document is
  // embedded in two iframes at once -- both ended up showing the same page. Failures (e.g. a value
  // that's mid-edit and momentarily out of range) are swallowed here -- Save still validates and
  // surfaces real errors.
  useEffect(() => {
    if (!form) return
    const handle = setTimeout(async () => {
      const base = {
        invitation_front_image_id: form.front || null,
        invitation_back_image_id: form.back || null,
        invitation_orientation: form.orientation,
        invitation_card_layout: form.layout,
      }
      try {
        const [frontBlob, backBlob] = await Promise.all([
          preview.mutateAsync({ ...base, side: 'FRONT' as const }),
          preview.mutateAsync({ ...base, side: 'BACK' as const }),
        ])
        const front = URL.createObjectURL(frontBlob)
        const back = URL.createObjectURL(backBlob)
        if (previewUrlsRef.current.front) URL.revokeObjectURL(previewUrlsRef.current.front)
        if (previewUrlsRef.current.back) URL.revokeObjectURL(previewUrlsRef.current.back)
        previewUrlsRef.current = { front, back }
        setPreviewUrls({ front, back })
      } catch {
        // swallow -- see comment above
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 400)
    return () => clearTimeout(handle)
  }, [form])

  useEffect(() => () => {
    if (previewUrlsRef.current.front) URL.revokeObjectURL(previewUrlsRef.current.front)
    if (previewUrlsRef.current.back) URL.revokeObjectURL(previewUrlsRef.current.back)
  }, [])

  if (isLoading || !form) return <LoadingSpinner />

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => f ? { ...f, [k]: v } : f)

  const setElement = (key: ElementKey, patch: Partial<QrLayout & TextLayout>) =>
    setForm(f => f ? { ...f, layout: { ...f.layout, [key]: { ...f.layout[key], ...patch } } } : f)

  const setOrientation = (value: string) => {
    const o = value as Orientation
    setForm(f => {
      if (!f) return f
      const { layout, changed } = fitToOrientation(f.layout, o)
      if (changed) toast.info('Positions were adjusted to fit the new orientation.')
      return { ...f, orientation: o, layout }
    })
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateSettings.mutateAsync({
        invitation_front_image_id: form.front || null,
        invitation_back_image_id: form.back || null,
        invitation_orientation: form.orientation,
        invitation_card_layout: form.layout,
      })
      toast.success('Card design saved.')
    } catch (err) {
      toast.error(err instanceof ApiRequestError ? err.message : 'Failed to save card design.')
    }
  }

  const dims = DIMS[form.orientation]

  return (
    <Section title="Card Design">
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Front (image only)">
            <MediaPicker
              value={form.front}
              onChange={id => setField('front', id)}
              filter={m => m.content_type === 'image/jpeg' || m.content_type === 'image/png'}
            />
            <p className="mt-1 text-xs text-gray-500">
              JPEG or PNG only. Fills the whole front side; nothing else is drawn on it.
            </p>
          </Field>
          <Field label="Back (QR side)">
            <MediaPicker
              value={form.back}
              onChange={id => setField('back', id)}
              filter={m => m.content_type === 'image/jpeg' || m.content_type === 'image/png'}
            />
            <p className="mt-1 text-xs text-gray-500">
              JPEG or PNG only. The QR, invite URL, and guest names are drawn on top of this image.
            </p>
          </Field>
        </div>

        <Field label="Orientation">
          <Select
            value={form.orientation}
            onChange={setOrientation}
            options={[
              { value: 'PORTRAIT', label: 'Portrait (105 x 148mm)' },
              { value: 'LANDSCAPE', label: 'Landscape (148 x 105mm)' },
            ]}
          />
          <p className="mt-1 text-xs text-gray-500">
            Shared by both sides -- they're the same physical sheet. When printing double-sided, flip
            on the long edge for portrait, the short edge for landscape, or every back prints upside-down.
          </p>
        </Field>

        <div className="space-y-3">
          {ELEMENTS.map(el => {
            const value = form.layout[el.key]
            return (
              <div key={el.key} className="rounded-lg border border-gray-200 p-3">
                <p className="mb-2 text-sm font-medium text-gray-700">{el.label}</p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">X (mm)</label>
                    <Input type="number" step={0.5} min={0} max={dims.w} value={value.x}
                      onChange={e => setElement(el.key, { x: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Y (mm)</label>
                    <Input type="number" step={0.5} min={0} max={dims.h} value={value.y}
                      onChange={e => setElement(el.key, { y: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Size ({el.unit})</label>
                    <Input type="number" step={0.5} min={el.min} max={el.max} value={value.size}
                      onChange={e => setElement(el.key, { size: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={value.color}
                        onChange={e => setElement(el.key, { color: e.target.value })}
                        className="h-8 w-8 cursor-pointer rounded border border-gray-300 p-0.5"
                      />
                      <Input value={value.color} onChange={e => setElement(el.key, { color: e.target.value })} className="w-24" />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={updateSettings.isPending}>Save Card Design</Button>
        </div>
      </form>

      <div className="mt-6">
        <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wider">Preview</p>
        <div className="grid grid-cols-2 gap-4">
          {([['Front', previewUrls.front], ['Back', previewUrls.back]] as const).map(([label, url]) => (
            <div key={label}>
              <p className="mb-1 text-xs text-gray-500">{label}</p>
              <div className="overflow-hidden rounded border border-gray-200 bg-gray-50" style={{ aspectRatio: `${dims.w} / ${dims.h}` }}>
                {url ? (
                  <iframe src={`${url}#toolbar=0&navpanes=0`} title={`Invitation card preview -- ${label}`} className="h-full w-full" />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-gray-400">Loading preview…</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}
