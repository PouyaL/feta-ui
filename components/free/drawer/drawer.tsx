'use client'
import { type ReactNode } from 'react'
import { XIcon } from '@fetaui/react/rounded/x'
import { Modal, ModalGrabber, useDisclosure, useModal, type DisclosureProps, type DismissReason, type ModalMotion } from '../dialog/modal'
import { IconButton } from '../icon-button/icon-button'
import { cx } from '../motion-kit/motion-kit'
import { ScrollArea } from '../scroll-area/scroll-area'
import styles from './drawer.module.css'

/** The 40% black in the spec, as a share of the scrim token. */
const SCRIM = 0.73
const OPEN = { type: 'spring', duration: 0.3, bounce: 0.2 } as const
const CLOSE = { duration: 0.22, ease: [0.4, 0, 1, 1] } as const
const DRAG = { closeAt: 0.3, velocity: 500 }

export type DrawerSide = 'right' | 'left' | 'bottom'

const OFFSCREEN: Record<DrawerSide, { x?: string; y?: string }> = {
  right: { x: '110%' }, left: { x: '-110%' }, bottom: { y: '110%' },
}

export type DrawerProps = DisclosureProps & {
  title: ReactNode
  description?: ReactNode
  /** Right for details, Left for navigation, Bottom for short tasks. Mobile is always Bottom. Default `right`. */
  side?: DrawerSide
  /** Actions below the card. Mobile stacks them with the primary first. */
  footer?: ReactNode
  /** Locks close, Esc and the scrim. */
  saving?: boolean
  /** The content scrolls under the header and the actions stay. */
  scrollable?: boolean
  /** Names the scrolling region for screen readers. Default `Drawer content`. */
  scrollLabel?: string
  animated?: boolean
  className?: string
  children: ReactNode
}

/** A panel from the edge of the screen: a floating side panel on Web and a bottom sheet on Mobile. */
export function Drawer({ title, description, side = 'right', footer, saving = false, scrollable = false, scrollLabel = 'Drawer content', animated = true, className, children, ...disclosure }: DrawerProps) {
  const { open, set, opener, anchor } = useDisclosure(disclosure)
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
          return { from: away, exit: away, open: OPEN, close: CLOSE } satisfies ModalMotion
        }}
        drag={DRAG}
        dragOnWeb={side === 'bottom'}
        mobilePlacement="bottom"
        returnFocus={anchor}
        locked={saving}
        animated={animated}
        className={cx(styles.modal, className)}
      >
        <Parts side={side} title={title} description={description} footer={footer} scrollable={scrollable} scrollLabel={scrollLabel} animated={animated}>{children}</Parts>
      </Modal>
    </>
  )
}

function Parts({ side, title, description, footer, scrollable, scrollLabel, animated, children }: { side: DrawerSide; title: ReactNode; description: ReactNode; footer: ReactNode; scrollable: boolean; scrollLabel: string; animated: boolean; children: ReactNode }) {
  const { titleId, descriptionId, requestClose, locked, mobile, drag } = useModal()
  // A Bottom drawer on Web is the Mobile sheet, sizes included, docked at 390.
  const sheet = mobile || side === 'bottom'
  return (
    <div className={styles.panel} data-sheet={sheet ? '' : undefined} data-platform={sheet && !mobile ? 'mobile' : undefined}>
      {sheet && drag ? <ModalGrabber className={styles.grabber} /> : null}
      <div className={styles.card} data-scroll={scrollable ? '' : undefined}>
        <header className={styles.header}>
          <div className={styles.heading}>
            <h2 id={titleId} className={styles.title}>{title}</h2>
            {description ? <p id={descriptionId} className={styles.description}>{description}</p> : null}
          </div>
          <IconButton variant="secondary" size="sm" label="Close" animated={animated} disabled={locked} icon={<XIcon />} onClick={() => requestClose('close')} />
        </header>
        {scrollable ? <ScrollArea label={scrollLabel} animated={animated} className={styles.scroll ?? ''}><div className={styles.scrollContent}>{children}</div></ScrollArea> : children}
      </div>
      {footer ? <footer data-modal-footer="" className={styles.footer}>{footer}</footer> : null}
    </div>
  )
}
