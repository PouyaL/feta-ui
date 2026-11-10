# @fetaui/react

Animated icons and UI components for React, built with [Motion](https://motion.dev).

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/PouyaL/feta-ui@main/media/hero-dark.svg">
  <img src="https://cdn.jsdelivr.net/gh/PouyaL/feta-ui@main/media/hero.svg" alt="fetaUI icons drawing themselves" width="768">
</picture>

- **744 icons in 10 styles.** Rounded, Outlined, Filled, Sharp, Two tone, Hand drawn, Riso, Pixel, Glass and Neon. Every icon draws itself on hover, with 10 more motion presets to choose from.
- **194 UI components.** Buttons, forms, overlays, navigation, feedback, display, product flows and cards. Every one has motion built in.
- **No CSS setup.** Each component ships its own scoped CSS, so it works with or without Tailwind, and your app loads only what it uses.
- **Accessible.** Every animation respects `prefers-reduced-motion`. Keyboard focus plays an icon's motion when the icon sits inside a button, a link or a focusable element.
- **Built for agents.** The [fetaUI MCP server](#use-it-from-your-agent) lets Claude Code, Cursor or VS Code search, read and use every component.
- **Typed and tree shakeable.** One module per icon and per component, with full TypeScript types.

Docs, live previews and the full catalog: **[fetaui.dev](https://fetaui.dev)**

## Contents

- [Quick start](#quick-start)
- [Icons](#icons)
- [UI components](#ui-components)
- [Theming](#theming)
- [Use it from your agent](#use-it-from-your-agent)
- [Frameworks and bundle size](#frameworks-and-bundle-size)
- [Accessibility](#accessibility)
- [Free and Pro](#free-and-pro)
- [FAQ](#faq)
- [License](#license)

## Quick start

```sh
npm install @fetaui/react motion
```

You need React 19 and Motion 14 or later. Then use an icon and a component:

```tsx
import '@fetaui/react/tokens.css' // once, at the root of your app
import { Button } from '@fetaui/react/ui/button'
import { BellIcon } from '@fetaui/react/rounded/bell'

export function Notify() {
  return <Button leadingIcon={<BellIcon />}>Notify me</Button>
}
```

Hover the button, or reach it with the keyboard, and the bell draws itself.

## Icons

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/PouyaL/feta-ui@main/media/styles-dark.svg">
  <img src="https://cdn.jsdelivr.net/gh/PouyaL/feta-ui@main/media/styles.svg" alt="The bell icon in fetaUI's 10 styles" width="880">
</picture>

Import each icon from `@fetaui/react/<style>/<icon-name>`:

```tsx
import { BellIcon } from '@fetaui/react/rounded/bell'
import { BellIcon as NeonBell } from '@fetaui/react/neon/bell'

<BellIcon size={24} />
<NeonBell size={32} trigger="loop" preset="wiggle" />
```

| Style | Path | Look |
|---|---|---|
| Rounded | `rounded` | 1.5 px strokes with round caps, the base style |
| Outlined | `outlined` | Closed outlines you can fill |
| Filled | `filled` | Solid shapes |
| Sharp | `sharp` | Square caps and corners |
| Two tone | `two-tone` | The main element at full strength, the rest at 40% |
| Hand drawn | `hand-drawn` | Slightly uneven, sketched lines |
| Riso | `riso` | Ink over an offset color plate, like a risograph print |
| Pixel | `pixel` | Redrawn on a 16 × 16 pixel grid |
| Glass | `glass` | Gradient body with a highlight |
| Neon | `neon` | Glowing tubes, made for dark backgrounds |

Browse every icon, copy its SVG or React code and try its motion at [fetaui.dev/icons](https://fetaui.dev/icons).

### Props

| Prop | Default | What it does |
|---|---|---|
| `size` | `24` | Width and height in pixels |
| `color` | `currentColor` | Stroke and fill color |
| `trigger` | `hover` | When it plays: `hover`, `click`, `loop`, `inView` or `none` |
| `preset` | `draw` | How it moves (see below) |
| `speed` | `1` | Speed multiplier: `2` plays twice as fast |
| `aria-label` | none | Makes the icon an image with that name. Without it, the icon is hidden from screen readers |

Every SVG prop, like `className` or `style`, passes through to the `<svg>`.

### Presets

| Preset | Motion |
|---|---|
| `draw` | Each part traces itself, body first. The default for every icon |
| `pop` | A quick, springy scale up and back |
| `wiggle` | Swings from the top, like a ringing bell |
| `spin` | One full turn |
| `bounce` | A short hop |
| `slide` | Nudges in the direction it points |
| `pulse` | Breathes in scale and opacity, made for loops |
| `shake` | A sideways shake, for errors and warnings |
| `blink` | Squashes shut and opens, like an eye |
| `float` | Drifts up and down, made for loops |
| `swap` | Turns into its second state and back, for icons that have one |

Each icon also exports a suggested preset, for example `BellIconSuggestedPreset` is `wiggle`. Suggestions are never applied for you, so a whole set moves the same way by default.

### Triggers and control

- `hover` plays once when the pointer enters or keyboard focus reaches the closest button or link, so hovering anywhere on a control plays its icon.
- `click` plays on press. `inView` plays once when the icon is half visible.
- `loop` repeats with a short pause and pauses when less than half the icon is visible. Only one loop runs at a time across the page, so loops never compete for attention.
- `none` never plays on its own. Drive it yourself through a ref:

```tsx
import { useRef } from 'react'
import { BellIcon, type BellIconHandle } from '@fetaui/react/rounded/bell'

const bell = useRef<BellIconHandle>(null)
<BellIcon ref={bell} trigger="none" />
bell.current?.startAnimation()
```

To play an icon when its parent is hovered or focused, use `useIconHover` from `@fetaui/react/lib`:

```tsx
import { useIconHover } from '@fetaui/react/lib'

const { iconRef, handlers } = useIconHover()
<a href="/inbox" {...handlers}><BellIcon ref={iconRef} trigger="none" /> Inbox</a>
```

Wrap any part of the page in `<FetaProvider animatedIcons={false}>` to keep its icons still, or pass `maxLoops` to allow more than one loop at a time, for example on a gallery page.

## UI components

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/PouyaL/feta-ui@main/media/components-dark.gif">
  <img src="https://cdn.jsdelivr.net/gh/PouyaL/feta-ui@main/media/components.gif" alt="Hold to Confirm, Slide to Confirm, Particle Button, Vote Button, Switch and Undo Button in motion" width="1200">
</picture>

Import the design tokens once, then each component from `@fetaui/react/ui/<component-name>`:

```tsx
import '@fetaui/react/tokens.css'
import { Switch } from '@fetaui/react/ui/switch'
import { HoldToConfirm } from '@fetaui/react/ui/hold-to-confirm'
import { Toast } from '@fetaui/react/ui/toast'
```

| Group | Components | Examples |
|---|---|---|
| Buttons | 26 | Button, Icon Button, Split Button, Toggle Group, Hold to Confirm, Slide to Confirm, Particle Button |
| Forms | 37 | Input, Textarea, Select, Combobox, Checkbox, Radio Group, Switch, Slider, Date Picker, Input OTP |
| Overlays | 13 | Tooltip, Popover, Hover Card, Dialog, Alert Dialog, Sheet, Drawer, Menubar |
| Navigation | 16 | Breadcrumb, Pagination, Tabs, Navigation Menu, Sidebar |
| Feedback | 13 | Spinner, Skeleton, Alert, Toast, Progress, Empty |
| Display | 42 | Badge, Avatar, Kbd, Table, Tree View, Carousel, Code Block |
| Product | 21 | Checkout, Plan Card, Payment Method, Usage Meter, Spend Alerts |
| Cards | 26 | Card, Metric Card, Uptime Card, Consent Card, Spending Ring |

Each component's page on [fetaui.dev](https://fetaui.dev/docs/components/button) has live examples, its props, keyboard support and motion notes.

- **Scoped CSS.** Each component imports its own CSS file, so there is no stylesheet to add and no class name clash with your app. Your bundle gets only the styles of the components you use and the parts and icons they build on.
- **Client components.** Every component starts with `"use client"`, so it drops straight into the Next.js App Router.

## Theming

Everything is styled with `--feta-*` CSS variables from `tokens.css`: colors, type, radius, spacing and motion. Override any of them on `:root` or on one part of the page:

```css
:root {
  --feta-bg-surface: #fffdf8;
  --feta-text-primary: #1b1b1f;
}
```

The light theme is the default. Set `data-theme="dark"` on `<html>` for dark mode. The components are designed for the [TikTok Sans](https://fonts.google.com/specimen/TikTok+Sans) font with -0.04em letter spacing, so load it if you want them to look exactly as they do on fetaui.dev.

## Use it from your agent

The fetaUI MCP server runs at `https://fetaui.dev/mcp`. It lets your agent search every component and icon, read its docs and props, and get Free source. There is nothing to install.

**Claude Code**

```sh
claude mcp add --transport http fetaui https://fetaui.dev/mcp
```

**Cursor** (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "fetaui": { "url": "https://fetaui.dev/mcp" }
  }
}
```

**VS Code** (`.vscode/mcp.json`)

```json
{
  "servers": {
    "fetaui": { "type": "http", "url": "https://fetaui.dev/mcp" }
  }
}
```

Then ask for what you need, for example: "Build a settings page with the fetaUI Switch and a Hold to Confirm delete button."

| Tool | What it does |
|---|---|
| `search` | Finds components and icons by name or purpose, with their tier |
| `get_component` | Docs, props and source for one component |
| `get_icon` | One icon in any style: the import, usage and SVG |
| `get_started` | How to install and set up fetaUI |

With Pro, send your key as the `X-API-Key` header and the same tools return Pro source. Keep the key in an environment variable: the [installation guide](https://fetaui.dev/docs/installation#mcp) has the snippet for each editor.

## Frameworks and bundle size

- **Next.js App Router and Vite.** Also other bundlers that resolve package `exports`. Icons and components are client components, so they render on the server and animate after hydration.
- **Pages Router, Remix and Astro.** Server rendering may need the package transpiled, because components import their own CSS. In Next.js, set `transpilePackages: ['@fetaui/react']`.
- **Module formats.** The UI paths (`@fetaui/react/ui/*`) are ES modules only. Icons and `@fetaui/react/lib` also ship CommonJS.
- **Bundle size.** A single icon is typically 0.4 to 1.2 KB gzipped and at most about 2 KB (about 4 KB for Outlined), excluding Motion and the shared runtime, which loads once. Each component adds only its own code and CSS.

## Accessibility

- Every animation stops for visitors who ask for reduced motion. Looping icons show one cue, then rest.
- Keyboard focus plays an icon's motion when the icon sits inside a button, a link or a focusable element.
- Icons are `aria-hidden` by default. Pass `aria-label` when an icon carries meaning on its own.
- Components follow the WAI-ARIA patterns for their role, with full keyboard support. Each docs page lists its keys.

## Free and Pro

This package is the Free tier, open source under MIT: the 744 Interface Essential icons in all 10 styles and 194 UI components.

[fetaUI Pro](https://fetaui.dev/pricing) adds all 5,987 icons in 34 categories, Charts, AI components, Blocks and Templates, for one payment. Pro + Figma adds the Figma library.

## FAQ

**Do I need Tailwind?** No. Components use their own scoped CSS and the `--feta-*` tokens. They also sit happily next to Tailwind.

**Can I use only the icons?** Yes. Icons don't need `tokens.css`. Import them and go.

**Why is Motion a peer dependency?** So your app has one copy of Motion, shared with your own animations.

**Can I change how an icon moves?** Pass any `preset`, change `speed`, or drive it yourself with a ref.

**Is there a version for plain HTML or other frameworks?** Every Free icon is also a static SVG in the [public repository](https://github.com/PouyaL/feta-ui/tree/main/svg).

## License

MIT for fetaUI's own code. The icon shapes derive from an MIT licensed source set, and its notice ships in this package as `THIRD-PARTY-NOTICES.txt`.
