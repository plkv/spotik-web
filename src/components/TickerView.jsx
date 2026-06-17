import { useEffect, useRef } from 'react'
import { Ticker } from '@/lib/ticker'

export function TickerView({ items, active, onSelect, ready }) {
  const containerRef = useRef(null)
  const tickerRef    = useRef(null)

  // Mount ticker inactive — reveal() activates it when loading is done
  useEffect(() => {
    if (!containerRef.current) return
    tickerRef.current = new Ticker(containerRef.current, items, { onSelect, active: false })
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

  // Fan reveal once loading is done
  useEffect(() => {
    if (ready) tickerRef.current?.reveal()
  }, [ready])

  // Pause/resume when switching between tape and grid views
  useEffect(() => {
    if (!ready) return
    tickerRef.current?.setActive(active)
  }, [active, ready])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 isolate overflow-hidden touch-none overscroll-contain"
    />
  )
}
