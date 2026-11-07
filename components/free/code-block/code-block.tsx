'use client'
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { CopyIcon } from '@fetaui/react/rounded/copy'
import { FileCodeIcon } from '@fetaui/react/rounded/file-code'
import { RefreshCwIcon } from '@fetaui/react/rounded/refresh-cw'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { Button } from '../button/button'
import { cx, LabelSwap, useStill } from '../motion-kit/motion-kit'
import styles from './code-block.module.css'

const COPIED_HOLD_MS = 2000
const STAGGER_S = 0.04
const LINE_FADE_S = 0.2
const COLLAPSED_LINES = 5

export type CodeLineVariant = 'default' | 'highlighted' | 'added' | 'removed'
export type CodeLine = { text: string; variant?: CodeLineVariant; number?: number }

const TOKEN = /(\/\/.*$|"[^"]*"|'[^']*'|`[^`]*`|<\/?[A-Za-z][\w.]*|\b(?:import|from|export|function|return|const|let|if|else|async|await|default|type)\b|\b[A-Z][\w]*\b|[{}()[\]<>=/;,.])/g
const KEYWORD = /^(import|from|export|function|return|const|let|if|else|async|await|default|type)$/

/** A small tokeniser for the five code colours. Bring your own by passing nodes to `CodeBlockLine`. */
export function highlight(text: string): ReactNode[] {
  const parts: ReactNode[] = []
  let at = 0
  for (const match of text.matchAll(TOKEN)) {
    const token = match[0]
    const start = match.index
    if (start > at) parts.push(text.slice(at, start))
    const kind = token.startsWith('//') ? 'comment' : /^["'`]/.test(token) ? 'string' : KEYWORD.test(token) ? 'attr' : /^<\/?[A-Za-z]/.test(token) || /^[A-Z]/.test(token) ? 'tag' : 'punct'
    parts.push(<span key={start} data-code={kind}>{token}</span>)
    at = start + token.length
  }
  if (at < text.length) parts.push(text.slice(at))
  return parts
}

const SIGN: Record<CodeLineVariant, string> = { default: ' ', highlighted: ' ', added: '+', removed: '−' }

/** One numbered line: Default, Highlighted, Added or Removed. */
export function CodeBlockLine({ number, variant = 'default', delay = 0, still = false, children }: { number?: number | undefined; variant?: CodeLineVariant | undefined; delay?: number; still?: boolean; children: ReactNode }) {
  const marked = variant !== 'default'
  return (
    <span className={styles.line} data-variant={variant}>
      {marked ? <motion.span aria-hidden="true" className={styles.wash} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: LINE_FADE_S, delay }} /> : null}
      {marked ? <motion.span aria-hidden="true" className={styles.bar} initial={still ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: LINE_FADE_S, delay }} /> : null}
      <span className={styles.number} aria-hidden="true">{number}</span>
      <span className={styles.sign}>{SIGN[variant]}</span>
      <span className={styles.text}>{children}</span>
      {'\n'}
    </span>
  )
}

export type CodeBlockProps = {
  /** The source. Pass `lines` instead to mark lines. */
  code?: string
  lines?: CodeLine[]
  fileName?: string
  language?: string
  /** Starts folded with Show more. Use it for blocks over about 12 lines. */
  collapsible?: boolean
  copyLabel?: string
  animated?: boolean
  className?: string
}

/** Code on the Soft tray: file name and Copy above, numbered lines in an inset card. */
export function CodeBlock({ code, lines, fileName, language, collapsible = false, copyLabel = 'Copy code', animated = true, className }: CodeBlockProps) {
  const still = useStill(animated)
  const rows = useMemo<CodeLine[]>(() => lines ?? (code ?? '').replace(/\n$/, '').split('\n').map((text) => ({ text })), [lines, code])
  const source = useMemo(() => rows.filter((row) => row.variant !== 'removed').map((row) => row.text).join('\n'), [rows])
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [open, setOpen] = useState(!collapsible)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const body = useRef<HTMLDivElement>(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const hidden = rows.length - COLLAPSED_LINES
  const foldable = collapsible && hidden > 0
  const shown = foldable && !open ? rows.slice(0, COLLAPSED_LINES) : rows

  async function onCopy(): Promise<void> {
    clearTimeout(timer.current)
    try {
      await navigator.clipboard.writeText(source)
      setCopy('copied')
      timer.current = setTimeout(() => setCopy('idle'), COPIED_HOLD_MS)
    } catch {
      setCopy('failed')
    }
  }

  const word = copy === 'copied' ? 'Copied' : copy === 'failed' ? 'Try again' : copyLabel
  const toggle = (): void => {
    const node = body.current
    const before = node?.offsetHeight ?? 0
    setOpen(!open)
    if (still || !node) return
    requestAnimationFrame(() => node.animate([{ height: `${before}px` }, { height: `${node.offsetHeight}px` }], { duration: 300, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }))
  }
  let number = 0
  const numbers = rows.map((row) => {
    if (row.number !== undefined) { number = row.number; return number }
    if (row.variant !== 'removed') number += 1
    return row.variant === 'removed' ? number + 1 : number
  })

  return (
    <div className={cx(styles.tray, className)} data-still={still ? '' : undefined}>
      <div className={styles.header}>
        <span className={styles.fileIcon}><FileCodeIcon /></span>
        {fileName ? <span className={styles.name}>{fileName}</span> : null}
        {language ? <span className={styles.language}>{fileName ? '· ' : ''}{language}</span> : null}
        <span className={styles.note} data-state={copy} aria-hidden="true">{copy === 'copied' ? 'Copied to clipboard' : copy === 'failed' ? 'Couldn’t copy' : ''}</span>
        <Button
          variant="secondary"
          shape="pill"
          size="sm"
          animated={animated}
          aria-label={copy === 'idle' ? copyLabel : word}
          leadingIcon={copy === 'copied' ? <Tick02Icon /> : copy === 'failed' ? <RefreshCwIcon /> : <CopyIcon />}
          onClick={() => void onCopy()}
        >
          <LabelSwap swapKey={word} still={still}><span className={styles.copyLong}>{word}</span><span className={styles.copyShort}>{copy === 'idle' ? 'Copy' : word}</span></LabelSwap>
        </Button>
        <span role="status" className={styles.srOnly}>{copy === 'copied' ? 'Copied' : copy === 'failed' ? 'Couldn’t copy' : ''}</span>
      </div>
      <div className={styles.card}>
        <div ref={body} className={styles.body}>
          <pre className={styles.pre} tabIndex={0} aria-label={fileName ?? 'Code'}><code data-language={language}>
            {shown.map((row, i) => (
              <CodeBlockLine key={i} number={numbers[i]} variant={row.variant} delay={i * STAGGER_S} still={still}>{highlight(row.text)}</CodeBlockLine>
            ))}
          </code></pre>
        </div>
        {foldable ? (
          <div className={styles.more}>
            <Button variant="ghost" size="sm" animated={animated} aria-expanded={open} trailingIcon={<span className={styles.chevron} data-open={open ? '' : undefined}><ChevronUpIcon /></span>} onClick={toggle}>{open ? 'Show less' : `Show ${hidden} more lines`}</Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
