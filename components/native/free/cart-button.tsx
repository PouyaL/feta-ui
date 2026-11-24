import { useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { accent, radius, space, useColors, type Colors } from '../kit'
import { AddToCartButton } from './add-to-cart-button'
import { RollingText } from './badge'
import { Button, ICON_SIZE, withInk } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'

export type CartItem = { id: string; name: string; detail?: string; price: number; quantity: number; tone?: 'accent' | 'success' | 'warning' }

export type CartButtonProps = {
  items?: CartItem[]
  onItemsChange?: (items: CartItem[]) => void
  onCheckout?: () => void
  /** Formats the subtotal. Default USD. */
  format?: (amount: number) => string
  /** Draws `shopping-cart`, `shopping-bag` and the stepper's `plus`, `minus` and `trash`. */
  renderIcon: RenderIcon
  /** `false` turns off the rolling digits and the steppers' motion. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const USD = (amount: number): string => `$${amount.toFixed(2)}`

/** A mini cart with item rows, a rolling subtotal and a Checkout that stays disabled while empty. */
export function CartButton({ items: initial = [], onItemsChange, onCheckout, format = USD, renderIcon, animated = true, style }: CartButtonProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [items, setItems] = useState(initial)
  const units = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  function quantity(id: string, next: number): void {
    const updated = items.map((item) => (item.id === id ? { ...item, quantity: next } : item)).filter((item) => item.quantity > 0)
    setItems(updated)
    onItemsChange?.(updated)
  }

  const toneOf = (tone: CartItem['tone']): StyleProp<ViewStyle> => (tone === 'success' ? styles.toneSuccess : tone === 'warning' ? styles.toneWarning : styles.toneAccent)

  return (
    <View accessibilityLabel="Cart" style={[styles.tray, style]}>
      <View style={styles.header}>
        <View style={styles.title}>
          {withInk(renderIcon('shopping-cart', ICON_SIZE), colors.textPrimary)}
          <Text style={styles.titleText}>Cart</Text>
        </View>
        <Text style={styles.meta}>{units} {units === 1 ? 'item' : 'items'}</Text>
      </View>
      <View style={styles.body}>
        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.name}>Your cart is empty</Text>
            <Text style={styles.meta}>Add something you love to see it here.</Text>
          </View>
        ) : items.map((item) => (
          <View key={item.id} style={styles.item}>
            <View style={styles.tile}>
              <View style={[styles.tint, toneOf(item.tone)]} />
              {withInk(renderIcon('shopping-bag', ICON_SIZE), colors.textPrimary)}
            </View>
            <View style={styles.text}>
              <Text numberOfLines={1} style={styles.name}>{item.name}</Text>
              <Text numberOfLines={1} style={styles.meta}>{format(item.price)}{item.detail ? ` · ${item.detail}` : ''}</Text>
            </View>
            <AddToCartButton value={item.quantity} renderIcon={renderIcon} animated={animated} onValueChange={(next) => quantity(item.id, next)} />
          </View>
        ))}
        <View style={styles.divider} />
        <View style={styles.subtotal}>
          <Text style={styles.meta}>Subtotal</Text>
          <RollingText value={format(subtotal)} still={still} style={styles.amount} />
        </View>
        <View style={styles.checkout}>
          <Button size="lg" disabled={items.length === 0} animated={animated} style={styles.checkoutButton} onPress={onCheckout}>Checkout</Button>
        </View>
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { backgroundColor: c.ink4, borderRadius: radius.tray, maxWidth: 384, padding: space[1], width: '100%' },
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingBottom: space[2.5], paddingHorizontal: space[3], paddingTop: space[2] },
  title: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  titleText: type(16, c.textPrimary, '500'),
  meta: type(12, c.textSecondary),
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, gap: space[1], paddingBottom: space[3], paddingHorizontal: space[2], paddingTop: space[2] },
  empty: { alignItems: 'center', gap: space[0.5], paddingVertical: space[6] },
  item: { alignItems: 'center', flexDirection: 'row', gap: space[3], padding: space[2] },
  tile: { alignItems: 'center', borderRadius: radius.xl, height: 44, justifyContent: 'center', overflow: 'hidden', width: 44 },
  tint: { ...StyleSheet.absoluteFill, opacity: 0.16 },
  toneAccent: { backgroundColor: accent.sky.to },
  toneSuccess: { backgroundColor: c.success },
  toneWarning: { backgroundColor: accent.orange.to },
  text: { flex: 1, gap: space[0.5], minWidth: 0 },
  name: type(14, c.textPrimary, '500'),
  divider: { backgroundColor: c.ink8, height: 1 },
  subtotal: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: space[1], paddingHorizontal: space[2], paddingTop: space[2] },
  amount: type(16, c.textPrimary, '600'),
  checkout: { paddingHorizontal: space[2], paddingTop: space[1] },
  checkoutButton: { alignSelf: 'stretch' },
})
