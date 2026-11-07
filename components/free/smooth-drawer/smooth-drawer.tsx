'use client'
import { animate, motion, useMotionValue, useTransform, type PanInfo, type ValueAnimationTransition } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { Button } from '../button/button'
import { Modal, useDisclosure, useModal, type DisclosureProps, type DismissReason, type ModalMotion } from '../dialog/modal'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './smooth-drawer.module.css'

/** The 40% black in the spec, as a share of the scrim token. */
const SCRIM = 0.73
/** Space under the Toggle row at Peek, from the frames. */
const PEEK_BOTTOM = 18
const RUBBER = 0.3
const FLICK = 500
const OPEN = { type: 'spring', duration: 0.3, bounce: 0.2 } as const
const SNAP = { type: 'spring', duration: 0.35, bounce: 0.25 } as const
/** Pixels above Peek over which the details fade in. */
const REVEAL = 80
const TOGGLE = { duration: 0.28, ease: [0.23, 1, 0.32, 1] } as const
const CLOSE = { duration: 0.22, ease: [0.4, 0, 1, 1] } as const

const UNUSED_POSE: ModalMotion = { from: {}, exit: {}, open: OPEN, close: CLOSE }

export type SmoothDrawerProps = DisclosureProps & {
  /** The summary line, like Order summary. */
  title: ReactNode
  description?: ReactNode
  /** Right of the title, like the total. */
  aside?: ReactNode
  /** Shown at Peek under the title: the main action. */
  peek: ReactNode
  /** Revealed at Expanded. */
  children: ReactNode
  /** Height at Peek. Default: measured, so Peek ends 18 px under the Order details toggle. */
  peekHeight?: number
  showLabel?: string
  hideLabel?: string
  /** Starts at Expanded. */
  defaultExpanded?: boolean
  animated?: boolean
  className?: string
}

/** A drawer with heights to drag between: Peek shows the essentials, Expanded shows everything. */
export function SmoothDrawer({ title, description, aside, peek, children, peekHeight, showLabel = 'Order details', hideLabel = 'Hide details', defaultExpanded = false, animated = true, className, ...disclosure }: SmoothDrawerProps) {
  const { open, set, opener, anchor } = useDisclosure(disclosure)
  const dismiss = (_: DismissReason): void => set(false)
  return (
    <>
      {opener}
      <Modal
        open={open}
        onDismiss={dismiss}
        placement="bottom"
        scrim={SCRIM}
        pose={() => UNUSED_POSE}
        drag={{ closeAt: 1, velocity: FLICK }}
        returnFocus={anchor}
        animated={animated}
        renderPanel={(context) => <Sheet key="panel" {...{ title, description, aside, peek, peekHeight, showLabel, hideLabel, defaultExpanded, animated, className }} close={() => context.requestClose('close')}>{children}</Sheet>}
      />
    </>
  )
}

type SheetProps = Pick<SmoothDrawerProps, 'title' | 'description' | 'aside' | 'peek' | 'children'> & {
  peekHeight: number | undefined
  showLabel: string
  hideLabel: string
  defaultExpanded: boolean
  animated: boolean
  className: string | undefined
  close: () => void
}

