import { useMemo } from 'react'
import { StickerTag } from '@/components/StickerTag'

export function FilterBar({ playlists, activeFilters, onChange }) {
  const tags = useMemo(() => {
    const counts = new Map()
    playlists.forEach(p => p.tags.forEach(t => counts.set(t, (counts.get(t) || 0) + 1)))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  }, [playlists])

  function toggle(tag) {
    const next = new Set(activeFilters)
    next.has(tag) ? next.delete(tag) : next.add(tag)
    onChange(next)
  }

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-2 pt-3 px-3">
      <StickerTag label="All" variant={5} active={activeFilters.size === 0} onClick={() => onChange(new Set())} />
      {tags.map(tag => (
        <StickerTag key={tag} label={tag} variant={1} active={activeFilters.has(tag)} onClick={() => toggle(tag)} />
      ))}
    </div>
  )
}
