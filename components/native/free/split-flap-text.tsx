import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { font, radius, space, type Colors } from '../kit'
import { useStill, useThemed } from './card'
import { TextShell } from './type-writer'

const CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const FLIP_MS = 70
const STAGGER_FLIPS = 2

export type SplitFlapTextProps = {
  /** Uppercase letters, digits and spaces. It pads to `cells`. */
  text: string
  /** Cells on the board. Default 12. */
  cells?: number
  styleKind?: 'soft' | 'original'
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const pad = (text: string, cells: number): string => text.toUpperCase().slice(0, cells).padEnd(cells, ' ')

function Cell({ char, flips }: { char: string; flips: boolean }) {
  const styles = useThemed(makeStyles)
  const drop = useSharedValue(1)
  useEffect(() => {
    if (!flips) return
    drop.value = 0
    drop.value = withTiming(1, { duration: FLIP_MS, easing: Easing.linear })
  }, [char, flips, drop])
  const flap = useAnimatedStyle(() => ({ opacity: 0.4 + 0.6 * drop.value, transform: [{ perspective: 300 }, { rotateX: `${70 * (1 - drop.value)}deg` }] }))
  return (
    <View style={styles.cell}>
      <Animated.Text style={[styles.char, flap]}>{char}</Animated.Text>
      <View style={styles.seam} />
    </View>
  )
}

/** An airport board: each cell flips through the alphabet until it lands. */
export function SplitFlapText({ text, cells = 12, styleKind = 'soft', animated = true, style }: SplitFlapTextProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const target = pad(text, cells)
  const [shown, setShown] = useState(target)
  const [flipping, setFlipping] = useState(false)
  const board = useRef(target)

  useEffect(() => {
    if (still) {
      board.current = target
      setShown(target)
      return undefined
    }
    let tick = 0
    setFlipping(true)
    const timer = setInterval(() => {
      tick += 1
      let done = true
      board.current = Array.from(board.current).map((char, i) => {
        const want = target[i] ?? ' '
        if (char === want || tick < i * STAGGER_FLIPS) {
          if (char !== want) done = false
          return char
        }
        done = false
        return CHARS[(CHARS.indexOf(char) + 1) % CHARS.length] ?? ' '
      }).join('')
      setShown(board.current)
      if (done) {
        clearInterval(timer)
        setFlipping(false)
      }
    }, FLIP_MS)
    return () => clearInterval(timer)
  }, [target, still])

  const row = (
    <View accessible accessibilityRole="image" accessibilityLabel={text} style={styles.board}>
      {Array.from(shown).map((char, i) => <Cell key={i} char={char} flips={!still && char !== target[i]} />)}
    </View>
  )
  if (styleKind === 'original') return <View style={style}>{row}</View>
  return <TextShell name="Split Flap Text" state={flipping ? 'flipping' : text.toLowerCase()} {...(style ? { style } : {})}>{row}</TextShell>
}

const makeStyles = (c: Colors) => StyleSheet.create({
  board: { flexDirection: 'row', gap: space[0.5], width: '100%' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 32, aspectRatio: 22 / 32, overflow: 'hidden', borderRadius: radius.sm, backgroundColor: c.inverse },
  char: { fontFamily: font.mono, fontSize: 16, fontWeight: '500', color: c.textInverse },
  seam: { position: 'absolute', top: '50%', left: 0, right: 0, height: 1, backgroundColor: c.canvas },
})
