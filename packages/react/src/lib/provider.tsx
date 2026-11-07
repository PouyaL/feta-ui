'use client'
import { createContext, useEffect, type ReactNode } from 'react'
import { setMaxLoops } from './loop-coordinator'

/** False keeps every icon inside still, whatever its `trigger`. */
export const AnimatedIconsContext = createContext(true)

/**
 * Optional. `maxLoops` raises the one loop limit for pages such as a gallery (ANIMATION.md §5.1).
 * `animatedIcons={false}` keeps the icons inside still (§5.3).
 */
export function FetaProvider({ maxLoops, animatedIcons = true, children }: { maxLoops?: number; animatedIcons?: boolean; children: ReactNode }) {
  useEffect(() => {
    if (maxLoops === undefined) return
    setMaxLoops(maxLoops)
    return () => setMaxLoops(1)
  }, [maxLoops])
  return <AnimatedIconsContext.Provider value={animatedIcons}>{children}</AnimatedIconsContext.Provider>
}
