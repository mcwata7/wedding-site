import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ink/paper are CSS-variable-backed (Tailwind's documented <alpha-value> idiom) so a
        // planner's site_font_color/site_bg_color setting can override them at runtime while
        // every existing opacity-modified class (text-ink/70, bg-paper/95, ...) keeps working
        // unchanged -- see src/lib/theme.ts. The var()'s own fallback is today's exact color
        // (as an "R G B" triplet, required by the rgb() function), so an unset setting renders
        // identically to before this existed. accent/maroon/brass are not planner-configurable.
        ink: 'rgb(var(--color-ink, 43 21 18) / <alpha-value>)',
        paper: 'rgb(var(--color-paper, 246 236 223) / <alpha-value>)',
        accent: '#7a2331',
        maroon: '#4a1220',
        brass: '#a8763e',
        // The "tile" card look shared by Schedule/Travel/Things To Do's cards. tileBorder's
        // fallback (43 21 18, ink's own triplet) reproduces today's border-ink/10 exactly when
        // unset, so `border-tileBorder/10` is a drop-in replacement for that class everywhere.
        tileBg: 'rgb(var(--color-tile-bg, 255 255 255) / <alpha-value>)',
        tileBorder: 'rgb(var(--color-tile-border, 43 21 18) / <alpha-value>)',
      },
      fontFamily: {
        // Wired to --font-site (src/lib/theme.ts) so a planner's chosen site_font_family
        // reskins every heading (PageHeading, the Home hero's couple names) -- but not body
        // paragraphs, which stay on the browser's default sans stack regardless (the 10
        // available fonts are decorative script faces unsuited to long-form reading). The
        // var()'s fallback is today's exact serif stack, used whenever no font is chosen.
        display: ['var(--font-site, ui-serif, Georgia, Cambria, "Times New Roman", Times, serif)'],
      },
    },
  },
  plugins: [],
} satisfies Config
