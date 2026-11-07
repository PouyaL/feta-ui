'use client'
import { useState } from 'react'
import { ShoppingBagIcon } from '@fetaui/react/rounded/shopping-bag'
import { ShoppingCartIcon } from '@fetaui/react/rounded/shopping-cart'
import { AddToCartButton } from '../add-to-cart-button/add-to-cart-button'
import { Button } from '../button/button'
import { cx, kit, RollingText, useStill } from '../motion-kit/motion-kit'
import styles from './cart-button.module.css'

export type CartItem = { id: string; name: string; detail?: string; price: number; quantity: number; tone?: 'accent' | 'success' | 'warning' }

export type CartButtonProps = {
  /** The rows. A new list (by content) replaces the cart, so a parent can add or clear items. */
  items?: CartItem[]
  onItemsChange?: (items: CartItem[]) => void
  onCheckout?: () => void
  /** Formats the subtotal. Default USD. */
  format?: (amount: number) => string
  /** `false` turns off the rolling digits and the steppers' motion. */
  animated?: boolean
  className?: string
}

const USD = (amount: number): string => `$${amount.toFixed(2)}`

/** A mini cart with item rows, a rolling subtotal and a Checkout that stays disabled while empty. */
export function CartButton({ items: initial = [], onItemsChange, onCheckout, format = USD, animated = true, className }: CartButtonProps) {
  const still = useStill(animated)
  const [items, setItems] = useState(initial)
  // Follows the prop when its content changes, while steppers keep editing the local copy.
  const incoming = JSON.stringify(initial)
  const [seen, setSeen] = useState(incoming)
  if (incoming !== seen) {
    setSeen(incoming)
    setItems(initial)
  }
  const units = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  function quantity(id: string, next: number): void {
    const updated = items.map((item) => (item.id === id ? { ...item, quantity: next } : item)).filter((item) => item.quantity > 0)
    setItems(updated)
    onItemsChange?.(updated)
  }

  return (
    <section aria-label="Cart" className={cx(kit.tray, styles.tray, className)}>
      <div className={kit.trayHeader}>
        <span className={kit.trayTitle}><span className={kit.icon}><ShoppingCartIcon /></span>Cart</span>
        <span className={kit.meta}>{units} {units === 1 ? 'item' : 'items'}</span>
      </div>
      <div className={cx(kit.card, styles.body)}>
        {items.length === 0 ? (
          <div className={styles.empty}>
            <span className={styles.emptyTitle}>Your cart is empty</span>
            <span className={kit.meta}>Add something you love to see it here.</span>
          </div>
        ) : items.map((item) => (
          <div key={item.id} className={styles.item}>
            <span className={styles.tile} data-tone={item.tone ?? 'accent'} aria-hidden="true"><ShoppingBagIcon /></span>
            <span className={styles.text}>
              <span className={styles.name}>{item.name}</span>
              <span className={kit.meta}>{format(item.price)}{item.detail ? ` · ${item.detail}` : ''}</span>
            </span>
            <AddToCartButton value={item.quantity} animated={animated} onValueChange={(next) => quantity(item.id, next)} />
          </div>
        ))}
        <div className={styles.divider} />
        <div className={styles.subtotal}>
          <span className={kit.meta}>Subtotal</span>
          <span className={styles.amount}><RollingText value={format(subtotal)} still={still} /></span>
        </div>
        <div className={styles.checkout}>
          <Button size="lg" disabled={items.length === 0} animated={animated} className={styles.checkoutButton} onClick={onCheckout}>Checkout</Button>
        </div>
      </div>
    </section>
  )
}
