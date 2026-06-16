import { useEffect, useRef } from 'react'
import { Ticker } from '@/lib/ticker'

export function TickerView({ items, active, onSelect }) {
  const containerRef = useRef(null)
  const tickerRef    = useRef(null)

  // Mount/unmount ticker
  useEffect(() => {
    if (!containerRef.current) return
    tickerRef.current = new Ticker(containerRef.current, items, { onSelect })
    return () => {
      tickerRef.current?.destroy()
      tickerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync items (filtering)
  useEffect(() => {
    tickerRef.current?.setItems(items)
  }, [items])

  // Pause/resume when view switches
  useEffect(() => {
    tickerRef.current?.setActive(active)
  }, [active])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 isolate overflow-hidden touch-none overscroll-contain"
    />
  )
}
