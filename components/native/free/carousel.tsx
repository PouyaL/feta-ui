import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { interpolate, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { radius, space, useColors, type Colors, hscroll } from '../kit'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'

const CARD_WIDTH = 220
const CARD_GAP = 12
const STEP = CARD_WIDTH + CARD_GAP
const FOCUS_SCALE = 1.06
const HEART = 'M12 20s-7-4.6-9-9c-1.3-3 .8-6 4-6 2 0 3.8 1 5 3 1.2-2 3-3 5-3 3.2 0 5.3 3 4 6-2 4.4-9 9-9 9z'

export type CarouselCard = {
  id: string
  scene: ReactNode
  /** Chip on the scene, like `2 nights`. */
  tag?: string
  title: string
  place: string
  meta?: string
  price?: string
}

export type CarouselProps = {
  label: string
  eyebrow?: ReactNode
  title?: ReactNode
  cards: CarouselCard[]
  /** Card ids saved at the start. */
  defaultSaved?: string[]
  onSavedChange?: (saved: string[]) => void
  defaultIndex?: number
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type SlideProps = { card: CarouselCard; index: number; total: number; scroll: SharedValue<number>; still: boolean; saved: boolean; onSave: () => void }

function Slide({ card, index, total, scroll, still, saved, onSave }: SlideProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const grow = useAnimatedStyle(() => {
    const near = Math.max(0, 1 - Math.abs(scroll.value / STEP - index))
    const focus = still ? (near > 0.5 ? 1 : 0) : near
    return { transform: [{ scale: interpolate(focus, [0, 1], [1, FOCUS_SCALE]) }] }
  })
  const details = useAnimatedStyle(() => {
    const near = Math.max(0, 1 - Math.abs(scroll.value / STEP - index))
    return { opacity: still ? (near > 0.5 ? 1 : 0) : near }
  })
  return (
    <Animated.View accessibilityLabel={`${index + 1} of ${total}: ${card.title}`} style={[styles.card, grow]}>
      <View style={styles.scene}>
        {card.scene}
        {card.tag ? <View style={styles.tag}><Text style={styles.tagText}>{card.tag}</Text></View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`Save ${card.title}`} aria-selected={saved} hitSlop={6} onPress={onSave} style={styles.save}>
          <Svg width={16} height={16} viewBox="0 0 24 24"><Path d={HEART} fill={saved ? colors.danger : 'none'} stroke={saved ? colors.danger : colors.textPrimary} strokeWidth={2} /></Svg>
        </Pressable>
      </View>
      <Animated.View style={[styles.details, details]}>
        <Text style={styles.cardTitle} numberOfLines={1}>{card.title}</Text>
        <Text style={styles.place} numberOfLines={1}>{card.place}</Text>
        <View style={styles.meta}><Text style={styles.place}>{card.meta}</Text><Text style={styles.place}>{card.price}</Text></View>
      </Animated.View>
    </Animated.View>
  )
}

/** A rail of tall cards. The centred card grows to 106% and shows its details; scrolling never re-renders. */
export function Carousel({ label, eyebrow, title, cards, defaultSaved = [], onSavedChange, defaultIndex = 0, renderIcon, animated = true, style }: CarouselProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const { width } = useWindowDimensions()
  const track = useAnimatedRef<Animated.ScrollView>()
  const scroll = useSharedValue(defaultIndex * STEP)
  const [index, setIndex] = useState(defaultIndex)
  const [saved, setSaved] = useState(defaultSaved)
  const edge = useMemo(() => ({ paddingHorizontal: Math.max(space[3], (width - CARD_WIDTH) / 2 - space[1]) }), [width])

  const onScroll = useAnimatedScrollHandler((e) => { scroll.value = e.contentOffset.x })

  function settle(e: NativeSyntheticEvent<NativeScrollEvent>): void {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / STEP))
  }

  function go(to: number): void {
    track.current?.scrollTo({ x: to * STEP, animated: !still })
    setIndex(to)
  }

  function toggleSave(id: string): void {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id]
    setSaved(next)
    onSavedChange?.(next)
  }

  const counter = `${String(index + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`
  return (
    <View accessibilityLabel={label} style={[styles.tray, style]}>
      <View style={styles.header}>
        <View style={styles.headText}>
          {typeof eyebrow === 'string' ? <Text style={styles.eyebrow}>{eyebrow}</Text> : eyebrow}
          {typeof title === 'string' ? <Text style={styles.title}>{title}</Text> : title}
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.counter}>{counter}</Text>
        <IconButton variant="secondary" size="sm" icon={renderIcon('arrow-left', 16)} label="Previous card" animated={animated} disabled={index === 0} onPress={() => go(index - 1)} />
        <IconButton variant="secondary" size="sm" icon={renderIcon('arrow-right', 16)} label="Next card" animated={animated} disabled={index === cards.length - 1} onPress={() => go(index + 1)} />
      </View>
      <Animated.ScrollView style={hscroll}
        ref={track}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={STEP}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentOffset={{ x: defaultIndex * STEP, y: 0 }}
        contentContainerStyle={[styles.rail, edge]}
        onScroll={onScroll}
        onMomentumScrollEnd={settle}
      >
        {cards.map((card, i) => <Slide key={card.id} card={card} index={i} total={cards.length} scroll={scroll} still={still} saved={saved.includes(card.id)} onSave={() => toggleSave(card.id)} />)}
      </Animated.ScrollView>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', paddingVertical: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[2], paddingHorizontal: space[3] },
  headText: { flex: 1, minWidth: 0 },
  eyebrow: type(11, c.textTertiary, '400', true),
  title: type(14, c.textPrimary, '500'),
  counter: type(12, c.textTertiary, '400', true),
  rail: { gap: CARD_GAP, paddingVertical: space[4] },
  card: { width: CARD_WIDTH },
  scene: { height: 280, overflow: 'hidden', borderRadius: radius.card, backgroundColor: c.ink5 },
  tag: { position: 'absolute', top: space[2], left: space[2], paddingVertical: space[0.5], paddingHorizontal: space[2], borderRadius: radius.full, backgroundColor: c.surface },
  tagText: type(12, c.textPrimary, '500'),
  save: { position: 'absolute', top: space[2], right: space[2], alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: radius.full, backgroundColor: c.surface },
  details: { gap: space[0.5], paddingTop: space[2], paddingHorizontal: space[1] },
  cardTitle: type(14, c.textPrimary, '500'),
  place: type(12, c.textSecondary),
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: space[2] },
})
