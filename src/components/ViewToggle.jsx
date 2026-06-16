import * as ToggleGroup from '@radix-ui/react-toggle-group'
import { Rows3, Grid2x2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const itemClass = cn(
  'flex items-center justify-center w-8 h-8 rounded-sm',
  'text-fg-3 transition-colors duration-150',
  'data-[state=on]:bg-white/15 data-[state=on]:text-fg',
  'hover:text-fg-2',
)

export function ViewToggle({ value, onChange }) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={v => v && onChange(v)}
      className="flex gap-0.5 rounded-lg bg-white/[0.08] backdrop-blur p-[3px]"
    >
      <ToggleGroup.Item value="tape" className={itemClass} aria-label="Tape view">
        <Rows3 size={16} />
      </ToggleGroup.Item>
      <ToggleGroup.Item value="grid" className={itemClass} aria-label="Grid view">
        <Grid2x2 size={16} />
      </ToggleGroup.Item>
    </ToggleGroup.Root>
  )
}
