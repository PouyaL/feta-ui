import type { ReactNode } from 'react'
import { StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import { radius, type Colors } from '../kit'
import { useThemed } from './card'
import { Field } from './field'
import { Select, type SelectOption } from './select'

export type DropdownOption = { value: string; label: string; /** Shown in a 24 px tile. */ emoji?: string; disabled?: boolean }

export type DropdownProps = {
  label: ReactNode
  options: DropdownOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  /** Shown under the field, in danger. */
  error?: ReactNode
  disabled?: boolean
  /** The note beside the label when disabled. */
  lockedLabel?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Picks one option from a short list of one line text or emoji labels. */
export function Dropdown({ label, options, value, defaultValue, onValueChange, placeholder = 'Select', error, disabled = false, lockedLabel = 'Locked', animated = true, style }: DropdownProps) {
  const styles = useThemed(createStyles)
  const rows: SelectOption[] = options.map(({ emoji, ...option }) => ({ ...option, ...(emoji ? { icon: <Text style={styles.tile} accessibilityElementsHidden importantForAccessibility="no">{emoji}</Text> } : {}) }))
  return (
    <Field label={label} error={error} disabled={disabled} animated={animated} {...(disabled ? { labelProps: { badge: lockedLabel } } : {})} {...(style ? { style } : {})}>
      <Select options={rows} placeholder={placeholder} animated={animated} {...(value === undefined ? {} : { value })} {...(defaultValue === undefined ? {} : { defaultValue })} {...(onValueChange ? { onValueChange } : {})} />
    </Field>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tile: { backgroundColor: c.ink5, borderRadius: radius.md, fontSize: 14, height: 24, lineHeight: 24, overflow: 'hidden', textAlign: 'center', width: 24 },
})
