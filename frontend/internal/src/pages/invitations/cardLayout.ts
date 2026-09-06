import type { CardLayout } from '../../api/types'

// Mirrors InvitationCardRenderer.DEFAULT_LAYOUT / V17__invitation_card_two_sided.sql -- keep in sync.
export const DEFAULT_LAYOUT: CardLayout = {
  qr: { x: 52.5, y: 74, size: 40, color: '#000000' },
  inviteUrl: { x: 52.5, y: 48, size: 6, color: '#737373' },
  guestNames: { x: 52.5, y: 108, size: 11, color: '#000000' },
}

/** A saved/posted layout may be missing an element (older data, a partial preview payload) --
 * fill from DEFAULT_LAYOUT so the form and preview never crash on a hole. Mirrors
 * CardLayout.withDefaults() on the backend. */
export function withDefaultLayout(layout?: CardLayout | null): CardLayout {
  return {
    qr: layout?.qr ?? DEFAULT_LAYOUT.qr,
    inviteUrl: layout?.inviteUrl ?? DEFAULT_LAYOUT.inviteUrl,
    guestNames: layout?.guestNames ?? DEFAULT_LAYOUT.guestNames,
  }
}

export const DIMS = {
  PORTRAIT: { w: 105, h: 148 },
  LANDSCAPE: { w: 148, h: 105 },
} as const
export type Orientation = keyof typeof DIMS

export const ELEMENTS = [
  { key: 'qr', label: 'QR Code', unit: 'mm', min: 20, max: 105 },
  { key: 'inviteUrl', label: 'Invite URL', unit: 'pt', min: 4, max: 72 },
  { key: 'guestNames', label: 'Guest Names', unit: 'pt', min: 4, max: 72 },
] as const
