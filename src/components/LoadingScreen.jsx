import { useEffect, useRef, useState } from 'react'

export function LoadingScreen({ items, onReady }) {
  const [idx, setIdx]       = useState(0)
  const [hiding, setHiding] = useState(false)
  const [hidden, setHidden] = useState(false)
  const doneRef  = useRef(false)
  const startRef = useRef(Date.now())

  // Cycle thumbnails at ~220ms discrete cuts
  useEffect(() => {
    if (items.length === 0) return
    const id = setInterval(() => setIdx(i => (i + 1) % items.length), 220)
    return () => clearInterval(id)
  }, [items.length])

  // Preload all covers; wait at least 1.2s before revealing
  useEffect(() => {
    if (items.length === 0) { onReady(); return }

    let loaded = 0
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
      img.onload = img.onerror = () => {
        loaded++
        if (loaded >= items.length) maybeReveal()
      }
      img.src = item.cover
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (hidden) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg"
      style={{
        opacity:    hiding ? 0 : 1,
        transition: hiding ? 'opacity 0.3s ease' : 'none',
      }}
    >
      {items[idx]?.cover && (
        <img
          src={items[idx].cover}
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
