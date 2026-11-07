'use client'
import { useReducedMotion } from 'motion/react'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import styles from './use-still.module.css'

const ComponentAnimationContext = createContext(true)

/**
 * `animated={false}` turns off the motion of every component inside, CSS included, spinners too.
 * Only countdown bars carry `data-keep-motion`, because they show time passing.
 */
export function ComponentAnimation({ animated, children }: { animated: boolean; children: ReactNode }) {
  return (
    <ComponentAnimationContext.Provider value={animated}>
      <div className={animated ? styles.scope : `${styles.scope} ${styles.off}`}>{children}</div>
    </ComponentAnimationContext.Provider>
  )
}

/** True when a component must not move: `animated` is false, here or above, or the user asked for less motion. */
export function useStill(animated = true): boolean {
  const reduce = useReducedMotion()
  const allowed = useContext(ComponentAnimationContext)
  // The server cannot know the setting, so it applies right after hydration or `data-still` is lost.
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return !animated || !allowed || (hydrated && Boolean(reduce))
}
