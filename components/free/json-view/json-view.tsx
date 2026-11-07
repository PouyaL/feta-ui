'use client'
import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowDownIcon } from '@fetaui/react/rounded/arrow-down'
import { ArrowUpIcon } from '@fetaui/react/rounded/arrow-up'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { CopyIcon } from '@fetaui/react/rounded/copy'
import { LinkIcon } from '@fetaui/react/rounded/link'
import { MinusIcon } from '@fetaui/react/rounded/minus'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { SearchIcon } from '@fetaui/react/rounded/search'
import { XIcon } from '@fetaui/react/rounded/x'
import { IconButton } from '../icon-button/icon-button'
import { KbdGroup } from '../kbd/kbd'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './json-view.module.css'

const SUMMARY_KEYS = 3
const ROW_INDENT = 20

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

type Row = { path: string; key: string; value: JsonValue; depth: number; open: boolean; branch: boolean }

const isBranch = (value: JsonValue): value is JsonValue[] | { [key: string]: JsonValue } => typeof value === 'object' && value !== null
const childPath = (path: string, key: string | number): string => (typeof key === 'number' ? `${path}[${key}]` : `${path}.${key}`)
const entries = (value: JsonValue[] | { [key: string]: JsonValue }): [string | number, JsonValue][] => (Array.isArray(value) ? value.map((item, i) => [i, item]) : Object.entries(value))
const typeLabel = (value: JsonValue): string => {
  if (Array.isArray(value)) return `array, ${value.length} items`
  if (value === null) return 'null'
  if (typeof value === 'object') return `object, ${Object.keys(value).length} keys`
  if (typeof value === 'string') return `string, ${value.length} chars`
  return typeof value
}
const countLabel = (value: JsonValue[] | { [key: string]: JsonValue }): string => (Array.isArray(value) ? `${value.length} items` : `${Object.keys(value).length} keys`)
const summary = (value: JsonValue[] | { [key: string]: JsonValue }): string => {
  if (Array.isArray(value)) return '[…]'
  const keys = Object.keys(value)
  return `{ ${keys.slice(0, SUMMARY_KEYS).join(', ')}${keys.length > SUMMARY_KEYS ? ', …' : ''} }`
}

function allMatches(rootName: string, root: JsonValue, query: string): string[] {
  const found: string[] = []
  const needle = query.toLowerCase()
  const walk = (path: string, key: string, value: JsonValue): void => {
    const text = isBranch(value) ? '' : String(value)
    if (key.toLowerCase().includes(needle) || text.toLowerCase().includes(needle)) found.push(path)
    if (isBranch(value)) for (const [k, v] of entries(value)) walk(childPath(path, k), String(k), v)
  }
  walk(rootName, rootName, root)
  return found
}

