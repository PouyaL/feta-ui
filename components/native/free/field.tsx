import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInUp, FadeOut, ZoomIn } from 'react-native-reanimated'
import { space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { Label, iconFor, type LabelProps } from './label'

const MESSAGE_MS = 180
const OUT = Easing.bezierFn(0.23, 1, 0.32, 1)

export type FieldLink = { hint: string | undefined; invalid: boolean; disabled: boolean; required: boolean; onFocus: () => void; onBlur: () => void }

const FieldContext = createContext<FieldLink | null>(null)

/** Merges a control's own props with its Field, if it has one. */
export function useFieldControl({ invalid, disabled, required }: { invalid?: boolean | undefined; disabled?: boolean | undefined; required?: boolean | undefined }) {
  const field = useContext(FieldContext)
  return {
    invalid: invalid ?? field?.invalid ?? false,
    disabled: disabled ?? field?.disabled ?? false,
    required: required ?? field?.required ?? false,
    hint: field?.hint,
    onFocus: field?.onFocus,
    onBlur: field?.onBlur,
  }
}

export type FieldProps = {
  label: ReactNode
  /** Help under the control. It is replaced by `error`. */
  description?: ReactNode
  /** Turns the field invalid and says what is wrong. */
  error?: ReactNode
  /** Shows a check, once the value was checked against something. */
  valid?: boolean
  required?: boolean
  disabled?: boolean
  labelProps?: Omit<LabelProps, 'children' | 'required' | 'invalid' | 'disabled' | 'focused' | 'animated'>
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
  /** The control: Input, Textarea, Select or Combobox. */
  children: ReactNode
}

const errorIn = FadeInUp.duration(MESSAGE_MS).easing(OUT).withInitialValues({ opacity: 0, transform: [{ translateY: -4 }] })
const validIn = ZoomIn.springify().stiffness(420).damping(26).mass(1).withInitialValues({ transform: [{ scale: 0.6 }] })

/** Ties a label, a control and help text together so they read and validate as one. */
export function Field({ label, description, error, valid, required = false, disabled = false, labelProps, renderIcon, animated = true, style, children }: FieldProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [focused, setFocused] = useState(false)
  const invalid = Boolean(error)
  const help = invalid ? error : description
  const link = useMemo<FieldLink>(() => ({
    hint: typeof help === 'string' ? help : undefined,
    invalid,
    disabled,
    required,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  }), [help, invalid, disabled, required])

  return (
    <View style={[styles.field, style]}>
      <View style={styles.head}>
        <Label {...labelProps} {...(renderIcon ? { renderIcon } : {})} required={required} invalid={invalid} disabled={disabled} focused={focused} animated={animated}>{label}</Label>
      </View>
      <View style={styles.body}>
        <FieldContext.Provider value={link}>
          <View style={styles.control}>
            {children}
            {valid ? (
              <Animated.View {...(still ? {} : { entering: validIn, exiting: FadeOut.duration(MESSAGE_MS) })} accessible accessibilityLabel="Valid" style={styles.valid}>
                {iconFor(renderIcon, 'tick-02', 16, colors.success)}
              </Animated.View>
            ) : null}
          </View>
        </FieldContext.Provider>
        {invalid ? (
          <Animated.View key="error" {...(still ? {} : { entering: errorIn, exiting: FadeOut.duration(MESSAGE_MS) })} accessibilityLiveRegion="polite" accessibilityRole="alert" style={styles.message}>
            {iconFor(renderIcon, 'alert-circle', 14, colors.danger)}
            <Text style={styles.error}>{error}</Text>
          </Animated.View>
        ) : description ? <Text style={styles.help}>{description}</Text> : null}
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  field: { gap: space[2], width: '100%' },
  head: { paddingHorizontal: space[1] },
  body: { gap: space[1.5] },
  control: { alignItems: 'center', flexDirection: 'row' },
  valid: { position: 'absolute', right: space[3] },
  message: { alignItems: 'center', flexDirection: 'row', gap: space[1], paddingHorizontal: space[1] },
  error: { ...type(12, c.danger), flexShrink: 1 },
  help: { ...type(12, c.textSecondary), paddingHorizontal: space[1] },
})
