import { useEffect, useRef, useState } from 'react'

export function LoadingScreen({ items, onReady }) {
  const [idx, setIdx]       = useState(0)
  const [hiding, setHiding] = useState(false)
  const [hidden, setHidden] = useState(false)
  const loadedSrcs = useRef([])  // grows as images load; only these are shown
  const doneRef    = useRef(false)
  const startRef   = useRef(Date.now())

  // Cycle only through images that have already loaded
  useEffect(() => {
    if (items.length === 0) return
    const id = setInterval(() => {
      const len = loadedSrcs.current.length
      if (len > 0) setIdx(i => (i + 1) % len)
    }, 100)
    return () => clearInterval(id)
  }, [items.length])

  // Preload all covers; add each to the pool on success, skip on error
  useEffect(() => {
    if (items.length === 0) { onReady(); return }

    let settled = 0
    const MIN_MS = 1200

    function maybeReveal() {
      if (doneRef.current) return
      doneRef.current = true
      const wait = Math.max(0, MIN_MS - (Date.now() - startRef.current))
      setTimeout(() => {
        setHiding(true)
        setTimeout(() => { setHidden(true); onReady() }, 300)
      }, wait)
    }

    items.forEach(item => {
      const img = new Image()
      img.onload = () => {
        loadedSrcs.current.push(item.cover)
        settled++
        if (settled >= items.length) maybeReveal()
      }
      img.onerror = () => {
        settled++
        if (settled >= items.length) maybeReveal()
      }
      img.src = item.cover
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (hidden) return null

  const src = loadedSrcs.current[idx] ?? null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg"
      style={{
        opacity:    hiding ? 0 : 1,
        transition: hiding ? 'opacity 0.3s ease' : 'none',
      }}
    >
      {src && (
        <img
          src={src}
          width={80}
          height={80}
          style={{ borderRadius: 6, objectFit: 'cover', display: 'block' }}
          alt=""
          draggable={false}
        />
      )}
    </div>
  )
}