function Sheet({ title, description, aside, peek, children, peekHeight: fixedPeek, showLabel, hideLabel, defaultExpanded, animated, className, close }: SheetProps) {
  const { titleId, descriptionId, drag, mobile } = useModal()
  const still = useStill(animated)
  const panel = useRef<HTMLDivElement>(null)
  const y = useMotionValue(typeof window === 'undefined' ? 0 : window.innerHeight)
  const toggleRow = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  const [peekHeight, setPeekHeight] = useState(fixedPeek ?? 0)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const reveal = useTransform(y, [height - peekHeight - REVEAL, height - peekHeight], [1, 0])
  const stops = (full: number, at = peekHeight): { peek: number; closed: number } => ({ peek: Math.max(0, full - at), closed: full })

  const move = (to: number, transition: ValueAnimationTransition<number>): void => {
    if (still) y.set(to)
    else void animate(y, to, transition)
  }

  const expandedNow = useRef(expanded)
  useEffect(() => { expandedNow.current = expanded })

  /** Heights from the layout: the whole sheet, and Peek, which ends 18 px under the toggle. */
  const measure = (node: HTMLElement): { full: number; at: number } => {
    const row = toggleRow.current
    return { full: node.offsetHeight, at: fixedPeek ?? (row ? row.offsetTop + row.offsetHeight + PEEK_BOTTOM : node.offsetHeight) }
  }

  useLayoutEffect(() => {
    const node = panel.current
    if (!node) return
    const { full, at } = measure(node)
    setHeight(full)
    setPeekHeight(at)
    y.set(full)
    move(expanded ? 0 : stops(full, at).peek, OPEN)
    const target = node.querySelector<HTMLElement>('[data-modal-footer] button, [data-autofocus]') ?? node
    target.focus({ preventScroll: true })
    // Content and the viewport can change the heights: keep the sheet on its stop.
    let last = `${full}/${at}`
    const observer = new ResizeObserver(() => {
      const next = measure(node)
      if (`${next.full}/${next.at}` === last || node.hasAttribute('data-dragging')) return
      last = `${next.full}/${next.at}`
      setHeight(next.full)
      setPeekHeight(next.at)
      y.set(expandedNow.current ? 0 : stops(next.full, next.at).peek)
    })
    observer.observe(node)
    return () => observer.disconnect()
  // Runs once, when the panel arrives.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function settle(_: unknown, info: PanInfo): void {
    panel.current?.removeAttribute('data-dragging')
    const { peek: mid, closed } = stops(height)
    const here = y.get()
    let target = here > mid + peekHeight / 2 ? closed : here > mid / 2 ? mid : 0
    if (info.velocity.y > FLICK) target = here > mid ? closed : mid
    if (info.velocity.y < -FLICK) target = here > mid ? mid : 0
    if (target === closed) { close(); return }
    setExpanded(target === 0)
    move(target, SNAP)
  }

  function toggle(): void {
    const next = !expanded
    setExpanded(next)
    move(next ? 0 : stops(height).peek, TOGGLE)
  }

  return (
    <motion.div
      ref={panel}
      tabIndex={-1}
      data-expanded={expanded ? '' : undefined}
      data-mobile={mobile ? '' : undefined}
      data-still={still ? '' : undefined}
      className={cx(styles.sheet, className)}
      style={{ y }}
      drag="y"
      {...(drag ? { dragControls: drag } : {})}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: height }}
      dragElastic={{ top: RUBBER, bottom: 0 }}
      dragMomentum={false}
      onDragStart={() => panel.current?.setAttribute('data-dragging', '')}
      onDragEnd={settle}
      exit={{ y: height, transition: still ? { duration: 0 } : CLOSE }}
    >
      <div className={styles.grabber} aria-hidden="true" onPointerDown={(e) => drag?.start(e)}><span /></div>
      <header className={styles.summary} onPointerDown={(e) => drag?.start(e)}>
        <div className={styles.heading}>
          <h2 id={titleId} className={styles.title}>{title}</h2>
          {description ? <p id={descriptionId} className={styles.description}>{description}</p> : null}
        </div>
        {aside ? <div className={styles.aside}>{aside}</div> : null}
      </header>
      <div data-modal-footer="" className={styles.peek}>
        {peek}
      </div>
      <div ref={toggleRow} className={styles.toggleRow}>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={expanded}
          animated={animated}
          className={styles.toggle}
          trailingIcon={<motion.span className={styles.chevron} animate={{ rotate: expanded ? 180 : 0 }} transition={still ? { duration: 0 } : TOGGLE}><ChevronUpIcon /></motion.span>}
          onClick={toggle}
        >
          {expanded ? hideLabel : showLabel}
        </Button>
      </div>
      <motion.div className={styles.details} style={{ opacity: reveal }} inert={!expanded} tabIndex={expanded ? 0 : undefined}>{children}</motion.div>
    </motion.div>
  )
}

export type SmoothOptionProps = {
  title: ReactNode
  meta?: ReactNode
  price: ReactNode
  selected: boolean
  onSelect: () => void
  name: string
  animated?: boolean
}

/** A choice card inside the drawer. The ring moves to ink when selected. */
export function SmoothOption({ title, meta, price, selected, onSelect, name, animated = true }: SmoothOptionProps) {
  const still = useStill(animated)
  return (
    <label className={styles.option} data-selected={selected ? '' : undefined} data-still={still ? '' : undefined}>
      <input type="radio" name={name} checked={selected} onChange={onSelect} className={styles.radio} />
      <span className={styles.optionRow}><span className={styles.optionTitle}>{title}</span><span className={styles.optionPrice}>{price}</span></span>
      {meta ? <small className={styles.optionMeta}>{meta}</small> : null}
    </label>
  )
}