function Mark({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  const at = text.toLowerCase().indexOf(query.toLowerCase())
  if (at < 0) return <>{text}</>
  return <>{text.slice(0, at)}<u>{text.slice(at, at + query.length)}</u>{text.slice(at + query.length)}</>
}

const Leaf = ({ value, query }: { value: JsonValue; query: string }): ReactNode => {
  const kind = typeof value === 'string' ? 'string' : value === null ? 'punct' : 'attr'
  return <span data-json={kind}><Mark text={typeof value === 'string' ? `"${value}"` : String(value)} query={query} /></span>
}

export type JsonViewProps = {
  data: JsonValue
  /** Name of the top node, which starts every path. Default: "root". */
  rootName?: string
  /** The request line on the tray. */
  request?: { method: string; path: string; status: number; duration?: string }
  /** Key paths open at the start. Default just the root. */
  defaultOpen?: string[]
  hint?: ReactNode
  animated?: boolean
  className?: string
}

/** An API response explorer: a tree you can fold, search and copy from. */
export function JsonView({ data, rootName = 'root', request, defaultOpen, hint, animated = true, className }: JsonViewProps) {
  const still = useStill(animated)
  const tree = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState<Set<string>>(() => new Set(defaultOpen ?? [rootName]))
  const [selected, setSelected] = useState(rootName)
  const [query, setQuery] = useState('')
  const [hit, setHit] = useState(0)
  const [copied, setCopied] = useState(false)
  const searchBox = useRef<HTMLInputElement>(null)
  const matches = useMemo(() => (query ? allMatches(rootName, data, query) : []), [query, data, rootName])
  const current = matches[Math.min(hit, matches.length - 1)]
  // While searching, only the branches that lead to a match are open.
  const forced = useMemo(() => {
    const set = new Set<string>()
    for (const path of matches) for (const part of path.matchAll(/[.[]/g)) set.add(path.slice(0, part.index))
    return set
  }, [matches])

  const rows = useMemo(() => {
    const out: Row[] = []
    const onlyMatches = Boolean(query)
    const walk = (path: string, key: string, value: JsonValue, depth: number): void => {
      if (onlyMatches && !forced.has(path) && !matches.includes(path)) return
      const branch = isBranch(value)
      const shown = branch && (onlyMatches ? forced.has(path) : open.has(path))
      out.push({ path, key, value, depth, open: shown, branch })
      if (shown) for (const [k, v] of entries(value)) walk(childPath(path, k), String(k), v, depth + 1)
    }
    walk(rootName, rootName, data, 0)
    return out
  }, [data, rootName, open, forced, matches, query])

  // Cmd K works while focus is anywhere in the view, as the hint says.
  function onShortcut(e: KeyboardEvent<HTMLDivElement>): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchBox.current?.focus() }
  }

  // A selected row can fold out of view. Then the root stands in, for the tab stop and the footer.
  const selectedRow = rows.find((row) => row.path === selected)
  const selectedPath = selectedRow ? selected : rootName
  const selectedValue = selectedRow ? selectedRow.value : data

  function toggle(path: string): void {
    setOpen((set) => {
      const next = new Set(set)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function allBranches(): Set<string> {
    const set = new Set<string>()
    const walk = (path: string, value: JsonValue): void => {
      if (!isBranch(value)) return
      set.add(path)
      for (const [k, v] of entries(value)) walk(childPath(path, k), v)
    }
    walk(rootName, data)
    return set
  }

  function go(by: number): void {
    if (!matches.length) return
    const next = (hit + by + matches.length) % matches.length
    setHit(next)
    const path = matches[next]
    if (path) setSelected(path)
  }

  function move(e: KeyboardEvent<HTMLDivElement>): void {
    const at = rows.findIndex((row) => row.path === selectedPath)
    const row = rows[at]
    if (!row) return
    const target = e.key === 'ArrowDown' ? rows[at + 1] : e.key === 'ArrowUp' ? rows[at - 1] : e.key === 'Home' ? rows[0] : e.key === 'End' ? rows.at(-1) : null
    if (target) {
      e.preventDefault()
      setSelected(target.path)
      tree.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(target.path)}"]`)?.focus()
    } else if (e.key === 'ArrowRight' && row.branch && !row.open) { e.preventDefault(); toggle(row.path) } else if (e.key === 'ArrowLeft' && row.branch && row.open) { e.preventDefault(); toggle(row.path) } else if ((e.key === 'Enter' || e.key === ' ') && row.branch) { e.preventDefault(); toggle(row.path) }
  }

  const write = (text: string): void => {
    void navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => setCopied(false))
  }

  return (
    <div className={cx(styles.tray, className)} data-still={still ? '' : undefined} onKeyDown={onShortcut}>
      {request ? (
        <div className={styles.request}>
          <span className={styles.method}>{request.method}</span>
          <span className={styles.path}>{request.path}</span>
          <span aria-hidden="true" className={styles.dot} />
          <span className={styles.status}>{request.status}</span>
          {request.duration ? <span className={styles.duration}>{request.duration}</span> : null}
        </div>
      ) : null}
      <div className={styles.card}>
        <div className={styles.toolbar}>
          <label className={styles.search}>
            <span className={styles.searchIcon}><SearchIcon /></span>
            <input ref={searchBox} type="search" aria-label="Search keys and values" placeholder="Search keys and values" value={query} onChange={(e) => { setQuery(e.target.value); setHit(0) }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); go(e.shiftKey ? -1 : 1) } }} />
            {query ? <button type="button" className={styles.clear} aria-label="Clear search" onClick={() => { setQuery(''); setHit(0); searchBox.current?.focus() }}><XIcon /></button> : <KbdGroup keys={['\u2318', 'K']} size="sm" className={styles.shortcut} animated={animated} />}
          </label>
          {query ? (
            <>
              <span className={styles.matchCount} role="status">{matches.length ? `${Math.min(hit, matches.length - 1) + 1} of ${matches.length}` : '0 matches'}</span>
              <IconButton variant="ghost" size="sm" icon={<ArrowUpIcon />} label="Previous match" animated={animated} disabled={!matches.length} onClick={() => go(-1)} />
              <IconButton variant="ghost" size="sm" icon={<ArrowDownIcon />} label="Next match" animated={animated} disabled={!matches.length} onClick={() => go(1)} />
            </>
          ) : (
            <>
              <IconButton variant="ghost" size="sm" icon={<PlusIcon />} label="Expand all" animated={animated} onClick={() => setOpen(allBranches())} />
              <IconButton variant="ghost" size="sm" icon={<MinusIcon />} label="Collapse all" animated={animated} onClick={() => setOpen(new Set())} />
            </>
          )}
        </div>
        {query && !matches.length ? (
          <div className={styles.empty}><span aria-hidden="true" className={styles.emptyIcon}><SearchIcon /></span><p className={styles.emptyTitle}>No keys or values match {`“${query}”`}</p><p className={styles.emptyHint}>Search looks through every nested key and value.</p></div>
        ) : (
          <div ref={tree} role="tree" aria-label={`${rootName} response`} className={styles.tree} onKeyDown={move}>
            {rows.map((row) => (
              <div
                key={row.path}
                role="treeitem"
                aria-selected={row.path === selectedPath}
                aria-level={row.depth + 1}
                aria-expanded={row.branch ? row.open : undefined}
                tabIndex={row.path === selectedPath ? 0 : -1}
                data-path={row.path}
                data-current={row.path === current ? '' : undefined}
                className={styles.row}
                style={{ paddingLeft: row.depth * ROW_INDENT + 8 }}
                onClick={() => { setSelected(row.path); if (row.branch && !query) toggle(row.path) }}
              >
                <span aria-hidden="true" className={styles.caret} data-open={row.open ? '' : undefined}>{row.branch ? <ChevronRightIcon /> : null}</span>
                <span className={styles.key}><Mark text={row.key} query={query} />:&nbsp;</span>
                {row.branch && isBranch(row.value) ? <><span data-json="punct">{row.open ? '' : summary(row.value)}</span><span className={styles.count}>{countLabel(row.value)}</span></> : <Leaf value={row.value} query={query} />}
                <span className={styles.actions}>
                  <IconButton variant="ghost" size="sm" icon={<CopyIcon />} label={`Copy ${row.key}`} animated={animated} tabIndex={-1} onClick={(e) => { e.stopPropagation(); write(JSON.stringify(row.value)) }} />
                  <IconButton variant="ghost" size="sm" icon={<LinkIcon />} label={`Copy path of ${row.key}`} animated={animated} tabIndex={-1} onClick={(e) => { e.stopPropagation(); write(row.path) }} />
                </span>
              </div>
            ))}
          </div>
        )}
        <div className={styles.footer}>
          <span className={styles.footPath}>{query && !matches.length ? rootName : selectedPath}</span>
          <span className={styles.footType}>{query && !matches.length ? '0 matches' : typeLabel(selectedValue)}</span>
          <span role="status" className={styles.copied}>{copied ? 'Copied' : ''}</span>
          <IconButton variant="ghost" size="sm" icon={<CopyIcon />} label="Copy the selected value" animated={animated} onClick={() => write(JSON.stringify(selectedValue))} />
        </div>
      </div>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </div>
  )
}
