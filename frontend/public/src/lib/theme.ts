import { useEffect } from 'react'
import { useSiteConfig } from '../api/hooks'

/** The 10 custom fonts bundled as static assets (public/fonts/) -- kept in sync with the
 * backend's SITE_FONTS set (InternalDataController.java) and the planner UI's own copy of this
 * list (frontend/internal/src/pages/site/SitePage.tsx). `css` is the actual font-family name
 * embedded in each .ttf (verified against the file's own name table), quoted where it contains
 * spaces, with a generic cursive/serif fallback for the rare case the font fails to load. */
export const FONT_FAMILIES: Record<string, { css: string; label: string }> = {
  TANGERINE: { css: "'Tangerine', cursive", label: 'Tangerine' },
  ROUGE_SCRIPT: { css: "'Rouge Script', cursive", label: 'Rouge Script' },
  MONSIEUR_LA_DOULAISE: { css: "'Monsieur La Doulaise', cursive", label: 'Monsieur La Doulaise' },
  GWENDOLYN: { css: "'Gwendolyn', cursive", label: 'Gwendolyn' },
  EPHESIS: { css: "'Ephesis', cursive", label: 'Ephesis' },
  LAVISHLY_YOURS: { css: "'Lavishly Yours', cursive", label: 'Lavishly Yours' },
  OOOH_BABY: { css: "'Oooh Baby', cursive", label: 'Oooh Baby' },
  CARATTERE: { css: "'Carattere', cursive", label: 'Carattere' },
  BIRTHSTONE: { css: "'Birthstone', cursive", label: 'Birthstone' },
  BILBO_SWASH_CAPS: { css: "'Bilbo Swash Caps', cursive", label: 'Bilbo Swash Caps' },
}

type FontSize = 'SMALL' | 'MEDIUM' | 'LARGE'

/** Site font size scales the whole document root (see useSiteTheme below) since Tailwind's
 * rem-based sizing utilities are always relative to <html>, never to an ancestor wrapper. */
const SITE_FONT_SIZE_PX: Record<FontSize, number> = { SMALL: 15, MEDIUM: 16, LARGE: 18 }

/** Header size instead maps to a Tailwind text-size class applied directly to each nav item
 * (NAV_ITEM_CLASS in App.tsx), since the header is a small, self-contained piece of markup with
 * no existing opacity-modified classes to preserve -- no CSS variable needed for it. */
export const HEADER_FONT_SIZE_CLASS: Record<FontSize, string> = { SMALL: 'text-xs', MEDIUM: 'text-sm', LARGE: 'text-base' }

function isFontSize(v: unknown): v is FontSize {
  return v === 'SMALL' || v === 'MEDIUM' || v === 'LARGE'
}

/** Parses '#rgb'/'#rrggbb' (with or without '#') into the space-separated "R G B" triplet
 * Tailwind's rgb(var(--x) / <alpha-value>) idiom requires -- a hex string fed directly into that
 * function is invalid CSS and would silently break every opacity-modified class site-wide, not
 * just the one changed. Returns undefined on anything unparseable so the caller omits the
 * variable entirely and the Tailwind config's own fallback color applies, failing safe against a
 * stray malformed value without needing backend format validation. */
export function hexToRgbTriplet(hex?: string | null): string | undefined {
  if (!hex) return undefined
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return undefined
  let h = m[1]
  if (h.length === 3) h = h.split('').map(c => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

/** A CSS custom property must never be set to '' -- var(--x, fallback) only falls back when
 * --x is *unset*, not empty -- so this always removes rather than assigns an empty value. */
function setOrRemove(style: CSSStyleDeclaration, name: string, value: string | undefined) {
  if (value) style.setProperty(name, value)
  else style.removeProperty(name)
}

export interface HeaderTheme {
  style: React.CSSProperties
  sizeClass: string
  /** Present only when header_font_color is set -- callers should keep today's fixed
   * text-accent/text-ink classes when this is undefined, so an unthemed site is byte-identical
   * to before this feature existed. */
  color?: string
  inactiveColor?: string
}

/** Applies the planner's site-wide styling settings, scoped to wherever it's called from. Must
 * only be called inside the authenticated tree (i.e. from Layout, which already calls
 * useSiteConfig for the nav) -- /unlock never mounts Layout, so it's
 * automatically unaffected by any of this, with no extra scoping logic needed. Site font SIZE is
 * the one setting that must genuinely mutate the document root (see SITE_FONT_SIZE_PX's
 * comment); site colors/font-family use CSS variables which -- because bg-paper/text-ink are
 * applied on <body> and rem doesn't cascade from a wrapper anyway -- are set at the same root
 * rather than on a scoped element, for one single mechanism instead of two. */
export function useSiteTheme(): HeaderTheme {
  const { data } = useSiteConfig()
  const settings = data?.settings

  useEffect(() => {
    const root = document.documentElement.style
    setOrRemove(root, '--color-ink', hexToRgbTriplet(settings?.site_font_color))
    setOrRemove(root, '--color-paper', hexToRgbTriplet(settings?.site_bg_color))
    const font = settings?.site_font_family ? FONT_FAMILIES[settings.site_font_family]?.css : undefined
    setOrRemove(root, '--font-site', font)
    root.fontSize = isFontSize(settings?.site_font_size) ? `${SITE_FONT_SIZE_PX[settings.site_font_size]}px` : ''
    setOrRemove(root, '--color-tile-bg', hexToRgbTriplet(settings?.tile_bg_color))
    setOrRemove(root, '--color-tile-border', hexToRgbTriplet(settings?.tile_border_color))

    return () => {
      root.removeProperty('--color-ink')
      root.removeProperty('--color-paper')
      root.removeProperty('--font-site')
      root.fontSize = ''
      root.removeProperty('--color-tile-bg')
      root.removeProperty('--color-tile-border')
    }
  }, [settings?.site_font_color, settings?.site_bg_color, settings?.site_font_family, settings?.site_font_size, settings?.tile_bg_color, settings?.tile_border_color])

  const headerFamily = settings?.header_font_family ? FONT_FAMILIES[settings.header_font_family]?.css : undefined
  const headerColorRgb = hexToRgbTriplet(settings?.header_font_color)
  return {
    style: {
      backgroundColor: settings?.header_bg_color ? `${settings.header_bg_color}f2` : undefined, // ~95% alpha, matches today's bg-paper/95 translucency
      fontFamily: headerFamily,
    },
    sizeClass: isFontSize(settings?.header_font_size) ? HEADER_FONT_SIZE_CLASS[settings.header_font_size] : 'text-sm',
    color: settings?.header_font_color || undefined,
    inactiveColor: headerColorRgb ? `rgb(${headerColorRgb} / 0.6)` : undefined,
  }
}
