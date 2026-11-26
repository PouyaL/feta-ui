import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { StarIcon } from '@fetaui/react-native/filled/star'
import { radius, space, useColors, type Colors } from '../kit'
import { Avatar, type AvatarProps } from './avatar'
import { type RenderIcon, type, useThemed } from './card'
import { ExpandableText } from './expandable-text'

const MAX_STARS = 5
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
            <StarIcon key={i} size={14} color={i < rating ? colors.textPrimary : colors.ink10} trigger="none" />
          ))}
        </View>
        <Text accessibilityRole="header" style={styles.headline}>{headline}</Text>
      </View>
      <ExpandableText animated={animated} moreAccessibilityLabel="Show the full review" {...(renderIcon ? { renderIcon } : {})}>{children}</ExpandableText>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  card: { width: '100%', gap: space[2], padding: space[4], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  top: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  name: { ...type(16, c.textPrimary, '500'), lineHeight: 22, flex: 1, minWidth: 0 },
  date: { ...type(12, c.textTertiary), lineHeight: 16 },
  rating: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space[2], rowGap: space[1] },
  stars: { flexDirection: 'row', gap: space[0.5] },
  headline: { ...type(16, c.textPrimary, '500'), lineHeight: 22 },
})
