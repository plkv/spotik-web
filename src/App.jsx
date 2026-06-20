import { useState, useMemo, useEffect, useRef } from 'react'
import { PLAYLISTS } from '@/data/playlists'
import { FilterBar } from '@/components/FilterBar'
import { ViewToggle } from '@/components/ViewToggle'
import { TickerView } from '@/components/TickerView'
import { GridView } from '@/components/GridView'
import { PlaylistPanel } from '@/components/PlaylistPanel'
import { LoadingScreen } from '@/components/LoadingScreen'

function readHash() {
  const id = window.location.hash.slice(1)
  return PLAYLISTS.find(p => p.id === id) ?? null
}

export function App() {
  const [view, setView]                 = useState('tape')
  const [activeFilters, setFilters]     = useState(new Set())
  const [openPlaylist, setOpenPlaylist] = useState(readHash)
  const [revealed, setRevealed]         = useState(false)
  const [flip, setFlip]                 = useState(null)

  const tickerApi      = useRef(null)
  const carouselRects  = useRef({})

  // Toggle views by FLIP-animating the cards between carousel and grid layouts.
  function handleView(next) {
    if (next === view) return
    if (next === 'grid') {
      const rects = {}
      ;(tickerApi.current?.getVisibleCards() ?? []).forEach(c => { rects[c.id] = c.rect })
      carouselRects.current = rects
      setFlip({ dir: 'in', rects })
      setView('grid')
    } else {
      // Grid → tape: animate grid cells back onto the carousel positions, then
      // switch (the carousel reappears at exactly those spots).
      setFlip({ dir: 'out', rects: carouselRects.current })
      setTimeout(() => { setView('tape'); setFlip(null) }, 480)
    }
  }

  // Sync hash ↔ open sheet
  useEffect(() => {
    const onHashChange = () => setOpenPlaylist(readHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function handleSelect(playlist) {
    window.location.hash = playlist.id
    setOpenPlaylist(playlist)
  }

  function handleClose() {
    history.pushState('', '', window.location.pathname + window.location.search)
    setOpenPlaylist(null)
  }

  const filtered = useMemo(() => {
    if (activeFilters.size === 0) return PLAYLISTS
    return PLAYLISTS.filter(p => p.tags.some(t => activeFilters.has(t)))
  }, [activeFilters])

  return (
    <>
      <LoadingScreen items={PLAYLISTS} onReady={() => setRevealed(true)} />

      {/* Filter bar — top, scrollable horizontally */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-bg/90 to-transparent">
        <FilterBar
          playlists={PLAYLISTS}
          activeFilters={activeFilters}
          onChange={setFilters}
        />
      </div>

      {/* View toggle — top right, fixed above everything (hidden while a card is open) */}
      {!openPlaylist && (
        <div className="absolute top-3 right-3 z-30">
          <ViewToggle value={view} onChange={handleView} />
        </div>
      )}

      {/* Stage */}
      <div className="absolute inset-0">
        <TickerView
          items={filtered}
          active={view === 'tape'}
          onSelect={handleSelect}
          ready={revealed}
          expanded={!!openPlaylist}
          openId={openPlaylist?.id}
          apiRef={tickerApi}
        />
        <GridView
          items={filtered}
          active={view === 'grid'}
          onSelect={handleSelect}
          flip={flip}
        />
      </div>

      {/* Expanded card content */}
      <PlaylistPanel playlist={openPlaylist} onClose={handleClose} />
    </>
  )
}
