'use client'
import { AnimatePresence, motion, useDragControls, type DragControls, type HTMLMotionProps, type MotionStyle, type PanInfo, type Target, type Transition } from 'motion/react'
import { cloneElement, createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type HTMLAttributes, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactElement, type ReactNode, type Ref, type RefObject } from 'react'
import { useStill } from '../motion-kit/motion-kit'
import { isMobileAt } from '../popover/floating'
import styles from './modal.module.css'

export type ModalPlacement = 'center' | 'bottom' | 'top' | 'left' | 'right'
export type DismissReason = 'escape' | 'scrim' | 'drag' | 'close'

/** Start and end pose of a panel, with its timing. */
export type ModalMotion = { from: Target; exit: Target; open: Transition; close: Transition }

/** Rubber band above the top, from the Drawer and Bottom Sheet Motion frames. */
const RUBBER = 0.3
const SCRIM_FADE = { duration: 0.2, ease: [0.22, 1, 0.36, 1] } as const
const SCRIM_OUT = { duration: 0.16, ease: [0.65, 0, 0.35, 1] } as const

type ModalContextValue = {
  mobile: boolean
  still: boolean
  titleId: string
  descriptionId: string
  /** Close button and tray actions call this. */
  requestClose: (reason: DismissReason) => void
  locked: boolean
  drag: DragControls | null
}

const ModalContext = createContext<ModalContextValue | null>(null)

export function useModal(): ModalContextValue {
  const value = useContext(ModalContext)
  if (!value) throw new Error('This part must be used inside a modal.')
  return value
}

// Several modals can stack, so the page unlocks only when the last one closes.
let locks = 0
function lockScroll(): () => void {
  const root = document.documentElement
  if (locks === 0) {
    const gutter = window.innerWidth - root.clientWidth
    root.style.overflow = 'hidden'
    if (gutter) root.style.paddingRight = `${gutter}px`
  }
  locks += 1
  return () => {
    locks -= 1
    if (locks === 0) {
      root.style.overflow = ''
      root.style.paddingRight = ''
    }
  }
}

const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'
/** Only the checked radio of a group is a Tab stop, or the first one when none is checked. */
function skipRadio(el: HTMLElement, root: HTMLElement): boolean {
  if (!(el instanceof HTMLInputElement) || el.type !== 'radio' || el.checked || !el.name) return false
  const group = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="radio"]')).filter((r) => r.name === el.name)
  return group.some((r) => r.checked) || group[0] !== el
}
const FOCUSABLE = '[data-autofocus], input:not([disabled]), textarea:not([disabled]), select:not([disabled])'

/** The first field, then the primary action, which is the last button in the footer. */
function firstStop(panel: HTMLElement): HTMLElement {
  const field = panel.querySelector<HTMLElement>(FOCUSABLE)
  if (field) return field
  const buttons = panel.querySelectorAll<HTMLElement>('[data-modal-footer] button:not([disabled])')
  return buttons[buttons.length - 1] ?? panel
}

export type ModalProps = {
  open: boolean
  /** The person tried to leave. Decide here, and set `open` to false to close. */
  onDismiss: (reason: DismissReason) => void
  role?: 'dialog' | 'alertdialog'
  label?: string
  placement?: ModalPlacement
  /** Where the panel sits on Mobile. Default `bottom` for anything that drags. */
  mobilePlacement?: ModalPlacement
  /** Share of `--feta-effect-scrim`, 0 to 1. */
  scrim?: number
  scrimBlur?: boolean
  /** Lets the page dim first. */
  panelDelay?: number
  /** Picks the panel's pose, once the platform is known. */
  pose: (mobile: boolean) => ModalMotion
  /** Pull the panel down to close. Fractions of its height, and px/s. */
  drag?: { closeAt: number; velocity: number } | false
  /** Lets the pointer drag the panel on Web too, for a docked bottom sheet with a grabber. Default `false`. */
  dragOnWeb?: boolean
  /** Where focus lands. Default: first field, then the primary action. */
  initialFocus?: (panel: HTMLElement) => HTMLElement | null
  returnFocus?: RefObject<HTMLElement | null>
  /** Replaces the default panel, for a sheet that owns its own heights. */
  renderPanel?: (context: ModalContextValue) => ReactNode
  locked?: boolean
  animated?: boolean
  className?: string | undefined
  style?: MotionStyle
  children?: ReactNode
}

