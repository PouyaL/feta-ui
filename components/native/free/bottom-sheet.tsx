import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import { radius, space, useColors, type Colors } from '../kit'
import { withInk } from './button'
import { type, useThemed } from './card'
import { Modal, ModalGrabber, useDisclosure, useModal, useModalDrag, type DisclosureProps, type DismissReason, type ModalMotion } from './dialog'
import { IconButton } from './icon-button'
import { Copy, EASE_IN, EASE_OUT, Mark, soft, Tap, useCompact } from './popover'
import { Skeleton } from './skeleton'

const OPEN = { duration: 400, dampingRatio: 0.85 }
const CLOSE = { duration: 250, easing: EASE_IN }
const WIDE_OPEN = { duration: 200, easing: EASE_OUT }
const DRAG = { closeAt: 0.3, velocity: 600 }
const WIDTH = 480

const POSE_PHONE: ModalMotion = { from: { yShare: 1 }, exit: { yShare: 1 }, open: OPEN, close: CLOSE }
const POSE_WIDE: ModalMotion = { from: { opacity: 0, scale: 0.96 }, exit: { opacity: 0, scale: 0.96 }, open: WIDE_OPEN, close: CLOSE }

export type BottomSheetProps = DisclosureProps & {
  title: ReactNode
  description?: ReactNode
  /** Buttons on the tray. Keep one primary. Phones stack them, primary first. */
  footer?: ReactNode
  /** Skeleton over the content. The sheet keeps its height, so nothing jumps. */
  loading?: boolean
  /** Locks every way out while something sends. */
  locked?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

/** A panel that slides up for one focused task. Phones dock it with a grabber; tablets float it at 480. */
export function BottomSheet({ title, description, footer, loading = false, locked = false, animated = true, style, children, ...disclosure }: BottomSheetProps) {
  const { open, set, opener } = useDisclosure(disclosure)
  const dismiss = (_: DismissReason): void => { if (!locked) set(false) }
  return (
    <>
      {opener}
      <Modal open={open} onDismiss={dismiss} placement="bottom" pose={(mobile) => (mobile ? POSE_PHONE : POSE_WIDE)} drag={DRAG} locked={locked} animated={animated} width={WIDTH}>
        <Parts title={title} description={description} footer={footer} loading={loading} animated={animated} style={style}>{children}</Parts>
      </Modal>
    </>
  )
}

function Parts({ title, description, footer, loading, animated, style, children }: { title: ReactNode; description: ReactNode; footer: ReactNode; loading: boolean; animated: boolean; style: StyleProp<ViewStyle>; children: ReactNode }) {
  const styles = useThemed(createStyles)
  const { requestClose, locked, mobile, drag } = useModal()
  const pull = useModalDrag()
  const header = (
    <View style={styles.header}>
      <View style={styles.heading}>
        <Copy style={styles.title}>{title}</Copy>
        {description ? <Copy style={styles.description}>{description}</Copy> : null}
      </View>
      {mobile ? null : <IconButton variant="ghost" size="sm" label="Close" animated={animated} disabled={locked} icon={<Mark name="x" />} onPress={() => requestClose('close')} />}
    </View>
  )
  return (
    <View style={[styles.tray, mobile && styles.traySheet, style]}>
      {mobile && drag ? <ModalGrabber /> : null}
      <View style={styles.card}>
        {pull ? <GestureDetector gesture={pull}>{header}</GestureDetector> : header}
        <View aria-busy={loading} style={styles.content}>
          <View aria-hidden={loading} style={[styles.stack, loading && styles.hidden]}>{children}</View>
          {loading ? <View accessibilityLabel="Loading" style={styles.skeleton}><Skeleton width="70%" height={12} animated={animated} /><Skeleton width="100%" height={12} animated={animated} /><Skeleton width="64%" height={12} animated={animated} /></View> : null}
        </View>
      </View>
      {footer ? <View style={[styles.footer, mobile && styles.footerStacked]}>{footer}</View> : null}
    </View>
  )
}

export type BottomSheetActionProps = Omit<PressableProps, 'children' | 'style'> & {
  icon: ReactNode
  label: string
  /** `destructive` tints the tile and label. */
  tone?: 'default' | 'destructive'
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A row in an action sheet: an icon tile and a label. */
export function BottomSheetAction({ icon, label, tone = 'default', animated = true, style, disabled, ...rest }: BottomSheetActionProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const compact = useCompact()
  const destructive = tone === 'destructive'
  return (
    <Tap {...rest} animated={animated} disabled={disabled} accessibilityLabel={label} aria-disabled={Boolean(disabled)} style={[styles.action, compact && styles.actionPhone, Boolean(disabled) && styles.disabled, style]}>
      <View style={[styles.tile, compact && styles.tilePhone]}>
        {destructive ? <View style={styles.tileWash} /> : null}
        {withInk(icon, destructive ? colors.danger : colors.textSecondary)}
      </View>
      <Text style={[styles.label, destructive && styles.labelDanger]}>{label}</Text>
    </Tap>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { backgroundColor: c.muted, borderRadius: radius.sheet, flexShrink: 1, gap: space[1.5], padding: space[1.5] },
  traySheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: space[7] },
  card: { ...soft(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.tray, borderWidth: 1, flexShrink: 1, gap: space[5], padding: space[5] },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: space[3] },
  heading: { flex: 1, minWidth: 0 },
  title: { ...type(18, c.textPrimary, '600'), lineHeight: 24 },
  description: { ...type(14, c.textSecondary), lineHeight: 20, marginTop: space[0.5] },
  content: { position: 'relative' },
  stack: { gap: space[3] },
  hidden: { opacity: 0 },
  skeleton: { ...StyleSheet.absoluteFill, gap: space[3] },
  footer: { flexDirection: 'row', gap: space[2], justifyContent: 'flex-end', padding: space[1.5] },
  footerStacked: { flexDirection: 'column-reverse' },
  action: { alignItems: 'center', borderRadius: radius.control, flexDirection: 'row', gap: space[3], minHeight: 44, paddingHorizontal: space[2], paddingVertical: space[1.5] },
  actionPhone: { minHeight: 52 },
  disabled: { opacity: 0.4 },
  tile: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.field, height: 28, justifyContent: 'center', overflow: 'hidden', width: 28 },
  tilePhone: { borderRadius: radius.control, height: 32, width: 32 },
  tileWash: { ...StyleSheet.absoluteFill, backgroundColor: c.danger, opacity: 0.15 },
  label: { ...type(14, c.textPrimary, '500'), flexShrink: 1, lineHeight: 20 },
  labelDanger: { color: c.danger },
})
