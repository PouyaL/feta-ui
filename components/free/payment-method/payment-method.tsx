'use client'
import { MoreHorizontalIcon } from '@fetaui/react/rounded/more-horizontal'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { DropdownMenu } from '../dropdown-menu/dropdown-menu'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Radio } from '../radio/radio'
import { Tag, kit } from '../data-kit/data-kit'
import styles from './payment-method.module.css'

export type PaymentMethodProps = {
  /** `selected` rings the row and swaps the menu for a Radio. `add` is a dashed row. Default `default`. */
  state?: 'default' | 'selected' | 'expired' | 'add'
  brand?: string
  label?: string
  expiry?: string
  /** Shows the Default badge. */
  isDefault?: boolean
  /** The Radio group name, for `selected` rows and their neighbours. */
  name?: string
  onSelect?: () => void
  onAdd?: () => void
  onMakeDefault?: () => void
  onRemove?: () => void
  animated?: boolean
  className?: string | undefined
}

/** A saved card: 40 by 28 brand tile, label and expiry, status and a menu. */
export function PaymentMethod({ state = 'default', brand = 'CARD', label = 'Card ending 4242', expiry = '08/28', isDefault = false, name, onSelect, onAdd, onMakeDefault, onRemove, animated = true, className }: PaymentMethodProps) {
  const still = useStill(animated)
  if (state === 'add') {
    return (
      <button type="button" className={cx(styles.row, styles.add, kit.enter, className)} data-still={still ? '' : undefined} onClick={onAdd}>
        <span className={styles.addTile}><PlusIcon size={16} aria-hidden="true" /></span>
        <span className={styles.label}>Add payment method</span>
        <ChevronRightIcon size={16} aria-hidden="true" className={cx(styles.chevron)} />
      </button>
    )
  }
  const expired = state === 'expired'
  const body = (
    <>
      <span className={styles.tile} aria-hidden="true">{brand}</span>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        <span className={styles.expiry} data-expired={expired ? '' : undefined}>{expired ? `Expired ${expiry}` : `Expires ${expiry}`}</span>
      </span>
      {expired ? <Tag tone="danger" mark>Expired</Tag> : isDefault ? <Tag>Default</Tag> : null}
    </>
  )
  if (state === 'selected' || name) {
    return (
      <label className={cx(styles.row, kit.enter, className)} data-selected={state === 'selected' ? '' : undefined} data-still={still ? '' : undefined}>
        {body}
        <Radio {...(name ? { name } : {})} checked={state === 'selected'} onChange={onSelect} readOnly={!onSelect} animated={animated} aria-label={label} />
      </label>
    )
  }
  return (
    <div className={cx(styles.row, kit.enter, className)} data-still={still ? '' : undefined}>
      {body}
      <DropdownMenu
        label={`${label} actions`}
        align="end"
        animated={animated}
        entries={[{ label: 'Make default', disabled: expired, ...(onMakeDefault ? { onSelect: onMakeDefault } : {}) }, { label: 'Remove', destructive: true, ...(onRemove ? { onSelect: onRemove } : {}) }]}
        trigger={(props) => <IconButton {...props} variant="ghost" size="sm" label={`${label} actions`} icon={<MoreHorizontalIcon size={16} />} animated={animated} />}
      />
    </div>
  )
}
