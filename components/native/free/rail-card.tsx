import { useState } from 'react'
import { Image, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { RAIL_SCENES, RAIL_TRIPS, type RailTrip, type SceneTone } from '../../free/rail-card/rail-scenes'
import { accent, pressedState, radius, space, type Colors } from '../kit'
import { Badge } from './badge'
import { Card, type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { openLink } from './popover'
import { Skeleton } from './skeleton'

export { RAIL_TRIPS, type RailTrip }

/** Save: 300 ms from the 16.5 Motion frame. */
const SAVE_STEP = { duration: 150 }
const SAVE_SCALE = 1.2
const IMAGE_HEIGHT = 290
/** The scene keeps its tone in Light and Dark, so these are fixed. kit.ts has no zinc scale yet. */
const TONES: Record<SceneTone, string> = { sky: 'rgb(228,228,231)', light: accent.onSolid, far: 'rgb(212,212,216)', mid: 'rgb(161,161,170)', near: 'rgb(82,82,91)' }

export type RailCardSceneProps = {
  /** Default `Weekend in Lisbon`. */
  trip?: RailTrip
  /** Names the art. Without it the scene is decorative. */
  alt?: string
  style?: StyleProp<ViewStyle>
}

/** A paper scene that keeps its tone in Light and Dark. Swap `trip`, or put an image in its place. */
export function RailCardScene({ trip = 'Weekend in Lisbon', alt, style }: RailCardSceneProps) {
  return (
    // `accessible` makes the drawing one element for VoiceOver and TalkBack; the web build of react-native-svg would
    // write it to the DOM as an attribute, and role plus label already do the job there.
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 256 320"
      preserveAspectRatio="xMidYMid slice"
      style={style}
      {...(alt ? { ...(Platform.OS === 'web' ? {} : { accessible: true }), accessibilityRole: 'image' as const, accessibilityLabel: alt } : { 'aria-hidden': true })}
    >
      <Rect width={256} height={320} fill={TONES.sky} />
      {RAIL_SCENES[trip].map((shape, index) => {
        const fill = TONES[shape.tone]
        if ('d' in shape) return <Path key={index} d={shape.d} fill={fill} />
        if ('circle' in shape) return <Circle key={index} cx={shape.circle[0]} cy={shape.circle[1]} r={shape.circle[2]} fill={fill} />
        return <Rect key={index} x={shape.rect[0]} y={shape.rect[1]} width={shape.rect[2]} height={shape.rect[3]} fill={fill} />
      })}
    </Svg>
  )
}

export type RailCardProps = {
  /** Picks the scene and the default title. Default `Weekend in Lisbon`. */
  trip?: RailTrip
  title?: string
  location: string
  /** The line under the location, such as a rating and dates. */
  details: string
  /** Such as `€340 total`. */
  price: string
  /** Such as `2 nights`. */
  nights: string
  /** Makes the whole card open a link. */
  href?: string
  /** An image in place of the scene. */
  image?: string
  saved?: boolean
  defaultSaved?: boolean
  onSavedChange?: (saved: boolean) => void
  /** A skeleton at the same height. */
  loading?: boolean
  /** Shows the raised tray, for previews. */
  hovered?: boolean
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A trip card for horizontal rails: scene, nights, a heart that saves, title, place, rating and the total. */
export function RailCard({ trip = 'Weekend in Lisbon', title = trip, location, details, price, nights, href, image, saved, defaultSaved = false, onSavedChange, loading = false, hovered = false, renderIcon, animated = true, style }: RailCardProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultSaved)
  const heart = useSharedValue(1)
  const on = saved ?? held
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: heart.value }] }))

  function toggle(): void {
    setHeld(!on)
    onSavedChange?.(!on)
    if (!still) heart.value = withSequence(withTiming(SAVE_SCALE, SAVE_STEP), withTiming(1, SAVE_STEP))
  }

  if (loading) {
    return (
      <View role="group" accessibilityLabel="Loading trip" aria-busy style={[styles.rail, styles.skeleton, style]}>
        <Skeleton shape="block" height={IMAGE_HEIGHT} animated={!still} style={styles.boneImage} />
        <View style={styles.boneLines}>
          <Skeleton width="70%" height={12} animated={!still} />
          <Skeleton width="42.5%" height={10} animated={!still} />
          <Skeleton height={10} animated={!still} />
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.rail, style]}>
      <Card
        {...(href ? { onPress: () => openLink(href) } : {})}
        accessibilityLabel={`${title}, ${location}, ${price}`}
        animated={animated}
        style={hovered ? styles.hovered : undefined}
        bodyStyle={styles.body}
      >
        <View style={styles.image}>
          {image ? <Image source={{ uri: image }} resizeMode="cover" style={styles.photo} /> : <RailCardScene trip={trip} />}
          <View style={styles.nights}><Badge variant="inverse" size="sm" mark={false} animated={animated}>{nights}</Badge></View>
          <Animated.View style={[styles.save, heartStyle]}>
            <IconButton size="sm" variant={on ? 'primary' : 'secondary'} icon={renderIcon('heart', 16)} label={`Save ${title}`} {...pressedState(on)} animated={animated} onPress={toggle} />
          </Animated.View>
        </View>
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{title}</Text>
          <Text style={styles.location} numberOfLines={1}>{location}</Text>
          <View style={styles.row}>
            <Text style={styles.dates} numberOfLines={1}>{details}</Text>
            <Text style={styles.price}>{price}</Text>
          </View>
        </View>
      </Card>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  rail: { flexShrink: 0, height: 380, maxWidth: '100%', width: 240 },
  hovered: { backgroundColor: c.ink5 },
  // No inset card here: the scene sits straight on the tray.
  body: { backgroundColor: 'transparent', borderRadius: 0, borderWidth: 0, padding: 0 },
  image: { backgroundColor: c.muted, borderRadius: radius.card, height: IMAGE_HEIGHT, overflow: 'hidden' },
  photo: { height: '100%', width: '100%' },
  nights: { left: space[2.5], position: 'absolute', top: space[2.5] },
  save: { position: 'absolute', right: space[1.5], top: space[2.5], zIndex: 2 },
  text: { gap: space[0.5], paddingBottom: space[2], paddingHorizontal: space[2], paddingTop: space[2.5] },
  title: type(14, c.textPrimary, '500'),
  location: { ...type(14, c.textSecondary), lineHeight: 18 },
  row: { alignItems: 'baseline', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingTop: space[1.5] },
  dates: { ...type(12, c.textTertiary), flexShrink: 1, minWidth: 0 },
  price: { ...type(14, c.textPrimary, '500'), flexShrink: 0 },
  skeleton: { backgroundColor: c.ink4, borderRadius: radius.tray, padding: space[1] },
  boneImage: { borderRadius: radius.card, flexShrink: 0 },
  boneLines: { gap: space[2], paddingBottom: space[2], paddingHorizontal: space[2], paddingTop: space[3] },
})
