import { useMemo } from 'react'
import { cn } from '@/lib/utils'

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-shrink-0 px-3 py-[5px] rounded-full border text-xs font-medium whitespace-nowrap',
        'transition-colors duration-150',
        active
          ? 'bg-fg text-bg border-transparent'
          : 'bg-transparent text-fg-2 border-border hover:border-white/20 hover:text-fg',
      )}
    >
      {label}
    </button>
  )
}

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
      <Chip label="All" active={activeFilters.size === 0} onClick={() => onChange(new Set())} />
      {tags.map(tag => (
        <Chip key={tag} label={tag} active={activeFilters.has(tag)} onClick={() => toggle(tag)} />
      ))}
    </div>
  )
}
