'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useId, useState, type ReactNode } from 'react'
import { ease } from '../../motion-tokens'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Tooltip } from '../tooltip/tooltip'
import { NavItem } from './nav-item'
import styles from './sidebar.module.css'

export { NavItem, type NavItemProps } from './nav-item'

const COLLAPSED_CLIP = 200
const COLLAPSE_S = 0.26
const FADE_S = 0.12

export type SidebarLink = { id: string; label: string; icon?: ReactNode; count?: number | string; href?: string; disabled?: boolean; items?: SidebarLink[] }
export type SidebarSection = { label?: string; links: SidebarLink[] }

export type SidebarProps = {
  sections: SidebarSection[]
  /** Brand or account row at the top. */
  header?: ReactNode
  /** Under the header, like a search field. Hidden on the rail. */
  search?: ReactNode
  /** A card above the footer, like an upgrade offer. Hidden on the rail. */
  promo?: ReactNode
  footer?: ReactNode
  /** Links under the sections, like Settings. */
  bottomLinks?: SidebarLink[]
  active?: string
  defaultActive?: string
  onNavigate?: (id: string) => void
  /** The 64 wide icon rail. */
  collapsed?: boolean
  /** `drawer` is the 320 wide Mobile layout. */
  mode?: 'rail' | 'drawer'
  /** Groups open at the start. */
  defaultOpen?: string[]
  'aria-label'?: string
  animated?: boolean
  className?: string
}

/** How people move through an app. The active surface glides between rows, and the bar collapses to an icon rail. */
export function Sidebar({ sections, header, search, promo, footer, bottomLinks = [], active, defaultActive, onNavigate, collapsed = false, mode = 'rail', defaultOpen = [], 'aria-label': label = 'Main', animated = true, className }: SidebarProps) {
  const still = useStill(animated)
  const uid = useId()
  const [held, setHeld] = useState(defaultActive)
  const [open, setOpen] = useState(defaultOpen)
  const current = active ?? held
  const rail = collapsed && mode === 'rail'
  // The clip only runs during the collapse. At rest the tray is truly 64 wide, so tooltips can leave it.
  const [settled, setSettled] = useState(rail)

  function go(id: string): void {
    setHeld(id)
    onNavigate?.(id)
  }

  const row = (link: SidebarLink): ReactNode => {
    const expanded = open.includes(link.id)
    const item = (
      <NavItem
        label={link.label}
        icon={link.icon}
        count={link.count}
        active={current === link.id || (rail && Boolean(link.items?.some((sub) => sub.id === current)))}
        disabled={link.disabled ?? false}
        href={link.items ? undefined : link.href}
        chevron={Boolean(link.items) && !rail}
        open={expanded}
        rail={rail}
        group={uid}
        animated={animated}
        onClick={() => {
          // The rail has no room for children, so a group goes straight to its first one.
          const first = rail ? link.items?.find((sub) => !sub.disabled) : undefined
          if (first) go(first.id)
          else if (link.items) { if (!rail) setOpen(expanded ? open.filter((id) => id !== link.id) : [...open, link.id]) }
          else go(link.id)
        }}
      />
    )
    return (
      <li key={link.id}>
        {rail ? <Tooltip content={link.label} side="right" animated={animated}><span className={styles.tip}>{item}</span></Tooltip> : item}
        <AnimatePresence initial={false}>
          {link.items && expanded && !rail ? (
            <motion.ul
              className={styles.subs}
              initial={still ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: still ? 0 : FADE_S } }}
              transition={{ duration: still ? 0 : FADE_S, ease: ease.out }}
            >
              {link.items.map((sub) => (
                <li key={sub.id}>
                  <NavItem kind="sub" label={sub.label} count={sub.count} active={current === sub.id} disabled={sub.disabled ?? false} href={sub.href} group={uid} animated={animated} onClick={() => go(sub.id)} />
                </li>
              ))}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </li>
    )
  }

  return (
    // The width changes at once so nothing reflows on every frame. The tray stays 264 and its clip closes.
    <nav aria-label={label} className={cx(styles.frame, className)} data-rail={rail ? '' : undefined} data-settled={rail && settled ? '' : undefined} data-mode={mode}>
      <motion.div
        className={styles.sidebar}
        initial={false}
        animate={{ clipPath: `inset(0px ${rail ? COLLAPSED_CLIP : 0}px 0px 0px round 22px)` }}
        transition={still ? { duration: 0 } : { duration: COLLAPSE_S, ease: ease.out }}
        onAnimationComplete={() => setSettled(rail)}
      >
        {header ? <div className={styles.header}>{header}</div> : null}
        {search && !rail ? <div className={styles.search}>{search}</div> : null}
        <div className={styles.scroll}>
          {sections.map((section, i) => (
            <div key={section.label ?? i} className={styles.section}>
              {section.label && !rail ? <div className={styles.sectionLabel}>{section.label}</div> : null}
              <ul className={styles.list}>{section.links.map(row)}</ul>
            </div>
          ))}
        </div>
        {promo && !rail ? <div className={styles.promo}>{promo}</div> : null}
        {bottomLinks.length ? <ul className={styles.list}>{bottomLinks.map(row)}</ul> : null}
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </motion.div>
    </nav>
  )
}

/** A person's row for the Sidebar footer or header. */
export const SidebarPerson = ({ avatar, name, detail, rail = false }: { avatar: ReactNode; name: string; detail?: string; rail?: boolean }) => (
  <span className={styles.person}>
    {avatar}
    {rail ? null : <span className={styles.personText}><strong>{name}</strong>{detail ? <span>{detail}</span> : null}</span>}
  </span>
)
