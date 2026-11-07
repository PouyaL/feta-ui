import { describe, expect, it } from 'vitest'
import { PRESETS, STYLES, type Preset as CorePreset, type Style as CoreStyle } from '@fetaui/core'
import type { Preset, Style } from './types'

// Compile time: each union must accept the other. tsc fails here if they drift.
const samePreset = (a: Preset): CorePreset => a
const sameCorePreset = (a: CorePreset): Preset => a
const sameStyle = (a: Style): CoreStyle => a
const sameCoreStyle = (a: CoreStyle): Style => a

describe('public types match core', () => {
  it('covers every preset and style', () => {
    expect(PRESETS.map((p) => samePreset(sameCorePreset(p)))).toEqual([...PRESETS])
    expect(STYLES.map((s) => sameStyle(sameCoreStyle(s)))).toEqual([...STYLES])
  })
})
