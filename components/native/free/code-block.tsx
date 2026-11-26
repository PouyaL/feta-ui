import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { font, radius, space, type Colors, hscroll } from '../kit'
import { Button, SELF } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'

const COPIED_HOLD_MS = 2000
const STAGGER_MS = 40
const LINE_FADE_MS = 200
const UNFOLD_MS = 300
const COLLAPSED_LINES = 5
const unfold = LinearTransition.duration(UNFOLD_MS).easing(Easing.bezierFn(0.23, 1, 0.32, 1))

export type CodeLineVariant = 'default' | 'highlighted' | 'added' | 'removed'
export type CodeLine = { text: string; variant?: CodeLineVariant; number?: number }

const TOKEN = /(\/\/.*$|"[^"]*"|'[^']*'|`[^`]*`|<\/?[A-Za-z][\w.]*|\b(?:import|from|export|function|return|const|let|if|else|async|await|default|type)\b|\b[A-Z][\w]*\b|[{}()[\]<>=/;,.])/g
const KEYWORD = /^(import|from|export|function|return|const|let|if|else|async|await|default|type)$/
const SIGN: Record<CodeLineVariant, string> = { default: ' ', highlighted: ' ', added: '+', removed: '−' }
const kindOf = (token: string): 'comment' | 'string' | 'attr' | 'tag' | 'punct' => (token.startsWith('//') ? 'comment' : /^["'`]/.test(token) ? 'string' : KEYWORD.test(token) ? 'attr' : /^<\/?[A-Za-z]/.test(token) || /^[A-Z]/.test(token) ? 'tag' : 'punct')

/** A small tokeniser for the code colours. Bring your own by passing nodes to `CodeBlockLine`. */
export function useHighlight(): (text: string) => ReactNode[] {
  const styles = useThemed(makeStyles)
  return (text) => {
    const parts: ReactNode[] = []
    let at = 0
    for (const match of text.matchAll(TOKEN)) {
      const token = match[0]
      const start = match.index
      if (start > at) parts.push(text.slice(at, start))
      parts.push(<Text key={start} style={styles[kindOf(token)]}>{token}</Text>)
      at = start + token.length
    }
    if (at < text.length) parts.push(text.slice(at))
    return parts
  }
}

export type CodeBlockLineProps = { number?: number | undefined; variant?: CodeLineVariant | undefined; delay?: number; still?: boolean; children: ReactNode }

/** One numbered line: Default, Highlighted, Added or Removed. */
export function CodeBlockLine({ number, variant = 'default', delay = 0, still = false, children }: CodeBlockLineProps) {
  const styles = useThemed(makeStyles)
  const marked = variant !== 'default'
  const shown = useSharedValue(still ? 1 : 0)
  useEffect(() => {
    if (!still) shown.value = withDelay(delay, withTiming(1, { duration: LINE_FADE_MS }))
  }, [delay, still, shown])
  const wash = useAnimatedStyle(() => ({ opacity: shown.value }))
  const bar = useAnimatedStyle(() => ({ transform: [{ scaleY: shown.value }] }))
  return (
    <View style={styles.line}>
      {marked ? <Animated.View style={[styles.wash, styles[`wash_${variant}` as const], wash]} /> : null}
      {marked ? <Animated.View style={[styles.bar, styles[`bar_${variant}` as const], bar]} /> : null}
      <Text style={styles.number}>{number}</Text>
      <Text style={[styles.sign, variant === 'added' ? styles.sign_added : variant === 'removed' ? styles.sign_removed : null]}>{SIGN[variant]}</Text>
      <Text style={styles.text}>{children}</Text>
    </View>
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
  /** React Native ships no clipboard, so the app writes the text. Reject to show Try again. */
  onCopy: (source: string) => void | Promise<void>
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Code on the Soft tray: file name and Copy above, numbered lines in an inset card that scrolls sideways. */
export function CodeBlock({ code, lines, fileName, language, collapsible = false, copyLabel = 'Copy', onCopy, renderIcon, animated = true, style }: CodeBlockProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const highlight = useHighlight()
  const rows = useMemo<CodeLine[]>(() => lines ?? (code ?? '').replace(/\n$/, '').split('\n').map((text) => ({ text })), [lines, code])
  const source = useMemo(() => rows.filter((row) => row.variant !== 'removed').map((row) => row.text).join('\n'), [rows])
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [open, setOpen] = useState(!collapsible)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const foldable = collapsible && rows.length > COLLAPSED_LINES
  const shown = foldable && !open ? rows.slice(0, COLLAPSED_LINES) : rows

  async function copySource(): Promise<void> {
    clearTimeout(timer.current)
    try {
      await onCopy(source)
      setCopy('copied')
      timer.current = setTimeout(() => setCopy('idle'), COPIED_HOLD_MS)
    } catch {
      setCopy('failed')
    }
  }

  const word = copy === 'copied' ? 'Copied' : copy === 'failed' ? 'Try again' : copyLabel
  let number = 0
  const numbers = rows.map((row) => {
    if (row.number !== undefined) { number = row.number; return number }
    if (row.variant !== 'removed') number += 1
    return row.variant === 'removed' ? number + 1 : number
  })

  return (
    <View style={[styles.tray, style]}>
      <View style={styles.header}>
        <View style={styles.fileIcon}>{renderIcon('file-code', 16)}</View>
        {fileName ? <Text style={styles.name} numberOfLines={1}>{fileName}</Text> : null}
        {language ? <Text style={styles.language}>{fileName ? '· ' : ''}{language}</Text> : null}
        <View style={styles.spacer} />
        <Button variant="secondary" shape="pill" size="sm" animated={animated} style={styles.copy} leadingIcon={renderIcon(copy === 'copied' ? 'tick-02' : copy === 'failed' ? 'refresh-cw' : 'copy', 16)} onPress={() => { void copySource() }}>{word}</Button>
      </View>
      <Animated.View {...(still ? {} : { layout: unfold })} style={styles.card}>
        <ScrollView style={hscroll} horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={fileName ?? 'Code'} contentContainerStyle={styles.pre}>
          <View style={styles.lines}>
            {shown.map((row, i) => (
              <Animated.View key={i} {...(still || i < COLLAPSED_LINES ? {} : { entering: FadeIn })}>
                <CodeBlockLine number={numbers[rows.indexOf(row)]} variant={row.variant} delay={i * STAGGER_MS} still={still}>{highlight(row.text)}</CodeBlockLine>
              </Animated.View>
            ))}
          </View>
        </ScrollView>
        {foldable ? (
          <View style={styles.more}>
            <Button style={SELF.center} variant="ghost" size="sm" animated={animated} aria-expanded={open} onPress={() => setOpen(!open)}>{open ? 'Show less' : `Show ${rows.length - COLLAPSED_LINES} more lines`}</Button>
          </View>
        ) : null}
      </Animated.View>
    </View>
  )
}

// Syntax colours: the web's --feta-code-* tokens, plus the subtle status washes for diff lines.
const LIGHT_CODE = { tag: '#006292', attr: '#704b00', string: '#006b2d', punct: '#6b6b6b', comment: '#9a9a9a', addedWash: '#ecfdf5', removedWash: '#fef2f2', addedSign: '#047857', removedSign: '#b91c1c' }
const DARK_CODE: typeof LIGHT_CODE = { tag: '#7cc4ec', attr: '#e3b263', string: '#86d49e', punct: '#9a9a9a', comment: '#6a6a6a', addedWash: '#022c22', removedWash: '#450a0a', addedSign: '#6ee7b7', removedSign: '#fca5a5' }
const codeColours = (c: Colors): typeof LIGHT_CODE => (c.canvas === '#ffffff' ? LIGHT_CODE : DARK_CODE)
/** Primary text at a given opacity, like the web's color-mix on --feta-text-primary. */
const faded = (c: Colors, alpha: number): string => (c.canvas === '#ffffff' ? `rgba(24,24,27,${alpha})` : `rgba(244,244,245,${alpha})`)

const mono = (c: Colors) => ({ fontFamily: font.mono, fontSize: 13, lineHeight: 20, color: c.textPrimary })

const makeStyles = (c: Colors) => {
  const k = codeColours(c)
  return StyleSheet.create({
    tray: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
    header: { flexDirection: 'row', alignItems: 'center', gap: space[1.5], height: 44, paddingLeft: space[3], paddingRight: space[1] },
    // The icon draws in its own colour; this brings it to about text-secondary like the web.
    fileIcon: { opacity: 0.6 },
    name: { ...type(16, c.textPrimary, '500'), lineHeight: 22, flexShrink: 1 },
    language: { ...type(12, faded(c, 0.4), '400', true), lineHeight: 16 },
    spacer: { flex: 1 },
    // Button hugs the top of a row by default; Copy sits level with the file name.
    copy: { alignSelf: 'center' },
    card: { overflow: 'hidden', borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
    // Grows to the card width, so marked lines wash the whole row even when every line is short.
    pre: { flexGrow: 1, paddingVertical: space[3] },
    lines: { flexGrow: 1 },
    line: { flexDirection: 'row', minHeight: 20, paddingRight: space[4] },
    wash: { ...StyleSheet.absoluteFill },
    wash_highlighted: { backgroundColor: c.ink5 },
    wash_added: { backgroundColor: k.addedWash },
    wash_removed: { backgroundColor: k.removedWash },
    bar: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 2 },
    bar_highlighted: { backgroundColor: c.textPrimary },
    bar_added: { backgroundColor: c.success },
    bar_removed: { backgroundColor: c.danger },
    number: { ...mono(c), width: 34, textAlign: 'right', color: faded(c, 0.3) },
    sign: { ...mono(c), width: 22, textAlign: 'center', color: c.textSecondary },
    sign_added: { color: k.addedSign },
    sign_removed: { color: k.removedSign },
    text: mono(c),
    comment: { color: k.comment },
    string: { color: k.string },
    attr: { color: k.attr },
    tag: { color: k.tag },
    punct: { color: k.punct },
    more: { alignItems: 'center', paddingHorizontal: space[2], paddingBottom: space[2] },
  })
}
