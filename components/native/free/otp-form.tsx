import { useEffect, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, Text, type TextInputInstance, View, type StyleProp, type ViewStyle } from 'react-native'
import { radius, space, type Colors } from '../kit'
import { Button } from './button'
import { type, useStill, useThemed } from './card'
import { InputOTP } from './input-otp'
import { LabelSwap } from './label'

const LENGTH = 6

export type OTPFormProps = {
  title?: ReactNode
  description?: ReactNode
  /** Resolve true when the code is right. */
  onVerify: (code: string) => Promise<boolean>
  onResend?: () => void
  /** Seconds before Resend is offered again. Default 60. */
  resendAfter?: number
  /** The line and link under the button. */
  help?: { text: string; action: string; onPress?: () => void }
  errorText?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Status = 'idle' | 'verifying' | 'error' | 'success'

/** A one time code card. Verify waits for all six digits, and a wrong code keeps them to fix. */
export function OTPForm({ title = 'Verify your login', description = 'Enter the code we sent to your email', onVerify, onResend, resendAfter = 60, help, errorText = 'That code did not match', animated = true, style }: OTPFormProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [wait, setWait] = useState(0)
  const alive = useRef(true)
  const entry = useRef<TextInputInstance>(null)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  // Checking disables the field, so a wrong code hands focus back for the retry.
  useEffect(() => {
    if (status === 'error') entry.current?.focus()
  }, [status])

  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((left) => left - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])

  async function verify(next: string): Promise<void> {
    if (next.length < LENGTH || status === 'verifying') return
    setStatus('verifying')
    const right = await onVerify(next).catch(() => false)
    if (alive.current) setStatus(right ? 'success' : 'error')
  }

  function resend(): void {
    setWait(resendAfter)
    onResend?.()
  }

  const verifying = status === 'verifying'
  const complete = code.length === LENGTH
  const hint = status === 'error' ? errorText : status === 'success' ? 'Verified' : complete ? 'Code complete' : 'Enter the 6 digit code'
  return (
    <View accessibilityLabel="One time code" style={[styles.card, style]}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <InputOTP ref={entry} animated={animated} invalid={status === 'error'} disabled={verifying || status === 'success'} value={code} onValueChange={(next) => { setCode(next); setStatus('idle') }} onComplete={(next) => { void verify(next) }} />
      <View style={styles.row}>
        <View accessibilityLiveRegion="polite" style={styles.status}>
          <LabelSwap swapKey={wait > 0 ? 'sent' : hint} still={still} style={[styles.message, status === 'error' && styles.messageError, status === 'success' && styles.messageSuccess]}>{wait > 0 ? 'New code sent.' : hint}</LabelSwap>
        </View>
        {wait > 0 ? <Text style={styles.count}>Resend in {Math.floor(wait / 60)}:{String(wait % 60).padStart(2, '0')}</Text> : <Button variant="ghost" size="sm" animated={animated} onPress={resend}>Resend code</Button>}
      </View>
      <Button animated={animated} style={styles.verify} disabled={!complete || status === 'success'} status={verifying ? 'loading' : 'idle'} onPress={() => { void verify(code) }}>{verifying ? 'Verifying' : 'Verify'}</Button>
      {help ? (
        <View style={styles.help}>
          <Text style={styles.helpText}>{help.text}</Text>
          <Button variant="ghost" size="sm" animated={animated} onPress={() => help.onPress?.()}>{help.action}</Button>
        </View>
      ) : null}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.frame, borderWidth: 1, paddingHorizontal: space[5], paddingVertical: space[6], width: '100%' },
  title: type(16, c.textPrimary, '500'),
  description: { ...type(14, c.textSecondary), marginBottom: space[4], marginTop: space[1] },
  row: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', marginVertical: space[2], minHeight: 32 },
  status: { flex: 1, minWidth: 0 },
  message: type(12, c.textSecondary),
  messageError: { color: c.danger },
  messageSuccess: { color: c.success },
  count: type(12, c.textSecondary, '400', true),
  verify: { width: '100%' },
  help: { alignItems: 'center', flexDirection: 'row', gap: space[0.5], justifyContent: 'center', marginTop: space[2] },
  helpText: type(12, c.textSecondary),
})
