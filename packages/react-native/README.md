# @fetaui/react-native

Animated icons for React Native, drawn with [react-native-svg](https://github.com/software-mansion/react-native-svg) and animated on the UI thread with [Reanimated](https://docs.swmansion.com/react-native-reanimated/).

- **744 icons in 10 styles.** Rounded, Outlined, Filled, Sharp, Two tone, Hand drawn, Riso, Pixel, Glass and Neon, the same set as `@fetaui/react`.
- **11 motion presets.** Every icon draws itself by default; pop, wiggle, spin, bounce, slide, pulse, shake, blink, float and swap are one prop away.
- **Free when still.** A resting icon is plain SVG. Animated shapes mount only while a run plays, so a screen full of icons costs nothing per frame.
- **Accessible.** Every animation follows the system Reduce Motion setting, live. Icons are hidden from screen readers unless you name them.
- **Typed and tree shakeable.** One module per icon, with full TypeScript types.

Docs and the full catalog: **[fetaui.dev](https://fetaui.dev)**

## Install

```sh
npm install @fetaui/react-native react-native-svg react-native-reanimated react-native-worklets
```

You need React 19, React Native 0.78 or later, react-native-svg 15.12 or later and Reanimated 4. Expo SDK 54 and later include all of them: run `npx expo install react-native-svg react-native-reanimated react-native-worklets`. Reanimated's Babel plugin must be set up, as its docs describe (Expo does this for you).

## Use

```tsx
import { Pressable, Text } from 'react-native'
import { BellIcon } from '@fetaui/react-native/rounded/bell'

export function Notify() {
  return (
    <Pressable>
      <BellIcon size={28} color="#18181b" />
      <Text>Notify me</Text>
    </Pressable>
  )
}
```

Touch the bell and it draws itself. Import from `@fetaui/react-native/<style>/<icon-name>`, or from `@fetaui/react-native/<style>` for several at once.

## Props

| Prop | Default | |
|---|---|---|
| `size` | `24` | Width and height in points. |
| `color` | `#141812` | The ink. Neon recolors its glow instead. |
| `preset` | `draw` | `draw`, `pop`, `wiggle`, `spin`, `bounce`, `slide`, `pulse`, `shake`, `blink`, `float` or `swap`. Each icon also exports a suggested preset, for example `BellIconSuggestedPreset`. |
| `trigger` | `hover` | `hover` plays when a finger lands on the icon, or a pointer enters it on iPad and web. `click` plays on press. `inView` plays once after the icon first lays out. `loop` repeats. `none` plays only from the ref. |
| `speed` | `1` | `2` plays twice as fast. |
| `aria-label` | | Names the icon for screen readers. Without it the icon is hidden from them. |
| `ref` | | `startAnimation()` and `stopAnimation()`. |

```tsx
const bell = useRef<BellIconHandle>(null)

<BellIcon ref={bell} trigger="none" preset="wiggle" />
<Button title="Ring" onPress={() => bell.current?.startAnimation()} />
```

### Loops

One looping icon plays at a time, the newest winning, so a long list never animates everywhere at once. Loops pause while the app is in the background. Raise the limit, or keep every icon still, with the optional provider:

```tsx
import { FetaProvider } from '@fetaui/react-native/lib'

<FetaProvider maxLoops={3}>{children}</FetaProvider>
<FetaProvider animatedIcons={false}>{children}</FetaProvider>
```

### Reduce Motion

With Reduce Motion on, every preset becomes a 150 ms fade in place, and Neon's glow appears without its flicker.

## Differences from @fetaui/react

- A device has no CSS variables, so the theme hooks of Glass, Riso and Neon (`--feta-glass-from` and the like) are fixed at their default colors. Neon's glow still follows `color`.
- Riso's plate shift and Glass's highlight sweep stay still on React Native; every other part of each preset runs.
- `swap` crossfades between an icon's two states for its full length; it does not hold while a finger stays down.
- Phones have no hover, so `hover` plays on touch.

## Free and Pro

This package is the Free tier, open source under MIT: the 744 Interface Essential icons in all 10 styles. [fetaUI Pro](https://fetaui.dev/pricing) covers all 5,987 icons in 34 categories.

## License

MIT for fetaUI's own code and artwork. Third-party notices ship in `THIRD-PARTY-NOTICES.txt`.
