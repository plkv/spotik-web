import * as Dialog from '@radix-ui/react-dialog'
import { useRef } from 'react'
import { X } from 'lucide-react'

function Tag({ label }) {
  return (
    <span className="px-2.5 py-1 rounded-full border border-border text-fg-3 text-[11px] font-semibold uppercase tracking-wider">
      {label}
    </span>
  )
}

export function PlaylistSheet({ playlist, onClose }) {
  const open = !!playlist
  // Keep last non-null playlist during close animation so the image doesn't break
  const lastRef = useRef(playlist)
  if (playlist) lastRef.current = playlist
  const p = lastRef.current

  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-40 bg-black/60 backdrop-blur-[16px]" />

        {/* Close — fixed to viewport top-right, above everything */}
        <Dialog.Close className="fixed top-5 right-5 z-[60] flex items-center justify-center w-10 h-10 rounded-full bg-black/40 text-white/80 hover:text-white transition-colors">
          <X size={20} />
        </Dialog.Close>

        {/* Sheet */}
        <Dialog.Content
          className="sheet-content fixed bottom-0 z-50 max-h-[calc(100dvh-24px)] flex flex-col"
          aria-describedby={undefined}
        >
          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1 min-h-0">
            {/* Cover */}
            <div className="aspect-square w-full overflow-hidden flex-shrink-0 rounded-xl">
              <img
                src={p?.cover}
                alt={p?.title}
                className="w-full h-full object-cover block"
                loading="lazy"
              />
            </div>

            {/* Body */}
            <div className="flex flex-col gap-4 py-4 pb-10">
              <Dialog.Title className="text-[26px] font-bold leading-tight">
                {p?.title}
              </Dialog.Title>

              <p className="text-sm text-fg-2 leading-relaxed">
                {p?.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {p?.tags?.map(t => <Tag key={t} label={t} />)}
              </div>

              {/* Artists */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-fg-3">
                  Artists
                </span>
                <p className="text-sm text-fg-2 leading-relaxed">
                  {p?.artists?.join(' · ')}
                </p>
              </div>

              {/* Spotify widget */}
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

              {/* Open in Spotify */}
              <a
                href={p?.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center w-full py-3.5 rounded-sm bg-accent text-bg text-sm font-bold hover:opacity-90 transition-opacity"
              >
                Open in Spotify ↗
              </a>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
