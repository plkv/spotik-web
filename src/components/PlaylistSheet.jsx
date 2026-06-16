import * as Dialog from '@radix-ui/react-dialog'
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

  return (
    <Dialog.Root open={open} onOpenChange={v => !v && onClose()}>
      <Dialog.Portal>
        {/* Backdrop */}
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-40 bg-black/60 backdrop-blur-[16px]" />

        {/* Sheet */}
        <Dialog.Content
          style={{ width: 'min(calc(100vw - 16px), max(33.333vw, 480px))' }}
          className="sheet-content fixed bottom-0 inset-x-0 mx-auto z-50 max-h-[calc(100dvh-24px)] flex flex-col bg-surface/90 backdrop-blur-[16px] rounded-t-[var(--radius-lg)] overflow-hidden"
        >
          {/* Close — floats over the cover image */}
          <Dialog.Close className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-black/40 text-white/80 hover:text-white transition-colors">
            <X size={20} />
          </Dialog.Close>

          {/* Scrollable content */}
          <div className="overflow-y-auto flex-1">
            {/* Cover — flush to top, masked by sheet's rounded corners */}
            <div className="aspect-square w-full overflow-hidden flex-shrink-0">
              <img
                src={playlist?.cover}
                alt={playlist?.title}
                className="w-full h-full object-cover block"
                loading="lazy"
              />
            </div>

            {/* Body */}
            <div className="flex flex-col gap-4 p-5 pb-10">
              <Dialog.Title className="text-[26px] font-bold leading-tight">
                {playlist?.title}
              </Dialog.Title>

              <p className="text-sm text-fg-2 leading-relaxed">
                {playlist?.description}
              </p>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {playlist?.tags?.map(t => <Tag key={t} label={t} />)}
              </div>

              {/* Artists */}
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-fg-3">
                  Artists
                </span>
                <p className="text-sm text-fg-2 leading-relaxed">
                  {playlist?.artists?.join(' · ')}
                </p>
              </div>

              {/* Spotify widget */}
              <div className="rounded-sm overflow-hidden">
                <iframe
                  key={playlist?.spotifyId}
                  src={`https://open.spotify.com/embed/playlist/${playlist?.spotifyId}?utm_source=generator`}
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
                href={playlist?.spotifyUrl}
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
