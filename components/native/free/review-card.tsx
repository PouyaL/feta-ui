import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Polygon } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { Avatar, type AvatarProps } from './avatar'
import { type RenderIcon, type, useThemed } from './card'
import { ExpandableText } from './expandable-text'

const MAX_STARS = 5
const STAR_POINTS = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 === 0 ? 11 : 5
  const angle = (i * Math.PI) / 5 - Math.PI / 2
  return `${(12 + r * Math.cos(angle)).toFixed(2)},${(12.5 + r * Math.sin(angle)).toFixed(2)}`
}).join(' ')

export type ReviewCardProps = {
  name: string
  date: string
  /** Whole stars, 0 to 5. */
  rating: number
  headline: string
  /** One string per paragraph. A review that fits three lines has no toggle. */
  children: string | string[]
  avatar?: Pick<AvatarProps, 'src' | 'person' | 'initials'>
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A customer review: ink stars, a headline and three lines that open in place. */
export function ReviewCard({ name, date, rating, headline, children, avatar, renderIcon, animated = true, style }: ReviewCardProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  return (
    <View style={[styles.card, style]}>
      <View style={styles.top}>
        <Avatar {...avatar} size="sm" alt="" animated={animated} {...(renderIcon ? { renderIcon } : {})} />
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      <View style={styles.rating}>
        <View accessible accessibilityRole="image" accessibilityLabel={`${rating} out of ${MAX_STARS} stars`} style={styles.stars}>
          {Array.from({ length: MAX_STARS }, (_, i) => (
            <Svg aria-hidden key={i} width={14} height={14} viewBox="0 0 24 24"><Polygon points={STAR_POINTS} fill={i < rating ? colors.textPrimary : colors.ink10} /></Svg>
          ))}
        </View>
        <Text accessibilityRole="header" style={styles.headline}>{headline}</Text>
      </View>
      <ExpandableText animated={animated} moreAccessibilityLabel="Show the full review" {...(renderIcon ? { renderIcon } : {})}>{children}</ExpandableText>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  card: { width: '100%', gap: space[2], padding: space[4], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  top: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  name: { ...type(14, c.textPrimary, '500'), flex: 1, minWidth: 0 },
  date: type(12, c.textTertiary),
  rating: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space[2], rowGap: space[1] },
  stars: { flexDirection: 'row', gap: space[0.5] },
  headline: type(14, c.textPrimary, '500'),
})
