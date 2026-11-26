import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { radius, space, type Colors } from '../kit'
import { type RenderIcon, type, useThemed } from './card'
import { ExpandableText } from './expandable-text'
import { ReviewCard, type ReviewCardProps } from './review-card'

export type ProductDetailsProps = {
  name: string
  price: string
  priceNote?: string
  /** One string per paragraph. */
  description: string | string[]
  score?: string
  /** The product photo, above the copy. */
  media?: ReactNode
  reviews: (Omit<ReviewCardProps, 'animated' | 'style' | 'renderIcon'> & { id: string })[]
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Expandable Text and Review Card composed into a real product block. */
export function ProductDetails({ name, price, priceNote, description, score, media, reviews, renderIcon, animated = true, style }: ProductDetailsProps) {
  const styles = useThemed(makeStyles)
  const icons = renderIcon ? { renderIcon } : {}
  return (
    <View accessibilityLabel={name} style={[styles.tray, style]}>
      <View style={styles.card}>
        {media ? <View style={styles.media}>{media}</View> : null}
        <View style={styles.copy}>
          <View style={styles.head}>
            <Text accessibilityRole="header" style={styles.name}>{name}</Text>
            <Text style={styles.price}>{price}{priceNote ? <Text style={styles.note}> {priceNote}</Text> : null}</Text>
          </View>
          <ExpandableText animated={animated} {...icons}>{description}</ExpandableText>
        </View>
      </View>
      <View style={styles.reviewsHead}>
        <Text accessibilityRole="header" style={styles.reviewsTitle}>Reviews</Text>
        {score ? <Text style={styles.score}>{score}</Text> : null}
      </View>
      {reviews.map(({ id, ...review }) => <ReviewCard key={id} {...review} animated={animated} {...icons} />)}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', gap: space[1], padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  // Mobile stacks the photo over the copy; the card keeps the web's 1 px ink edge and soft shadow.
  card: {
    gap: space[4], padding: space[3], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10,
  },
  media: { width: '100%', aspectRatio: 16 / 10, overflow: 'hidden', borderRadius: radius.control },
  copy: { gap: space[2] },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space[3], rowGap: space[1] },
  name: { ...type(16, c.textPrimary, '600'), lineHeight: 20, width: '100%' },
  price: { ...type(16, c.textPrimary, '500'), lineHeight: 22 },
  note: { color: c.textSecondary, fontWeight: '400' },
  reviewsHead: { flexDirection: 'row', alignItems: 'center', gap: space[2], height: 40, paddingHorizontal: space[3] },
  reviewsTitle: type(16, c.textPrimary, '500'),
  score: type(12, c.textTertiary, '400', true),
})
