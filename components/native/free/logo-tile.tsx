import { useMemo, type ReactNode } from 'react'
import { View, Text, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import { font, radius, space, useColors, type Colors } from '../kit'

export type LogoTileProps = {
  name: string
  /** `mark` adds a small icon before the name. Default `mark`. */
  kind?: 'mark' | 'wordmark'
  /** Replaces the mark. */
  icon?: ReactNode
  renderIcon?: RenderIcon | undefined
  style?: StyleProp<ViewStyle>
}

/** A neutral placeholder for a customer or partner logo. */
export function LogoTile({ name, kind = 'mark', icon, renderIcon, style }: LogoTileProps) {
  const styles = useStyles()
  const c = useColors()
  return (
    <View style={[styles.tile, style]}>
      {kind === 'mark' ? <View style={styles.mark}>{icon ?? <Icon name="sparkles" size={14} color={c.surface} render={renderIcon} />}</View> : null}
      <Text numberOfLines={1} style={kind === 'mark' ? styles.name : styles.wordmark}>{name}</Text>
    </View>
  )
}

/** Draws a fetaUI icon by name. This file asks for: sparkles. Left out, plain text glyphs stand in. */
export type RenderIcon = (name: string, size: number, color: string) => ReactNode

const GLYPHS: Record<string, string> = { 'sparkles': '✦' }

function Icon({ name, size, color, render }: { name: string; size: number; color: string; render: RenderIcon | undefined }) {
  const styles = useStyles()
  if (render) return <>{render(name, size, color)}</>
  const glyph = GLYPHS[name]
  return glyph ? <Text accessible={false} style={[styles.glyph, { color, fontSize: size, lineHeight: size + 2 }]}>{glyph}</Text> : null
}

const useStyles = () => {
  const colors = useColors()
  return useMemo(() => createStyles(colors), [colors])
}

const text = (size: number, lineHeight: number, weight: TextStyle['fontWeight'] = '400'): TextStyle => ({ fontFamily: font.sans, fontSize: size, lineHeight, fontWeight: weight, letterSpacing: font.tracking(size) })

const createStyles = (c: Colors) => StyleSheet.create({
  // The Mobile tile, 172 by 72: a surface with an 8% ring, the mark and name centred, as the web's Handoff.
  tile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[2.5], width: 172, maxWidth: '100%', height: 72, paddingHorizontal: space[5], borderRadius: radius['2xl'], borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  // A 24 rounded square in the name's ink, with the icon cut out in the surface colour.
  mark: { alignItems: 'center', justifyContent: 'center', width: 24, height: 24, flexShrink: 0, borderRadius: radius.lg, backgroundColor: c.textSecondary },
  name: { ...text(16, 20, '600'), color: c.textSecondary, flexShrink: 1 },
  wordmark: { ...text(18, 26, '600'), color: c.textSecondary, flexShrink: 1 },
  glyph: { fontFamily: font.sans, textAlign: 'center' },
})