/**
 * The layer under Dialog, Alert Dialog, Sheet and Drawer: a native modal dialog, so the page is inert,
 * focus stays inside and it inherits theme and platform from where it sits in the DOM.
 */
export function Modal({ open, onDismiss, role = 'dialog', label, placement = 'center', mobilePlacement, scrim = 1, scrimBlur = false, panelDelay = 0, pose, drag, dragOnWeb = false, initialFocus, returnFocus, renderPanel, locked = false, animated = true, className, style, children }: ModalProps) {
  const still = useStill(animated)
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const controls = useDragControls()
  const [present, setPresent] = useState(false)
  const [mobile, setMobile] = useState<boolean | null>(null)
  if (open && !present) setPresent(true)
  const dismiss = useRef(onDismiss)
  useEffect(() => { dismiss.current = onDismiss })

  useLayoutEffect(() => {
    const node = dialog.current
    if (!present || !node) return
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    if (!node.open) node.showModal()
    setMobile(isMobileAt(node))
    const release = lockScroll()
    return () => {
      release()
      if (node.open) node.close()
      const target = returnFocus?.current ?? before
      target?.focus({ preventScroll: true })
    }
  }, [present, returnFocus])

  useLayoutEffect(() => {
    if (mobile === null || !open) return
    if (!document.getElementById(`${id}-description`)) dialog.current?.removeAttribute('aria-describedby')
    if (!panel.current) return
    const target = initialFocus?.(panel.current) ?? firstStop(panel.current)
    target.focus({ preventScroll: true })
  // Only when the panel arrives. Later renders must not steal focus back.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mobile, open])

  function finish(): void {
    setPresent(false)
    setMobile(null)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDialogElement>): void {
    if (e.key === 'Tab') { trapTab(e); return }
    if (e.key !== 'Escape') return
    e.preventDefault()
    e.stopPropagation()
    dismiss.current('escape')
  }

  // A native modal still lets Tab walk out to the browser's own controls, so wrap it here.
  function trapTab(e: KeyboardEvent<HTMLDialogElement>): void {
    const node = dialog.current
    if (!node) return
    const stops = Array.from(node.querySelectorAll<HTMLElement>(TABBABLE)).filter((el) => !el.closest('[inert]') && el.getClientRects().length > 0 && !skipRadio(el, node))
    const first = stops[0]
    const last = stops[stops.length - 1]
    if (!first || !last) { e.preventDefault(); return }
    const active = document.activeElement
    if (e.shiftKey && (active === first || !node.contains(active))) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && (active === last || !node.contains(active))) { e.preventDefault(); first.focus() }
  }

  function onScrimClick(e: MouseEvent<HTMLDivElement>): void {
    if (e.target === e.currentTarget) dismiss.current('scrim')
  }

  function onDragEnd(_: unknown, info: PanInfo): void {
    panel.current?.removeAttribute('data-dragging')
    if (!drag || !panel.current) return
    if (info.offset.y > panel.current.offsetHeight * drag.closeAt || info.velocity.y > drag.velocity) dismiss.current('drag')
  }

  const context: ModalContextValue = {
    mobile: mobile === true,
    still,
    titleId: `${id}-title`,
    descriptionId: `${id}-description`,
    requestClose: (reason) => dismiss.current(reason),
    locked,
    drag: drag ? controls : null,
  }
  const panelPose = pose(mobile === true)
  const dragProps: Pick<HTMLMotionProps<'div'>, 'drag' | 'dragControls' | 'dragListener' | 'dragConstraints' | 'dragElastic' | 'dragMomentum' | 'dragTransition' | 'onDragStart' | 'onDragEnd'> = drag && (mobile || dragOnWeb) ? {
    drag: 'y',
    dragControls: controls,
    dragListener: false,
    dragConstraints: { top: 0, bottom: 0 },
    dragElastic: { top: RUBBER, bottom: 1 },
    dragMomentum: false,
    dragTransition: still ? { bounceStiffness: 2000, bounceDamping: 100 } : { bounceStiffness: 500, bounceDamping: 40 },
    onDragStart: () => panel.current?.setAttribute('data-dragging', ''),
    onDragEnd,
  } : {}

  return (
    <dialog
      ref={dialog}
      role={role === 'alertdialog' ? 'alertdialog' : undefined}
      aria-modal="true"
      aria-label={label}
      aria-labelledby={label ? undefined : context.titleId}
      aria-describedby={context.descriptionId}
      data-mobile={mobile ? '' : undefined}
      className={styles.dialog}
      onKeyDown={onKeyDown}
      onCancel={(e) => { e.preventDefault(); dismiss.current('escape') }}
    >
      <ModalContext.Provider value={context}>
        <AnimatePresence onExitComplete={finish}>
          {open && mobile !== null ? (
            <motion.div
              key="scrim"
              data-scrim=""
              className={styles.scrim}
              data-blur={scrimBlur ? '' : undefined}
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: scrim }}
              exit={{ opacity: 0, transition: still ? { duration: 0 } : SCRIM_OUT }}
              transition={SCRIM_FADE}
              onClick={onScrimClick}
            />
          ) : null}
          {open && mobile !== null ? (renderPanel ? renderPanel(context) : (
            <motion.div
              key="panel"
              ref={panel}
              tabIndex={-1}
              data-panel=""
              data-placement={mobile && drag ? (mobilePlacement ?? 'bottom') : placement}
              data-fade={still && animated ? '' : undefined}
              className={[styles.panel, className].filter(Boolean).join(' ')}
              {...(style ? { style } : {})}
              initial={still ? false : panelPose.from}
              animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
              exit={still ? { opacity: 0, transition: { duration: 0 } } : { ...panelPose.exit, transition: panelPose.close }}
              transition={panelDelay ? { ...panelPose.open, delay: panelDelay } : panelPose.open}
              {...dragProps}
            >
              {children}
            </motion.div>
          )) : null}
        </AnimatePresence>
      </ModalContext.Provider>
    </dialog>
  )
}

