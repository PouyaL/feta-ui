'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowRightIcon } from '@fetaui/react/rounded/arrow-right'
import { LoaderIcon } from '@fetaui/react/rounded/loader'
import { SearchIcon } from '@fetaui/react/rounded/search'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { duration, ease, spring } from '../../motion-tokens'
import { Checkbox } from '../checkbox/checkbox'
import { form } from '../form-kit/form-kit'
import { useDismiss } from '../form-kit/use-dismiss'
import { cx, useStill } from '../motion-kit/motion-kit'
import { SearchField } from './search-field'
import styles from './search-styles'
import { useFocusShortcut } from './use-focus-shortcut'

export { SearchField, type SearchFieldProps } from './search-field'

const HOLD_MS = 400
const RUN_MS = 800

export type PaletteItem = { page?: PalettePage; id: string; title: string; description?: string; icon?: ReactNode; shortcut?: string; chevron?: boolean; disabled?: boolean; /** Resolve when the command has finished. */ run?: () => void | Promise<void> }
export type PaletteGroup = { label: string; items: PaletteItem[] }
/** A nested page: choosing the item opens it instead of running. */
export type PalettePage = { label: string; placeholder?: string; groups: PaletteGroup[] }

export type CommandPaletteProps = {
  groups: PaletteGroup[]
  placeholder?: string
  /** Shown when nothing matches. */
  empty?: ReactNode
  animated?: boolean
  className?: string
}

function Match({ text, query }: { text: string; query: string }) {
  const at = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (at < 0) return <>{text}</>
  return <>{text.slice(0, at)}<strong className={styles.match}>{text.slice(at, at + query.length)}</strong>{text.slice(at + query.length)}</>
}

