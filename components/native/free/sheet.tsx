import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { font, radius, softElevation, space, type Colors } from '../kit'
import { type, useThemed } from './card'
import { Modal, ModalGrabber, useDisclosure, useModal, type DisclosureProps, type DismissReason, type ModalMotion, type ModalPlacement, type ModalPose } from './dialog'
import { IconButton } from './icon-button'
import { Copy, EASE_IN, EASE_OUT, Mark, useCompact } from './popover'

/** The 28% in the spec, as a share of the scrim token. */
const SCRIM = 0.51
const OPEN = { duration: 320, dampingRatio: 0.7 }
const CLOSE = { duration: 220, easing: EASE_IN }
const DRAG = { closeAt: 0.4, velocity: 500 }
const WIDTH = { phone: 374, tablet: 400 }
const CONTENT_IN = FadeInDown.duration(200).delay(60).easing(EASE_OUT).withInitialValues({ transform: [{ translateY: 8 }] })

export type SheetSide = Extract<ModalPlacement, 'left' | 'right' | 'top' | 'bottom'>

const OFFSCREEN: Record<SheetSide, ModalPose> = {
  right: { xShare: 1.1 }, left: { xShare: -1.1 }, top: { yShare: -1.1 }, bottom: { yShare: 1.1 },
}

const pose = (side: SheetSide): ModalMotion => ({ from: OFFSCREEN[side], exit: OFFSCREEN[side], open: OPEN, close: CLOSE })

export type SheetProps = DisclosureProps & {
  title: ReactNode
  description?: ReactNode
  /** Default `right`. Match the side the trigger sits on. */
  side?: SheetSide
  /** Actions in the tray footer. */
  footer?: ReactNode
  /** A centred Top or Bottom sheet of this width. */
  width?: number
  /** Above the title, like a workspace name. */
  eyebrow?: ReactNode
  /** Return `false` to stop a dismiss, for example to ask about unsaved changes. */
  onBeforeClose?: (reason: DismissReason) => boolean
  /** Locks every way out while something saves. */
  locked?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
  /** Fills the inset card. */
  children: ReactNode
}

/** Content that complements the page, floating 8 px in from an edge. */
export function Sheet({ title, description, side = 'right', footer, onBeforeClose, locked = false, animated = true, style, children, eyebrow, width, ...disclosure }: SheetProps) {
  const { open, set, opener } = useDisclosure(disclosure)
  const compact = useCompact()
  function dismiss(reason: DismissReason): void {
    if (locked || onBeforeClose?.(reason) === false) return
    set(false)
  }
  return (
    <>
      {opener}
      <Modal
        open={open}
        onDismiss={dismiss}
        placement={side}
        mobilePlacement={side}
        inset={8}
        scrim={SCRIM}
        pose={() => pose(side)}
        drag={side === 'bottom' ? DRAG : false}
        locked={locked}
        animated={animated}
        width={width ?? (compact ? WIDTH.phone : WIDTH.tablet)}
      >
        <Parts side={side} title={title} description={description} footer={footer} eyebrow={eyebrow} style={style}>{children}</Parts>
      </Modal>
    </>
  )
}

function Parts({ side, title, description, footer, eyebrow, style, children }: { side: SheetSide; title: ReactNode; description: ReactNode; footer: ReactNode; eyebrow: ReactNode; style: StyleProp<ViewStyle>; children: ReactNode }) {
  const styles = useThemed(createStyles)
  const { requestClose, locked, mobile, still, drag } = useModal()
  return (
    <View style={[styles.tray, style]}>
      {mobile && side === 'bottom' && drag ? <ModalGrabber /> : null}
      <View style={styles.header}>
        <View style={styles.heading}>
          {eyebrow ? <Copy style={styles.eyebrow}>{eyebrow}</Copy> : null}
          <Copy style={styles.title}>{title}</Copy>
          {description ? <Copy style={styles.description}>{description}</Copy> : null}
        </View>
        <IconButton variant="secondary" size="sm" label="Close" animated={!still} disabled={locked} icon={<Mark name="x" />} onPress={() => requestClose('close')} />
      </View>
      <Animated.View {...(still ? {} : { entering: CONTENT_IN })} style={styles.body}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroller}>{children}</ScrollView>
      </Animated.View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { boxShadow: softElevation(c), backgroundColor: c.muted, borderRadius: radius.frame, flexGrow: 1, flexShrink: 1, padding: space[1] },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingBottom: space[2.5], paddingLeft: space[3.5], paddingRight: space[2], paddingTop: space[2.5] },
  heading: { flex: 1, minWidth: 0 },
  eyebrow: { color: c.textSecondary, fontFamily: font.mono, fontSize: 11, lineHeight: 14, marginBottom: space[0.5] },
  title: { ...type(17, c.textPrimary, '600'), lineHeight: 20 },
  description: { ...type(13, c.textSecondary), lineHeight: 18, marginTop: space[0.5] },
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.panel, borderWidth: 1, flexShrink: 1, flexGrow: 1, overflow: 'hidden' },
  scroller: { gap: space[4], padding: space[4] },
  footer: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'flex-end', paddingBottom: space[1.5], paddingHorizontal: space[1.5], paddingTop: space[2.5] },
})
