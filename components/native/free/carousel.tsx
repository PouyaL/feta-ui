import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { interpolate, useAnimatedRef, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { hscroll, pressedState, radius, space, useColors, type Colors } from '../kit'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'

/** The web's mobile card: 240 wide with a 290 tall scene, 12 apart. */
const CARD_WIDTH = 240
const SCENE_HEIGHT = 290
const CARD_GAP = 12
/** Below this window width the arrows hide, as the web's max-width: 640px rule. Phones swipe. */
const ARROWS_FROM = 640
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
  /** Shows Previous and Next. Default: only on windows wider than 640 points, as the web hides them on phones. */
  arrows?: boolean
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
  // Title and place always show; the price row belongs to the card in focus.
  const details = useAnimatedStyle(() => {
    const near = Math.max(0, 1 - Math.abs(scroll.value / STEP - index))
    return { opacity: still ? (near > 0.5 ? 1 : 0) : near }
  })
  return (
    <Animated.View accessibilityLabel={`${index + 1} of ${total}: ${card.title}`} style={[styles.card, grow]}>
      <View style={styles.scene}>
        {card.scene}
        {card.tag ? <View style={styles.tag}><Text style={styles.tagText}>{card.tag}</Text></View> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`Save ${card.title}`} {...pressedState(saved)} hitSlop={6} onPress={onSave} style={[styles.save, saved && styles.saveOn]}>
          <Svg aria-hidden width={16} height={16} viewBox="0 0 24 24"><Path d={HEART} fill={saved ? colors.textInverse : 'none'} stroke={saved ? colors.textInverse : colors.textPrimary} strokeWidth={2} /></Svg>
        </Pressable>
      </View>
      <View style={styles.details}>
        <Text style={styles.cardTitle} numberOfLines={1}>{card.title}</Text>
        <Text style={styles.place} numberOfLines={1}>{card.place}</Text>
        <Animated.View style={[styles.meta, details]}><Text style={styles.place} numberOfLines={1}>{card.meta}</Text><Text style={styles.place}>{card.price}</Text></Animated.View>
      </View>
    </Animated.View>
  )
}

/** A rail of tall cards. The centred card grows to 106% and shows its details; scrolling never re-renders. */
export function Carousel({ label, eyebrow, title, cards, defaultSaved = [], onSavedChange, defaultIndex = 0, arrows: showArrows, renderIcon, animated = true, style }: CarouselProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const { width: windowWidth } = useWindowDimensions()
  const [trayWidth, setTrayWidth] = useState(0)
  const width = trayWidth || windowWidth
  const arrows = showArrows ?? windowWidth > ARROWS_FROM
  const track = useAnimatedRef<Animated.ScrollView>()
  const scroll = useSharedValue(defaultIndex * STEP)
  const [index, setIndex] = useState(defaultIndex)
  const [saved, setSaved] = useState(defaultSaved)
  // Centres the card in the track, as the web's padding of 50% less half a card.
  const edge = useMemo(() => ({ paddingHorizontal: Math.max(space[3], (width - space[2] - CARD_WIDTH) / 2) }), [width])

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
    <View accessibilityLabel={label} style={[styles.tray, style]} onLayout={(e) => setTrayWidth(e.nativeEvent.layout.width)}>
      <View style={styles.header}>
        <View style={styles.headText}>
          {typeof eyebrow === 'string' ? <Text style={styles.eyebrow}>{eyebrow}</Text> : eyebrow}
          {typeof title === 'string' ? <Text style={styles.title}>{title}</Text> : title}
        </View>
        <Text accessibilityLiveRegion="polite" style={styles.counter}>{counter}</Text>
        {arrows ? (
          <View style={styles.arrows}>
            <IconButton variant="secondary" size="sm" icon={renderIcon('arrow-left', 16)} label="Previous card" animated={animated} disabled={index === 0} onPress={() => go(index - 1)} />
            <IconButton variant="secondary" size="sm" icon={renderIcon('arrow-right', 16)} label="Next card" animated={animated} disabled={index === cards.length - 1} onPress={() => go(index + 1)} />
          </View>
        ) : null}
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
  tray: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space[1], minHeight: 54, paddingLeft: space[3], paddingRight: space[2] },
  headText: { flex: 1, minWidth: 0 },
  eyebrow: { ...type(12, c.textSecondary), lineHeight: 16 },
  title: { ...type(16, c.textPrimary, '600'), lineHeight: 20 },
  // The web's 40% ink on the mono meta.
  counter: { ...type(12, c.textPrimary, '400', true), lineHeight: 16, marginRight: space[1], opacity: 0.4 },
  arrows: { flexDirection: 'row', gap: space[1] },
  rail: { gap: CARD_GAP, paddingVertical: space[3.5] },
  card: { width: CARD_WIDTH, padding: space[1], overflow: 'hidden', borderRadius: radius.tray, backgroundColor: c.ink5 },
  scene: { height: SCENE_HEIGHT, overflow: 'hidden', borderRadius: radius.card, backgroundColor: c.ink5 },
  tag: { position: 'absolute', top: space[2], left: space[2], paddingVertical: space[0.5], paddingHorizontal: space[2], borderRadius: radius.full, backgroundColor: c.inverse },
  tagText: { ...type(12, c.textInverse, '500'), lineHeight: 16 },
  save: { position: 'absolute', top: space[2], right: space[2], alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: radius.full, backgroundColor: c.muted },
  saveOn: { backgroundColor: c.inverse },
  details: { height: 82, paddingTop: space[2], paddingHorizontal: space[2] },
  cardTitle: { ...type(16, c.textPrimary, '500'), lineHeight: 22 },
  place: { ...type(12, c.textSecondary), lineHeight: 16 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', gap: space[2], marginTop: space[1] },
})
