import { useEffect, useRef } from 'react'
import { Ticker } from '@/lib/ticker'

export function TickerView({ items, active, onSelect, ready, expanded, openId, grid }) {
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

  // Drive the ticker from the panel-open state: focus the card (or suppress the
  // deck) when open — handles deep-link/hash opens too — and collapse on close.
  useEffect(() => {
    if (!ready) return
    const tk = tickerRef.current
    if (!tk) return
    if (expanded) tk.focusItem(openId)
    else tk.unfocus()
  }, [expanded, openId, ready])

  // Same cards morph between carousel and grid layouts.
  useEffect(() => {
    if (ready) tickerRef.current?.setGrid(!!grid)
  }, [grid, ready])

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 isolate overflow-hidden touch-none overscroll-contain"
    />
  )
}