/** Find anything and run commands: the field on the tray, results in the inset card. */
export function CommandPalette({ groups, placeholder = 'Search or run a command', empty = 'No results', animated = true, className }: CommandPaletteProps) {
  const still = useStill(animated)
  const uid = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pages, setPages] = useState<PalettePage[]>([])
  /** Only moving between pages slides the list, never the first paint. */
  const paged = useRef(false)
  const page = pages.at(-1)
  const [state, setState] = useState<Record<string, 'running' | 'done'>>({})
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  // A ref, so a second press in the same tick already sees the first run.
  const running = useRef(new Set<string>())

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (page?.groups ?? groups).map((group) => ({ ...group, items: group.items.filter((item) => !q || item.title.toLowerCase().includes(q)) })).filter((group) => group.items.length)
  }, [groups, page, query])
  const flat = shown.flatMap((group) => group.items)
  const enabled = flat.filter((item) => !item.disabled)
  const current = enabled[Math.min(active, enabled.length - 1)]

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  async function runItem(item: PaletteItem | undefined): Promise<void> {
    if (!item || item.disabled || running.current.has(item.id)) return
    if (item.page) {
      const next = item.page
      paged.current = true
      setPages((all) => [...all, next])
      setQuery('')
      setActive(0)
      return
    }
    running.current.add(item.id)
    const settle = (from: 'running' | 'done'): void => setState((s) => {
      if (s[item.id] !== from) return s
      const { [item.id]: _, ...rest } = s
      return rest
    })
    setState((s) => ({ ...s, [item.id]: 'running' }))
    try {
      await (item.run ? item.run() : new Promise<void>((done) => timers.current.push(setTimeout(done, RUN_MS))))
      setState((s) => ({ ...s, [item.id]: 'done' }))
      timers.current.push(setTimeout(() => settle('done'), HOLD_MS * 4))
    } catch {
      // `run` reports its own failure; here the spinner just stops, with no tick.
      settle('running')
    } finally {
      running.current.delete(item.id)
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((at) => Math.min(enabled.length - 1, at + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((at) => Math.max(0, at - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (!e.repeat) void runItem(current) }
    else if (e.key === 'Escape') { setQuery(''); setActive(0); setPages([]) }
    else if (e.key === 'Backspace' && !query && pages.length) { e.preventDefault(); paged.current = true; setPages((all) => all.slice(0, -1)); setActive(0) }
  }

  const listId = `${uid}-list`
  const itemId = (id: string): string => `${uid}-${id}`

  return (
    <div className={cx(styles.palette, className)} data-still={still ? '' : undefined}>
      <div className={styles.head}>
        {page ? <span className={styles.pageChip}>{page.label}</span> : <span className={form.quiet}><SearchIcon trigger="none" /></span>}
        <input
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={current ? itemId(current.id) : undefined}
          aria-label="Command"
          autoComplete="off"
          className={form.entry}
          placeholder={page?.placeholder ?? placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0) }}
          onKeyDown={onKeyDown}
        />
      </div>
      <motion.div key={pages.length} id={listId} role="listbox" aria-label="Results" className={styles.body} initial={still || !paged.current ? false : { x: 12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={still ? { duration: 0 } : spring.row}>
        <AnimatePresence initial={false} mode="popLayout">
          {flat.length ? shown.map((group) => (
            <motion.div
              key={group.label}
              role="group"
              aria-label={group.label}
              initial={still ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
              transition={{ duration: still ? 0 : duration.fast, ease: ease.out }}
            >
              <div className={styles.groupLabel}>{group.label}</div>
              {group.items.map((item) => {
                const running = state[item.id]
                const on = item === current
                return (
                  <div
                    key={item.id}
                    id={itemId(item.id)}
                    role="option"
                    aria-selected={on}
                    aria-disabled={item.disabled || undefined}
                    className={styles.item}
                    onPointerEnter={() => { if (!item.disabled) setActive(enabled.indexOf(item)) }}
                    onClick={() => void runItem(item)}
                  >
                    {on ? <motion.span {...(still ? {} : { layoutId: `${uid}-glide` })} className={form.glide} transition={spring.jump} /> : null}
                    <span className={styles.tile} data-on={on ? '' : undefined} data-done={running === 'done' ? '' : undefined}>
                      {running === 'running' ? <span className={styles.spin}><LoaderIcon trigger="none" /></span> : running === 'done' ? <Tick02Icon trigger="none" /> : item.icon}
                    </span>
                    <span className={form.itemBody}>
                      <span className={styles.title}><Match text={item.title} query={query.trim()} /></span>
                      {item.description ? <span className={styles.description}>{item.description}</span> : null}
                    </span>
                    {item.shortcut ? <kbd className={styles.kbd}>{item.shortcut}</kbd> : null}
                    {item.chevron ? <span className={form.quiet}><ArrowRightIcon trigger="none" /></span> : null}
                  </div>
                )
              })}
            </motion.div>
          )) : <motion.div key="empty" className={styles.empty} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }}>{empty}</motion.div>}
        </AnimatePresence>
      </motion.div>
      <div className={styles.footer}>
        <span className={styles.hint}><kbd className={styles.kbd}>↑↓</kbd> Move</span>
        <span className={styles.hint}><kbd className={styles.kbd}>↵</kbd> Run</span>
        {page ? <span className={styles.hint}><kbd className={styles.kbd}>⌫</kbd> Back</span> : null}
        <span className={styles.hint}><kbd className={styles.kbd}>esc</kbd> Clear</span>
      </div>
      <span className={form.srOnly} role="status">{flat.length} {flat.length === 1 ? 'result' : 'results'}</span>
    </div>
  )
}

export type MotionSearchItem = { id: string; title: string; description?: string; icon?: ReactNode }

export type MotionSearchProps = {
  items: MotionSearchItem[]
  onSelect?: (item: MotionSearchItem) => void
  placeholder?: string
  /** Shows ⌘ K and focuses the field on that key. Default true. With several fields, the newest visible one takes it. */
  shortcut?: boolean
  animated?: boolean
  className?: string
}

/** A pill that opens wide on focus or ⌘ K, with results dropping out of it. */
export function MotionSearch({ items, onSelect, placeholder = 'Search', shortcut = true, animated = true, className }: MotionSearchProps) {
  const still = useStill(animated)
  const uid = useId()
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const close = useCallback(() => setOpen(false), [])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => !q || item.title.toLowerCase().includes(q) || item.description?.toLowerCase().includes(q))
  }, [items, query])
  const current = shown[Math.min(active, shown.length - 1)]

  useDismiss(root, open, close)

  useFocusShortcut(input, shortcut)

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((at) => Math.min(shown.length - 1, at + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((at) => Math.max(0, at - 1)) }
    else if (e.key === 'Enter' && current) { e.preventDefault(); onSelect?.(current); close() }
    else if (e.key === 'Escape') { close(); input.current?.blur() }
    else if (e.key === 'Tab') close()
  }

  const listId = `${uid}-list`
  return (
    <motion.div ref={root} className={cx(styles.motion, className)} data-open={open ? '' : undefined} initial={false} animate={{ width: open ? 448 : 320 }} transition={still ? { duration: 0 } : spring.settle}>
      <div className={cx(form.pill, styles.motionField)} data-still={still ? '' : undefined}>
        <span className={form.quiet}><SearchIcon trigger="none" /></span>
        <input ref={input} role="combobox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open && current ? `${uid}-${current.id}` : undefined} aria-label={placeholder} autoComplete="off" className={form.entry} placeholder={placeholder} value={query} onFocus={() => setOpen(true)} onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true) }} onKeyDown={onKeyDown} />
        {open || !shortcut ? null : <kbd className={styles.kbd}>⌘ K</kbd>}
      </div>
      <AnimatePresence>
        {open ? (
          <motion.div key="results" className={styles.motionCard} initial={still ? false : { y: -4, scale: 0.98, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={still ? { opacity: 0, transition: { duration: 0 } } : { y: -4, scale: 0.98, opacity: 0 }} transition={still ? { duration: 0 } : spring.settle}>
            <div id={listId} role="listbox" aria-label="Results" className={styles.motionList}>
              {shown.map((item) => (
                <div key={item.id} id={`${uid}-${item.id}`} role="option" aria-selected={item === current} className={styles.item} onPointerEnter={() => setActive(shown.indexOf(item))} onClick={() => { onSelect?.(item); close() }}>
                  {item === current ? <motion.span {...(still ? {} : { layoutId: `${uid}-glide` })} className={form.glide} transition={spring.jump} /> : null}
                  {item.icon ? <span className={styles.tile}>{item.icon}</span> : null}
                  <span className={form.itemBody}><span className={styles.title}><Match text={item.title} query={query.trim()} /></span>{item.description ? <span className={styles.description}>{item.description}</span> : null}</span>
                </div>
              ))}
              {shown.length ? null : <div className={styles.empty}>No results</div>}
            </div>
            <div className={styles.footer}><span className={styles.hint}>{shown.length} {shown.length === 1 ? 'RESULT' : 'RESULTS'}</span><span className={styles.hint}><kbd className={styles.kbd}>↵</kbd> Open</span></div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <span className={form.srOnly} role="status">{open ? `${shown.length} ${shown.length === 1 ? 'result' : 'results'}` : ''}</span>
    </motion.div>
  )
}

export type ResultFacet = { label: string; options: { value: string; label: string }[] }
export type SearchResult = { id: string; title: string; path: string; snippet: string; author: string; initials: string; icon?: ReactNode; edited: number; facets: string[]; /** Where the title links to. */ href?: string }

export type SearchResultsProps = {
  query: string
  results: SearchResult[]
  facets: ResultFacet[]
  /** How long the search took, in seconds. */
  took?: number
  /** Called when a result title is pressed. */
  onOpen?: (result: SearchResult) => void
  animated?: boolean
  className?: string
}

type Sort = 'best' | 'newest' | 'az'
const SORTS: { value: Sort; label: string }[] = [{ value: 'best', label: 'Best match' }, { value: 'newest', label: 'Newest' }, { value: 'az', label: 'A to Z' }]

function Snippet({ text, query }: { text: string; query: string }) {
  const parts = query ? text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')) : [text]
  return <>{parts.map((part, i) => (i % 2 ? <strong key={i} className={styles.match}>{part}</strong> : part))}</>
}

/** A results page: filters on the left, or chips on mobile, and highlighted results. */
export function SearchResults({ query, results, facets, took, onOpen, animated = true, className }: SearchResultsProps) {
  const still = useStill(animated)
  const [text, setText] = useState(query)
  const [on, setOn] = useState<string[]>([])
  const [sort, setSort] = useState<Sort>('best')
  useEffect(() => setText(query), [query])
  const toggle = (value: string): void => setOn((all) => (all.includes(value) ? all.filter((v) => v !== value) : [...all, value]))
  const shown = useMemo(() => {
    const q = text.trim().toLowerCase()
    const list = results.filter((r) => (!q || `${r.title} ${r.snippet}`.toLowerCase().includes(q)) && facets.every((facet) => {
      const picked = facet.options.filter((option) => on.includes(option.value))
      return !picked.length || picked.some((option) => r.facets.includes(option.value))
    }))
    if (sort === 'newest') return [...list].sort((a, b) => b.edited - a.edited)
    if (sort === 'az') return [...list].sort((a, b) => a.title.localeCompare(b.title))
    return list
  }, [results, facets, on, text, sort])
  const count = (value: string): number => results.filter((r) => r.facets.includes(value)).length

  return (
    <section className={cx(styles.results, className)} aria-label="Search results" data-still={still ? '' : undefined}>
      <SearchField value={text} onValueChange={setText} shortcut={false} aria-label="Search" animated={animated} className={styles.resultsField ?? ''} />
      <div className={styles.chips}>{facets.flatMap((facet) => facet.options).map((option) => <button key={option.value} type="button" aria-pressed={on.includes(option.value)} className={styles.chip} onClick={() => toggle(option.value)}>{option.label}</button>)}</div>
      <div className={styles.resultsBody}>
        <aside className={styles.filters} aria-label="Filters">
          {facets.map((facet) => (
            <fieldset key={facet.label} className={styles.facet}>
              <legend>{facet.label}</legend>
              {facet.options.map((option) => (
                <label key={option.value} className={styles.facetRow}>
                  <Checkbox checked={on.includes(option.value)} onCheckedChange={() => toggle(option.value)} animated={animated} />
                  <span>{option.label}</span><span className={styles.facetCount}>{count(option.value)}</span>
                </label>
              ))}
            </fieldset>
          ))}
        </aside>
        <div className={styles.resultsCard}>
          <header className={styles.resultsHead}>
            <span role="status"><b>{shown.length}</b> {shown.length === 1 ? 'result' : 'results'}{took ? ` in ${took} s` : ''}</span>
            <span role="group" aria-label="Sort" className={styles.sorts}>{SORTS.map((option) => <button key={option.value} type="button" aria-pressed={sort === option.value} className={styles.sort} onClick={() => setSort(option.value)}>{option.label}</button>)}</span>
          </header>
          <ul className={styles.resultList}>
            <AnimatePresence initial={false}>
              {shown.map((result) => (
                <motion.li key={result.id} layout={!still} className={styles.result} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: still ? 0 : duration.fast } }} transition={still ? { duration: 0 } : spring.row}>
                  {result.icon ? <span className={styles.tile}>{result.icon}</span> : null}
                  <div className={styles.resultBody}>
                    <a href={result.href ?? '#'} className={styles.resultTitle} onClick={(e) => { if (!result.href) e.preventDefault(); onOpen?.(result) }}>{result.title}</a>
                    <span className={styles.description}>{result.path}</span>
                    <p className={styles.snippet}><Snippet text={result.snippet} query={text.trim()} /></p>
                    <span className={styles.author}><i aria-hidden="true">{result.initials}</i>{result.author}</span>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      </div>
    </section>
  )
}
