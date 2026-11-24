import type { ReactNode } from 'react'
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import { radius, space, type Colors } from '../kit'
import { type, useThemed } from './card'
import { Modal, ModalGrabber, useDisclosure, useModal, type DisclosureProps, type DismissReason, type ModalPose } from './dialog'
import { IconButton } from './icon-button'
import { Copy, EASE_IN, Mark, soft } from './popover'

/** The 40% black in the spec, as a share of the scrim token. */
const SCRIM = 0.73
const OPEN = { duration: 300, dampingRatio: 0.8 }
const CLOSE = { duration: 220, easing: EASE_IN }
const DRAG = { closeAt: 0.3, velocity: 500 }
const WIDTH = 380

export type DrawerSide = 'right' | 'left' | 'bottom'

const OFFSCREEN: Record<DrawerSide, ModalPose> = {
  right: { xShare: 1.1 }, left: { xShare: -1.1 }, bottom: { yShare: 1.1 },
}

export type DrawerProps = DisclosureProps & {
  title: ReactNode
  description?: ReactNode
  /** Right for details, Left for navigation, Bottom for short tasks. Phones are always Bottom. Default `right`. */
  side?: DrawerSide
  /** Actions below the card. Phones stack them with the primary first. */
  footer?: ReactNode
  /** Locks close, the back button and the scrim. */
  saving?: boolean
  /** The card scrolls and the actions stay. */
  scrollable?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

/** A panel from the edge of the screen: a floating side panel on tablets and a bottom sheet on phones. */
export function Drawer({ title, description, side = 'right', footer, saving = false, scrollable = false, animated = true, style, children, ...disclosure }: DrawerProps) {
  const { open, set, opener } = useDisclosure(disclosure)
  const dismiss = (_: DismissReason): void => { if (!saving) set(false) }
  return (
    <>
      {opener}
      <Modal
        open={open}
        onDismiss={dismiss}
        placement={side}
        scrim={SCRIM}
        pose={(mobile) => {
          const away = OFFSCREEN[mobile ? 'bottom' : side]
          return { from: away, exit: away, open: OPEN, close: CLOSE }
        }}
        drag={DRAG}
        mobilePlacement="bottom"
        locked={saving}
        animated={animated}
        width={WIDTH}
      >
        <Parts title={title} description={description} footer={footer} scrollable={scrollable} style={style}>{children}</Parts>
      </Modal>
    </>
  )
}

function Parts({ title, description, footer, scrollable, style, children }: { title: ReactNode; description: ReactNode; footer: ReactNode; scrollable: boolean; style: StyleProp<ViewStyle>; children: ReactNode }) {
  const styles = useThemed(createStyles)
  const { requestClose, locked, mobile, drag, still } = useModal()
  const header = (
    <View style={styles.header}>
      <View style={styles.heading}>
        <Copy style={styles.title}>{title}</Copy>
        {description ? <Copy style={styles.description}>{description}</Copy> : null}
      </View>
      <IconButton variant="secondary" size="sm" label="Close" animated={!still} disabled={locked} icon={<Mark name="x" />} onPress={() => requestClose('close')} />
    </View>
  )
  return (
    <View style={[styles.panel, mobile && styles.panelSheet, style]}>
      {mobile && drag ? <ModalGrabber /> : null}
      {scrollable ? (
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.card} contentContainerStyle={styles.cardBody}>{header}{children}</ScrollView>
      ) : (
        <View style={[styles.card, styles.cardBody]}>{header}{children}</View>
      )}
      {footer ? <View style={[styles.footer, mobile && styles.footerStacked]}>{footer}</View> : null}
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  panel: { ...soft(c), backgroundColor: c.canvas, borderColor: c.ink8, borderRadius: radius.tray, borderWidth: 1, flexShrink: 1, padding: space[2] },
  panelSheet: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, paddingBottom: space[7] },
  card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, flexShrink: 1 },
  cardBody: { gap: space[4], padding: space[5] },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: space[3], justifyContent: 'space-between' },
  heading: { flex: 1, minWidth: 0 },
  title: { ...type(18, c.textPrimary, '600'), lineHeight: 24 },
  description: { ...type(14, c.textSecondary), lineHeight: 20, marginTop: space[0.5] },
  footer: { flexDirection: 'row', gap: space[2], paddingBottom: space[1], paddingHorizontal: space[1], paddingTop: space[2] },
  footerStacked: { flexDirection: 'column-reverse' },
})
