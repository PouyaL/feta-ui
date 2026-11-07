'use client'
import { motion, type MotionStyle } from 'motion/react'
import { type ReactNode } from 'react'
import { XIcon } from '@fetaui/react/rounded/x'
import { Modal, ModalGrabber, useDisclosure, useModal, type DisclosureProps, type DismissReason, type ModalMotion, type ModalPlacement } from '../dialog/modal'
import { IconButton } from '../icon-button/icon-button'
import { cx } from '../motion-kit/motion-kit'
import styles from './sheet.module.css'

/** The 28% in the spec, as a share of the scrim token. */
const SCRIM = 0.51
const OPEN = { type: 'spring', duration: 0.32, bounce: 0.3 } as const
const CLOSE = { duration: 0.22, ease: [0.4, 0, 1, 1] } as const
const CONTENT = { duration: 0.2, delay: 0.06, ease: [0.23, 1, 0.32, 1] } as const
const DRAG = { closeAt: 0.4, velocity: 500 }

const OFFSCREEN: Record<SheetSide, { x?: string; y?: string }> = {
  right: { x: '110%' }, left: { x: '-110%' }, top: { y: '-110%' }, bottom: { y: '110%' },
}

const pose = (side: SheetSide): ModalMotion => ({ from: OFFSCREEN[side], exit: OFFSCREEN[side], open: OPEN, close: CLOSE })

export type SheetSide = Extract<ModalPlacement, 'left' | 'right' | 'top' | 'bottom'>

export type SheetProps = DisclosureProps & {
  title: ReactNode
  description?: ReactNode
  /** Default `right`. Match the side the trigger sits on. */
  side?: SheetSide
  /** Actions in the tray footer. */
  footer?: ReactNode
  /** A centred Top or Bottom sheet of this width, with the body stacked. */
  width?: number
  /** Above the title, like a workspace name. */
  eyebrow?: ReactNode
  /** Return `false` to stop a dismiss, for example to ask about unsaved changes. */
  onBeforeClose?: (reason: DismissReason) => boolean
  /** Locks every way out while something saves. */
  locked?: boolean
  animated?: boolean
  className?: string
  /** Fills the inset card. */
  children: ReactNode
}

/** Content that complements the page, floating 8 px in from an edge. */
export function Sheet({ title, description, side = 'right', footer, onBeforeClose, locked = false, animated = true, className, children, eyebrow, width, ...disclosure }: SheetProps) {
  const { open, set, opener, anchor } = useDisclosure(disclosure)
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
        scrim={SCRIM}
        pose={() => pose(side)}
        drag={side === 'bottom' ? DRAG : false}
        initialFocus={(panel) => panel.querySelector<HTMLElement>('[data-sheet-title]')}
        returnFocus={anchor}
        locked={locked}
        animated={animated}
        className={cx(styles.modal, width ? styles.narrow : undefined, className)}
        {...(width ? { style: { '--modal-width': `${width}px` } as MotionStyle } : {})}
      >
        <Parts side={side} title={title} description={description} footer={footer} eyebrow={eyebrow} animated={animated}>{children}</Parts>
      </Modal>
    </>
  )
}

function Parts({ side, title, description, footer, eyebrow, animated, children }: { side: SheetSide; title: ReactNode; description: ReactNode; footer: ReactNode; eyebrow: ReactNode; animated: boolean; children: ReactNode }) {
  const { titleId, descriptionId, requestClose, locked, mobile, still, drag } = useModal()
  return (
    <div data-side={side} className={styles.tray}>
      {mobile && side === 'bottom' && drag ? <ModalGrabber className={styles.grabber} /> : null}
      <header className={styles.header}>
        <div className={styles.heading}>
          {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
          <h2 id={titleId} data-sheet-title="" tabIndex={-1} className={styles.title}>{title}</h2>
          {description ? <p id={descriptionId} className={styles.description}>{description}</p> : null}
        </div>
        <IconButton variant="secondary" size="sm" label="Close" animated={animated} disabled={locked} icon={<XIcon />} onClick={() => requestClose('close')} />
      </header>
      <motion.div className={styles.body} initial={still ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={CONTENT} tabIndex={0}>
        {children}
      </motion.div>
      {footer ? <footer data-modal-footer="" className={styles.footer}>{footer}</footer> : null}
    </div>
  )
}
