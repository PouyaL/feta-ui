'use client'
import { animate } from 'motion/react'
import { useRef, type ReactElement, type ReactNode, type RefObject } from 'react'
import { XIcon } from '@fetaui/react/rounded/x'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Modal, ModalGrabber, useDisclosure, useModal, type DismissReason, type DisclosureProps, type ModalMotion } from './modal'
import styles from './dialog.module.css'

export { Modal, ModalGrabber, useDisclosure, useModal } from './modal'

/** The 40% black in the spec, as a share of the scrim token. */
const SCRIM = 0.73
const OPEN = { duration: 0.2, ease: [0.23, 1, 0.32, 1] } as const
const CLOSE = { duration: 0.15, ease: [0.4, 0, 1, 1] } as const
const SHEET_OPEN = { type: 'spring', duration: 0.28, bounce: 0.2 } as const
const SHEET_CLOSE = { duration: 0.22, ease: [0.4, 0, 1, 1] } as const
const PULSE_UP = { duration: 0.07, ease: 'easeOut' } as const
const PULSE_BACK = { type: 'spring', duration: 0.2, bounce: 0.4 } as const
const SHEET_DRAG = { closeAt: 0.3, velocity: 600 }

const POSE_WEB: ModalMotion = { from: { opacity: 0, scale: 0.96, y: 8 }, exit: { opacity: 0, scale: 0.98 }, open: OPEN, close: CLOSE }
const POSE_MOBILE: ModalMotion = { from: { y: '100%' }, exit: { y: '100%' }, open: SHEET_OPEN, close: SHEET_CLOSE }

export type DialogHeaderProps = {
  title: ReactNode
  description?: ReactNode
  /** A 40 px tile on 5% ink, usually an icon. */
  media?: ReactNode
  /** `false` leaves Esc and a scrim click as the way out. */
  close?: boolean
  className?: string
}

/** Title, description, optional media and the close button. */
export function DialogHeader({ title, description, media, close = true, className }: DialogHeaderProps) {
  const { titleId, descriptionId, requestClose, locked, still } = useModal()
  return (
    <header className={cx(styles.header, className)}>
      {media ? <span className={styles.media}>{media}</span> : null}
      <div className={styles.heading}>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        {description ? <p id={descriptionId} className={styles.description}>{description}</p> : null}
      </div>
      {close ? <IconButton variant="secondary" size="sm" label="Close" animated={!still} disabled={locked} icon={<XIcon />} onClick={() => requestClose('close')} className={styles.close} /> : null}
    </header>
  )
}

export type DialogFooterProps = {
  /** A line of context above the actions. */
  note?: ReactNode
  /** Primary last. Mobile stacks them with the primary first. */
  children: ReactNode
  className?: string
}

/** Actions on the tray, under the inset card. */
export function DialogFooter({ note, children, className }: DialogFooterProps) {
  return (
    <footer data-modal-footer="" className={cx(styles.footer, className)}>
      {note ? <p className={styles.note}>{note}</p> : null}
      <div className={styles.actions}>{children}</div>
    </footer>
  )
}

export type DialogProps = DisclosureProps & {
  title: ReactNode
  description?: ReactNode
  media?: ReactNode
  /** `false` hides the close button. */
  close?: boolean
  /** A DialogFooter. */
  footer?: ReactElement | undefined
  /** Both pin the header with a hairline and scroll the card. `sticky` is for tray actions, `scroll` for none. */
  layout?: 'default' | 'sticky' | 'scroll'
  /** Locks close, Esc and the scrim. Set the primary's `status` to `loading` too. */
  submitting?: boolean
  /** `false` turns off every panel motion. */
  animated?: boolean
  className?: string
  children?: ReactNode
}

/** A window over the page for one focused task. On Mobile the same dialog is a bottom sheet. */
export function Dialog({ title, description, media, close = true, footer, layout = 'default', submitting = false, animated = true, className, children, ...disclosure }: DialogProps) {
  const { open, set, opener, anchor } = useDisclosure(disclosure)
  const tray = useRef<HTMLDivElement>(null)
  const still = useStill(animated)

  function dismiss(_: DismissReason): void {
    if (!submitting) { set(false); return }
    const node = tray.current
    if (!node || still) return
    void animate(node, { scale: 1.02 }, PULSE_UP).then(() => animate(node, { scale: 1 }, PULSE_BACK))
  }

  return (
    <>
      {opener}
      <Modal open={open} onDismiss={dismiss} scrim={SCRIM} scrimBlur pose={(mobile) => (mobile ? POSE_MOBILE : POSE_WEB)} drag={SHEET_DRAG} returnFocus={anchor} locked={submitting} animated={animated} className={cx(styles.modal, className)}>
        <DialogBody tray={tray} layout={layout} submitting={submitting} title={title} description={description} media={media} close={close} footer={footer}>{children}</DialogBody>
      </Modal>
    </>
  )
}

function DialogBody({ tray, layout, submitting, title, description, media, close, footer, children }: Pick<DialogProps, 'title' | 'description' | 'media' | 'close' | 'footer' | 'children'> & { tray: RefObject<HTMLDivElement | null>; layout: NonNullable<DialogProps['layout']>; submitting: boolean }) {
  const { mobile } = useModal()
  const header = <DialogHeader title={title} description={description} media={media} {...(close === undefined ? {} : { close })} />
  return (
    <div ref={tray} data-layout={layout} data-mobile-sheet={mobile ? '' : undefined} data-submitting={submitting ? '' : undefined} className={styles.tray}>
      {mobile ? <ModalGrabber /> : null}
      <div className={styles.card}>
        {header}
        {layout === 'default' ? children : <div className={styles.scroller} tabIndex={0}>{children}</div>}
      </div>
      {footer}
    </div>
  )
}
