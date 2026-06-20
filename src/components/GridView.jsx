import { useLayoutEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const EASE = 'cubic-bezier(.2,.8,.2,1)'
const DUR  = 0.46

/**
 * Grid of covers. When toggling to/from the carousel, `flip` carries the
 * carousel cards' screen rects (keyed by id); each matching grid cell FLIPs
 * between its grid position and the carousel position, so the cards visibly
 * rearrange. Cards with no carousel counterpart fade/scale (staggered).
 *   flip = { token, dir: 'in' | 'out', rects: { [id]: DOMRect } }
 */
export function GridView({ items, active, onSelect, flip }) {
  const cellRefs = useRef(new Map())

  useLayoutEffect(() => {
    if (!flip) return
    const rects = flip.rects || {}
    items.forEach((item, i) => {
      const el = cellRefs.current.get(item.id)
      if (!el) return
      const grid = el.getBoundingClientRect()
      const from = rects[item.id]
      el.style.transformOrigin = 'top left'

      if (from) {
        const dx = from.left - grid.left
        const dy = from.top - grid.top
        const sx = from.width / grid.width
        const sy = from.height / grid.height
        const at = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(${sx.toFixed(3)},${sy.toFixed(3)})`
        if (flip.dir === 'in') {
          el.style.transition = 'none'
          el.style.transform  = at
          el.style.opacity    = '1'
          requestAnimationFrame(() => {
            el.style.transition = `transform ${DUR}s ${EASE}`
            el.style.transform  = 'translate(0,0) scale(1,1)'
          })
        } else {
          el.style.transition = `transform ${DUR}s ${EASE}`
          el.style.transform  = at
        }
      } else {
        // No carousel counterpart — fade/scale, staggered by index.
        const delay = Math.min(0.18, i * 0.012)
        if (flip.dir === 'in') {
          el.style.transition = 'none'
          el.style.transform  = 'scale(0.6)'
          el.style.opacity    = '0'
          requestAnimationFrame(() => {
            el.style.transition = `transform ${DUR}s ${EASE} ${delay}s, opacity 0.3s ease ${delay}s`
            el.style.transform  = 'scale(1)'
            el.style.opacity    = '1'
          })
        } else {
          el.style.transition = `transform ${DUR}s ${EASE}, opacity 0.3s ease`
          el.style.transform  = 'scale(0.6)'
          el.style.opacity    = '0'
        }
      }
    })
  }, [flip, items])

  return (
    <div
      className={cn(
        'absolute inset-0 overflow-y-scroll touch-pan-y overscroll-y-contain',
        'grid grid-cols-2 sm:grid-cols-3 gap-1 content-start p-2',
        active ? 'pointer-events-auto' : 'pointer-events-none',
      )}
      // No opacity transition on the container — individual cells animate.
      style={{ opacity: active || flip?.dir === 'out' ? 1 : 0 }}
    >
      {items.map(item => (
        <button
          key={item.id}
          ref={el => { if (el) cellRefs.current.set(item.id, el); else cellRefs.current.delete(item.id) }}
          onClick={() => onSelect(item)}
          className="aspect-square rounded-sm bg-cover bg-center cursor-pointer hover:opacity-80"
          style={{ backgroundImage: `url("${item.cover}")` }}
          aria-label={item.title}
        />
      ))}
    </div>
  )
}
