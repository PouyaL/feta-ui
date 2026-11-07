'use client'
import { animate, motion, type MotionStyle } from 'motion/react'
import { useEffect, useRef, type ReactNode } from 'react'
import { duration, ease } from '../../motion-tokens'
import { Alert, AlertBadge } from '../alert/alert'
import { Button } from '../button/button'
import { Modal, ModalGrabber, useDisclosure, useModal, type DisclosureProps, type DismissReason, type ModalMotion } from '../dialog/modal'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './alert-dialog.module.css'

const ENTER = { duration: 0.24, ease: ease['out-soft'] } as const
const EXIT = { duration: 0.16, ease: [0.65, 0, 0.35, 1] } as const
const SHEET = { type: 'spring', stiffness: 380, damping: 36 } as const
const MEDIA = { type: 'spring', stiffness: 500, damping: 26 } as const
const GROW = { duration: 0.22, ease: ease['out-soft'] } as const
const PANEL_DELAY = 0.04
const SHAKE_X = [0, -4, 4, -4, 4, 0]
const SHEET_DRAG = { closeAt: 0.3, velocity: 500 }

const POSE_CARD: ModalMotion = { from: { opacity: 0, y: 12, scale: 0.98 }, exit: { opacity: 0, y: 6 }, open: ENTER, close: EXIT }
const POSE_SHEET: ModalMotion = { from: { y: '100%' }, exit: { y: '100%' }, open: SHEET, close: EXIT }

export type AlertDialogProps = DisclosureProps & {
  /** A question: "Delete chat?" */
  title: ReactNode
  description?: ReactNode
  /** `destructive` focuses Cancel, uses a danger action and ignores scrim clicks. */
  tone?: 'neutral' | 'destructive'
  /** `small` is a centred 320 card with two equal actions. Mobile `default` is a bottom sheet. */
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
  className?: string
}

/** A modal that interrupts with something important and waits for an answer. */
export function AlertDialog({ title, description, tone = 'neutral', size = 'default', media, status = 'idle', actionLabel, cancelLabel = 'Cancel', loadingLabel, retryLabel = 'Try again', errorTitle = 'That did not work', errorDescription, onAction, animated = true, className, ...disclosure }: AlertDialogProps) {
  const { open, set, opener, anchor } = useDisclosure(disclosure)
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
        initialFocus={(panel) => panel.querySelector<HTMLElement>(destructive ? '[data-cancel]' : '[data-action]')}
        returnFocus={anchor}
        locked={loading}
        animated={animated}
        className={cx(styles.modal, className)}
        style={{ '--modal-width': size === 'small' ? '320px' : '440px' } as MotionStyle}
      >
        <Body {...{ title, description, tone, size, media, status, actionLabel, cancelLabel, loadingLabel, retryLabel, errorTitle, errorDescription, animated }} onAction={() => onAction?.()} onCancel={() => set(false)} />
      </Modal>
    </>
  )
}

type BodyProps = Pick<AlertDialogProps, 'title' | 'description'> & {
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

function Body({ title, description, tone, size, media, status, actionLabel, cancelLabel, loadingLabel, retryLabel, errorTitle, errorDescription, animated, onAction, onCancel }: BodyProps) {
  const { mobile, titleId, descriptionId, drag } = useModal()
  const still = useStill(animated)
  const tray = useRef<HTMLDivElement>(null)
  const sheet = mobile && size === 'default'
  const destructive = tone === 'destructive'
  const failed = status === 'error'
  const loading = status === 'loading'

  useEffect(() => {
    if (failed && !still && tray.current) void animate(tray.current, { x: SHAKE_X }, { duration: duration.shake, ease: 'easeInOut' })
  }, [failed, still])

  const buttonSize = mobile ? 'lg' : 'md'
  const mark = media === false ? null : media ?? (
    <motion.span className={styles.badge} initial={still ? false : { scale: 0.6 }} animate={{ scale: 1 }} transition={MEDIA}>
      <AlertBadge tone={destructive ? 'danger' : 'info'} size="lg" animated={animated} />
    </motion.span>
  )

  return (
    <div ref={tray} data-sheet={sheet ? '' : undefined} data-stack={mobile ? '' : undefined} data-size={size} className={styles.tray}>
      {sheet && drag ? <ModalGrabber /> : null}
      <div className={styles.card}>
        {mark}
        <div className={styles.text}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          {description ? <p id={descriptionId} className={styles.description}>{description}</p> : null}
        </div>
        {failed ? (
          <motion.div className={styles.error} initial={still ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={GROW}>
            <Alert variant="inline" tone="danger" title={errorTitle} description={errorDescription} animated={animated} />
          </motion.div>
        ) : null}
      </div>
      <footer data-modal-footer="" className={styles.footer}>
        <Button data-cancel="" variant="secondary" size={buttonSize} animated={animated} disabled={loading} onClick={onCancel}>{cancelLabel}</Button>
        <Button data-action="" variant={destructive ? 'destructive' : 'primary'} size={buttonSize} animated={animated} status={loading ? 'loading' : 'idle'} loadingLabel={loadingLabel ?? actionLabel} onClick={onAction}>{failed ? retryLabel : actionLabel}</Button>
      </footer>
    </div>
  )
}