/** The top bar on a bottom sheet. Decorative: every sheet also has a visible way out. */
export function ModalGrabber({ className }: { className?: string | undefined }) {
  const { drag } = useModal()
  return (
    <div className={[styles.grabber, className].filter(Boolean).join(' ')} aria-hidden="true" onPointerDown={(e: PointerEvent<HTMLDivElement>) => drag?.start(e)}>
      <span />
    </div>
  )
}

type TriggerProps = HTMLAttributes<HTMLElement> & { ref?: Ref<HTMLElement> }

export type DisclosureProps = {
  /** The element that opens it. */
  trigger?: ReactElement<TriggerProps>
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
}

/** Controlled or not, with the trigger wired up and remembered for the focus return. */
export function useDisclosure({ trigger, open: controlled, defaultOpen = false, onOpenChange }: DisclosureProps) {
  const [inner, setInner] = useState(defaultOpen)
  const open = controlled ?? inner
  const anchor = useRef<HTMLElement | null>(null)
  function set(next: boolean): void {
    setInner(next)
    onOpenChange?.(next)
  }
  const opener = trigger ? cloneElement(trigger, {
    ref: (node: HTMLElement | null) => {
      anchor.current = node
      const ref = trigger.props.ref
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    'aria-haspopup': 'dialog',
    'aria-expanded': open,
    onClick: (e: MouseEvent<HTMLElement>) => { trigger.props.onClick?.(e); set(true) },
  } as TriggerProps) : null
  return { open, set, opener, anchor }
}
