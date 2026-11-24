import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { radius, space, type Colors } from '../kit'
import { type, useThemed } from './card'

export type FieldsetProps = {
  legend: ReactNode
  description?: ReactNode
  /** Dims the group. Disable each control too: native groups do not pass it down. */
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

/** Fields grouped under a legend, in an inset card on the tray. */
export function Fieldset({ legend, description, disabled = false, style, children }: FieldsetProps) {
  const styles = useThemed(createStyles)
  return (
    <View accessibilityRole="none" aria-disabled={disabled} style={[styles.fieldset, disabled && styles.disabled, style]}>
      <Text accessibilityRole="header" style={styles.legend}>{legend}</Text>
      <View style={styles.card}>
        {description ? <Text style={styles.description}>{description}</Text> : null}
        {children}
      </View>
    </View>
  )
}

/** Fields that belong together. They stack, as they do on Mobile. */
export function FieldRow({ children }: { children: ReactNode }) {
  const styles = useThemed(createStyles)
  return <View style={styles.row}>{children}</View>
}

const createStyles = (c: Colors) => StyleSheet.create({
  fieldset: { backgroundColor: c.ink4, borderRadius: radius.tray, maxWidth: '100%', padding: space[1], width: '100%' },
  disabled: { opacity: 0.5 },
  legend: { ...type(16, c.textPrimary, '500'), paddingHorizontal: space[3], paddingVertical: space[2] },
  card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, gap: space[4], padding: space[4.5] },
  description: type(12, c.textSecondary),
  row: { gap: space[3] },
})
