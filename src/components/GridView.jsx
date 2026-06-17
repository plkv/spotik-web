import { cn } from '@/lib/utils'

export function GridView({ items, active, onSelect }) {
  return (
    <div
      className={cn(
        'absolute inset-0 overflow-y-scroll touch-pan-y overscroll-y-contain',
        'grid grid-cols-2 sm:grid-cols-3 gap-1 content-start p-2',
        'transition-opacity duration-200',
        active ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      )}
    >
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(item)}
          className="aspect-square rounded-sm bg-cover bg-center cursor-pointer hover:opacity-80 transition-opacity"
          style={{ backgroundImage: `url("${item.cover}")` }}
          aria-label={item.title}
        />
      ))}
    </div>
  )
}
