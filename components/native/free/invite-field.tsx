import { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, type TextInputInstance, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Button } from './button'
import { EASE_STANDARD, ROW_MS, panelEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { Select } from './select'

export const isEmail = (text: string): boolean => /^[^\s@,]+@[^\s@,]+\.[^\s@,]{2,}$/.test(text)
export const splitEmails = (text: string): string[] => text.split(/[\s,;]+/).map((part) => part.trim()).filter(Boolean)

export type InviteFieldProps = {
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (emails: string[]) => void
  roles?: string[]
  defaultRole?: string
  label?: string
  placeholder?: string
  help?: string
  sendLabel?: (count: number) => string
  renderIcon: RenderIcon
  onSend?: (emails: string[], role: string) => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const defaultSendLabel = (count: number): string => (count === 0 ? 'Send invites' : count > 1 ? `Send ${count} invites` : 'Send invite')

/** A wrapping box of email chips, a role Select and Send. Send waits until every address is valid. */
export function InviteField({ value, defaultValue = [], onValueChange, roles = ['Admin', 'Member', 'Viewer'], defaultRole = 'Member', label = 'Invite by email', placeholder = 'name@company.com, separated by commas', help = 'Invites expire after 7 days', sendLabel = defaultSendLabel, renderIcon, onSend, animated = true, style }: InviteFieldProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const input = useRef<TextInputInstance>(null)
  const [held, setHeld] = useState(defaultValue)
  const [text, setText] = useState('')
  const [role, setRole] = useState(defaultRole)
  const emails = value ?? held
  const bad = emails.filter((email) => !isEmail(email))

  function commit(next: string[]): void {
    setHeld(next)
    onValueChange?.(next)
  }

  function add(raw: string): void {
    const fresh = splitEmails(raw).filter((email) => !emails.includes(email))
    if (fresh.length) commit([...emails, ...fresh])
    setText('')
  }

  /** Software keyboards send no key events, so a separator typed or pasted commits here. */
  function onChangeText(next: string): void {
    if (/[\s,;]/.test(next)) add(next)
    else setText(next)
  }

  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="none" onPress={() => input.current?.focus()} style={styles.box}>
        {emails.map((email) => {
          const wrong = !isEmail(email)
          return (
            <Animated.View key={email} {...(still ? {} : { entering: ZoomIn.duration(ROW_MS).easing(EASE_STANDARD), exiting: FadeOut.duration(ROW_MS) })} style={[styles.chip, wrong && styles.chipWrong]}>
              <Text style={[styles.chipText, wrong && styles.wrong]}>{email}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${email}`} hitSlop={space[3]} onPress={() => { commit(emails.filter((entry) => entry !== email)); input.current?.focus() }}>{renderIcon('x', 12)}</Pressable>
            </Animated.View>
          )
        })}
        <TextInput
          ref={input}
          accessibilityLabel={label}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          keyboardType="email-address"
          onBlur={() => { if (text.trim()) add(text) }}
          onChangeText={onChangeText}
          onKeyPress={({ nativeEvent }) => { if (nativeEvent.key === 'Backspace' && !text && emails.length) commit(emails.slice(0, -1)) }}
          onSubmitEditing={() => add(text)}
          placeholder={emails.length ? 'Add more' : placeholder}
          style={styles.input}
          submitBehavior="submit"
          value={text}
        />
      </Pressable>
      <Text accessibilityLiveRegion="polite" style={[styles.help, bad.length > 0 && styles.wrong]}>{bad.length ? `${bad.join(', ')} ${bad.length > 1 ? 'are' : 'is'} not a valid email` : emails.length ? `${emails.length} ${emails.length === 1 ? 'person' : 'people'} will join as ${role}` : help}</Text>
      <View style={styles.actions}>
        <Select style={styles.role} accessibilityLabel="Role" options={roles.map((entry) => ({ value: entry, label: entry }))} value={role} onValueChange={setRole} animated={animated} />
        <Button shape="pill" animated={animated} disabled={emails.length === 0 || bad.length > 0} feedback={{ loading: 'Sending', success: emails.length > 1 ? 'Invites sent' : 'Invite sent' }} onPress={() => onSend?.(emails, role)}>{sendLabel(emails.length)}</Button>
      </View>
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  field: { gap: space[2] },
  label: type(14, c.textPrimary, '500'),
  box: { alignItems: 'center', backgroundColor: c.surface, borderColor: c.ink10, borderRadius: radius.control, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', gap: space[1.5], minHeight: 44, padding: space[2] },
  chip: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, flexDirection: 'row', gap: space[1], paddingHorizontal: space[2.5], paddingVertical: space[1] },
  chipWrong: { borderColor: c.danger, borderWidth: 1 },
  chipText: type(12, c.textPrimary),
  wrong: { color: c.danger },
  // A set height, so the single line input is never shorter than its glyphs inside the wrapping row.
  input: { ...type(14, c.textPrimary), flexGrow: 1, minHeight: 28, minWidth: 120, padding: 0 },
  help: type(12, c.textSecondary),
  actions: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  // The role picker takes the room the Send button leaves, as `.role { flex: 1; min-width: 0 }` on the web.
  role: { flexBasis: 0, flexGrow: 1, flexShrink: 1, minWidth: 0 },
})
