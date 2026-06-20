import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

/**
 * Expanded-card content. The focused card itself is rendered (frontal) by the
 * ticker in the lower part of the screen; this panel shows its details ABOVE it.
 * Clicking outside the content (the catcher) or the ✕ closes.
 */
export function PlaylistPanel({ playlist, onClose }) {
  const open = !!playlist
  const [mounted, setMounted] = useState(open)
  const [shown, setShown]     = useState(false)

  // Keep the last playlist during the close animation so content doesn't blank
  const lastRef = useRef(playlist)
  if (playlist) lastRef.current = playlist
  const p = lastRef.current

  // Mount + enter / exit animation
  useEffect(() => {
    if (open) {
      setMounted(true)
      // Wait for the other cards to clear (ticker focus animation) before
      // revealing the content.
      const t = setTimeout(() => setShown(true), 500)
      return () => clearTimeout(t)
    }
    setShown(false)
    const t = setTimeout(() => setMounted(false), 520)
    return () => clearTimeout(t)
  }, [open])

  // Escape closes
  useEffect(() => {
    if (!open) return
    const onKey = e => { if (e.key === 'Escape') { e.preventDefault(); onClose() } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null

  // Must match the ticker's FOCUS_TOP / FOCUS_SCALE so the cover at the top of
  // this scroll column lines up exactly with the card the ticker flies up.
  const cardW = 'min(100vw - 16px, 480px)'
  const colW  = `calc(${cardW} * 0.84)`

  return (
    <>
      {/* Transparent click-catcher — tap outside the content (incl. the card) closes */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Close — fixed top-right */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="fixed top-3 right-3 z-50 flex items-center justify-center w-10 h-10 rounded-full bg-black/40 text-white/80 hover:text-white transition-colors"
        style={{ opacity: shown ? 1 : 0, transition: 'opacity 0.42s ease' }}
      >
        <X size={20} />
      </button>

      {/* One scroll frame: cover + details scroll together as a single column */}
      <div
        className="fixed left-0 right-0 z-40 flex justify-center"
        style={{ top: 70, bottom: 0, pointerEvents: 'none' }}
      >
        <div
          className="overflow-y-auto overscroll-contain no-scrollbar"
          style={{
            width:         colW,
            pointerEvents: 'auto',
            opacity:       shown ? 1 : 0,
            transition:    'opacity 0.42s ease',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Cover — top of the column, same width, takes over from the ticker card */}
          <div className="w-full aspect-square overflow-hidden" style={{ borderRadius: 'var(--radius-sm)' }}>
            <img src={p?.cover} alt={p?.title} className="w-full h-full object-cover block" draggable={false} />
          </div>

          <div className="flex flex-col gap-8 pt-6 pb-10">
            {p?.description && (
              <p className="text-sm text-fg-2 leading-relaxed">{p?.description}</p>
            )}

            {/* Tags — alternating square (2px) / pill (999px) outlined frames */}
            <div className="flex flex-wrap gap-2">
              {p?.tags?.map((t, i) => (
                <span
                  key={t}
                  style={{
                    height:       28,
                    display:      'inline-flex',
                    alignItems:   'center',
                    padding:      '0 12px',
                    fontSize:     16,
                    lineHeight:   1,
                    border:       '1px solid rgba(255,255,255,0.55)',
                    borderRadius: i % 2 === 0 ? 2 : 999,
                    color:        'rgba(255,255,255,0.92)',
                    whiteSpace:   'nowrap',
                  }}
                >
                  {t}
                </span>
              ))}
            </div>

            <p style={{ color: '#fff', fontSize: 16 }} className="leading-relaxed">
              {[...(p?.artists ?? []), '& others'].join(' · ')}
            </p>

            <div className="rounded-sm overflow-hidden">
              <iframe
                key={p?.spotifyId}
                src={`https://open.spotify.com/embed/playlist/${p?.spotifyId}?utm_source=generator`}
                width="100%"
                height="152"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="block"
              />
            </div>

            <a
              href={p?.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-full bg-accent text-bg font-bold hover:opacity-90 transition-opacity"
              style={{ height: 48, borderRadius: 999, fontSize: 16 }}
            >
              Open in Spotify
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
