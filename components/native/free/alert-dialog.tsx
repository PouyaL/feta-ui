import { useEffect, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeInUp, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Alert, AlertBadge } from './alert'
import { Button } from './button'
import { type, useStill, useThemed } from './card'
import { Modal, ModalGrabber, useDisclosure, useModal, type DisclosureProps, type DismissReason, type ModalMotion } from './dialog'
import { Copy, EASE_IN_OUT, EASE_OUT, soft } from './popover'

const ENTER = { duration: 240, easing: EASE_OUT }
const EXIT = { duration: 160, easing: EASE_IN_OUT }
const SHEET = { stiffness: 380, damping: 36 }
const PANEL_DELAY = 40
const SHAKE_MS = 72
const SHEET_DRAG = { closeAt: 0.3, velocity: 500 }
const ERROR_IN = FadeInUp.duration(220).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: -4 }] })

const POSE_CARD: ModalMotion = { from: { opacity: 0, y: 12, scale: 0.98 }, exit: { opacity: 0, y: 6 }, open: ENTER, close: EXIT }
const POSE_SHEET: ModalMotion = { from: { yShare: 1 }, exit: { yShare: 1 }, open: SHEET, close: EXIT }

export type AlertDialogProps = DisclosureProps & {
  /** A question: "Delete chat?" */
  title: ReactNode
  description?: ReactNode
  /** `destructive` uses a danger action and ignores scrim taps. */
  tone?: 'neutral' | 'destructive'
  /** `small` is a centred 320 card with two equal actions. Phone `default` is a bottom sheet. */
  size?: 'default' | 'small'
  /** The Alert / Badge at the top. Pass `false` to hide it, or a node to replace it. */
  media?: ReactNode | false
  /** `loading` locks the dialog. `error` shows the alert and offers Try again. */
  status?: 'idle' | 'loading' | 'error'
  /** A verb that matches the title: Delete, not OK. */
  actionLabel: string
  cancelLabel?: string
  loadingLabel?: string
  retryLabel?: string
  errorTitle?: string
  errorDescription?: string
  /** Stays open: run the work, then set `status` or close it. */
  onAction?: () => void
  /** `false` turns off the panel motion and the shake. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A modal that interrupts with something important and waits for an answer. */
export function AlertDialog({ title, description, tone = 'neutral', size = 'default', media, status = 'idle', actionLabel, cancelLabel = 'Cancel', loadingLabel, retryLabel = 'Try again', errorTitle = 'That did not work', errorDescription, onAction, animated = true, style, ...disclosure }: AlertDialogProps) {
  const { open, set, opener } = useDisclosure(disclosure)
  const destructive = tone === 'destructive'
  const loading = status === 'loading'

  function dismiss(reason: DismissReason): void {
    if (loading) return
    if (reason === 'scrim' && destructive) return
    set(false)
  }

  return (
    <>
      {opener}
      <Modal
        open={open}
        onDismiss={dismiss}
        role="alertdialog"
        panelDelay={PANEL_DELAY}
        pose={(mobile) => (mobile && size === 'default' ? POSE_SHEET : POSE_CARD)}
        drag={size === 'default' ? SHEET_DRAG : false}
        locked={loading}
        animated={animated}
        width={size === 'small' ? 320 : 440}
      >
        <Body {...{ title, description, tone, size, media, status, actionLabel, cancelLabel, loadingLabel, retryLabel, errorTitle, errorDescription, animated, style }} onAction={() => onAction?.()} onCancel={() => set(false)} />
      </Modal>
    </>
  )
}

type BodyProps = Pick<AlertDialogProps, 'title' | 'description' | 'style'> & {
  errorDescription: string | undefined
  loadingLabel: string | undefined
  tone: 'neutral' | 'destructive'
  size: 'default' | 'small'
  media: ReactNode | false
  status: 'idle' | 'loading' | 'error'
  actionLabel: string
  cancelLabel: string
  retryLabel: string
  errorTitle: string
  animated: boolean
  onAction: () => void
  onCancel: () => void
}

function Body({ title, description, tone, size, media, status, actionLabel, cancelLabel, loadingLabel, retryLabel, errorTitle, errorDescription, animated, style, onAction, onCancel }: BodyProps) {
  const styles = useThemed(createStyles)
  const { mobile, drag } = useModal()
  const still = useStill(animated)
  const sheet = mobile && size === 'default'
  const small = size === 'small'
  const destructive = tone === 'destructive'
  const failed = status === 'error'
  const loading = status === 'loading'
  const shake = useSharedValue(0)

  useEffect(() => {
    if (!failed || still) return
    const beat = { duration: SHAKE_MS, easing: EASE_IN_OUT }
    shake.value = withSequence(withTiming(-4, beat), withTiming(4, beat), withTiming(-4, beat), withTiming(4, beat), withTiming(0, beat))
  }, [failed, shake, still])

  const shaking = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }))
  const buttonSize = mobile ? 'lg' : 'md'
  const mark = media === false ? null : media ?? <AlertBadge tone={destructive ? 'danger' : 'info'} size="lg" animated={animated} style={small ? styles.badgeCentered : styles.badge} />

  return (
    <Animated.View style={[styles.tray, sheet && styles.traySheet, shaking, style]}>
      {sheet && drag ? <ModalGrabber /> : null}
      <View style={[styles.card, small && styles.cardSmall]}>
        {mark}
        <View style={styles.text}>
          <Copy style={[styles.title, small && styles.centered]}>{title}</Copy>
          {description ? <Copy style={[styles.description, small && styles.centered]}>{description}</Copy> : null}
        </View>
        {failed ? (
          <Animated.View {...(still ? {} : { entering: ERROR_IN })} style={styles.error}>
            <Alert variant="inline" tone="danger" title={errorTitle} description={errorDescription} animated={animated} />
          </Animated.View>
        ) : null}
      </View>
      <View style={[styles.footer, mobile && styles.footerStacked]}>
        <View style={small && !mobile ? styles.grow : null}><Button variant="secondary" size={buttonSize} animated={animated} disabled={loading} onPress={onCancel}>{cancelLabel}</Button></View>
        <View style={small && !mobile ? styles.grow : null}><Button variant={destructive ? 'destructive' : 'primary'} size={buttonSize} animated={animated} status={loading ? 'loading' : 'idle'} loadingLabel={loadingLabel ?? actionLabel} onPress={onAction}>{failed ? retryLabel : actionLabel}</Button></View>
      </View>
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { backgroundColor: c.muted, borderRadius: radius.tray, padding: space[1] },
  traySheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingBottom: space[5], paddingHorizontal: space[1.5], paddingTop: space[1.5] },
  card: { ...soft(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, gap: space[4], paddingBottom: space[5], paddingHorizontal: space[6], paddingTop: space[6] },
  cardSmall: { alignItems: 'center' },
  text: { gap: space[1] },
  title: { ...type(18, c.textPrimary, '600'), lineHeight: 24 },
  description: { ...type(15, c.textSecondary), lineHeight: 22 },
  centered: { textAlign: 'center' },
  badge: { alignSelf: 'flex-start' },
  badgeCentered: { alignSelf: 'center' },
  error: { alignSelf: 'stretch' },
  footer: { flexDirection: 'row', gap: space[2], justifyContent: 'flex-end', paddingBottom: space[2], paddingHorizontal: space[3], paddingTop: space[3] },
  footerStacked: { flexDirection: 'column-reverse' },
  grow: { flex: 1 },
})
