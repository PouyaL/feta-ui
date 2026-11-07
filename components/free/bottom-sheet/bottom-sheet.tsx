'use client'
import { type ButtonHTMLAttributes, type ReactNode } from 'react'
import { XIcon } from '@fetaui/react/rounded/x'
import { Modal, ModalGrabber, useDisclosure, useModal, type DisclosureProps, type DismissReason, type ModalMotion } from '../dialog/modal'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Skeleton } from '../skeleton/skeleton'
import styles from './bottom-sheet.module.css'

const OPEN = { type: 'spring', duration: 0.4, bounce: 0.15 } as const
const CLOSE = { duration: 0.25, ease: [0.4, 0, 1, 1] } as const
const WEB_OPEN = { duration: 0.2, ease: [0.23, 1, 0.32, 1] } as const
const DRAG = { closeAt: 0.3, velocity: 600 }

const POSE_MOBILE: ModalMotion = { from: { y: '100%' }, exit: { y: '100%' }, open: OPEN, close: CLOSE }
const POSE_WEB: ModalMotion = { from: { opacity: 0, scale: 0.96 }, exit: { opacity: 0, scale: 0.96 }, open: WEB_OPEN, close: CLOSE }

export type BottomSheetProps = DisclosureProps & {
  title: ReactNode
  description?: ReactNode
  /** Buttons on the tray. Keep one primary. Mobile stacks them, primary first. */
  footer?: ReactNode
  /** Skeleton over the content. The sheet keeps its height, so nothing jumps. */
  loading?: boolean
  /** Locks every way out while something sends. */
  locked?: boolean
  animated?: boolean
  className?: string
  children?: ReactNode
}

/** A panel that slides up for one focused task. Mobile docks with a grabber; Web floats at 480. */
export function BottomSheet({ title, description, footer, loading = false, locked = false, animated = true, className, children, ...disclosure }: BottomSheetProps) {
  const { open, set, opener, anchor } = useDisclosure(disclosure)
  const dismiss = (_: DismissReason): void => { if (!locked) set(false) }
  return (
    <>
      {opener}
      <Modal open={open} onDismiss={dismiss} placement="bottom" pose={(mobile) => (mobile ? POSE_MOBILE : POSE_WEB)} drag={DRAG} returnFocus={anchor} locked={locked} animated={animated} className={cx(styles.modal, className)}>
        <Parts title={title} description={description} footer={footer} loading={loading} animated={animated}>{children}</Parts>
      </Modal>
    </>
  )
}

function Parts({ title, description, footer, loading, animated, children }: { title: ReactNode; description: ReactNode; footer: ReactNode; loading: boolean; animated: boolean; children: ReactNode }) {
  const { titleId, descriptionId, requestClose, locked, mobile, drag } = useModal()
  return (
    <div className={styles.tray} data-sheet={mobile ? '' : undefined}>
      {mobile && drag ? <ModalGrabber /> : null}
      <div className={styles.card}>
        <header className={styles.header} onPointerDown={(e) => { if (mobile) drag?.start(e) }}>
          <div className={styles.heading}>
            <h2 id={titleId} className={styles.title}>{title}</h2>
            {description ? <p id={descriptionId} className={styles.description}>{description}</p> : null}
          </div>
          {/* Mobile drops the close button only when a footer offers a way out. */}
          {mobile && footer ? null : <IconButton variant="ghost" size="sm" label="Close" animated={animated} disabled={locked} icon={<XIcon />} onClick={() => requestClose('close')} />}
        </header>
        <div className={styles.content} data-loading={loading ? '' : undefined} aria-busy={loading || undefined}>
          {children}
          {loading ? <span className={styles.skeleton} role="status" aria-label="Loading"><Skeleton width="70%" height={12} animated={animated} /><Skeleton width="100%" height={12} animated={animated} /><Skeleton width="64%" height={12} animated={animated} /></span> : null}
        </div>
      </div>
      {footer ? <footer data-modal-footer="" className={styles.footer}>{footer}</footer> : null}
    </div>
  )
}

export type BottomSheetActionProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: ReactNode
  label: ReactNode
  /** `destructive` tints the tile and label. */
  tone?: 'default' | 'destructive'
  animated?: boolean
}

/** A row in an action sheet: an icon tile and a label. */
export function BottomSheetAction({ icon, label, tone = 'default', animated = true, className, type = 'button', ...rest }: BottomSheetActionProps) {
  const still = useStill(animated)
  return (
    <button type={type} data-tone={tone} data-still={still ? '' : undefined} className={cx(styles.action, className)} {...rest}>
      <span className={styles.tile}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}
