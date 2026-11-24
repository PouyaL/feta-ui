import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { font, radius, space, type Colors } from '../kit'
import { type, useThemed } from './card'

export type TextShellProps = {
  /** The effect's name, top left. */
  name: string
  /** A mono state, top right, such as `typing` or `done`. */
  state?: string | undefined
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

/** Style Soft for every text effect: a 4% tray, a 32 header with the name and a mono state, and a body card. */
export function TextShell({ name, state, children, style }: TextShellProps) {
  const styles = useThemed(createStyles)
  return (
    <View style={[styles.tray, style]}>
      <View style={styles.header}>
        <Text numberOfLines={1} style={styles.name}>{name}</Text>
        {state ? <Text numberOfLines={1} style={styles.state}>{state}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { backgroundColor: c.ink4, borderRadius: radius.tray, padding: space[1], width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2], height: 32, justifyContent: 'space-between', paddingHorizontal: space[3] },
  name: { ...type(12, c.textPrimary, '500'), flexShrink: 1, lineHeight: 16 },
  state: { color: c.textTertiary, fontFamily: font.mono, fontSize: 11, lineHeight: 16 },
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden', paddingHorizontal: space[5], paddingVertical: space[6] },
})
