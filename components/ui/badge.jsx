import * as React from 'react'
import { cn } from '@/lib/utils'

function Badge({ className, variant = 'default', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        variant === 'default' && 'border-[#1e3050] bg-[#1a2540] text-[#7c8db0]',
        variant === 'pr' && 'border-[#f59e0b]/40 bg-[#f59e0b]/15 text-[#eab308]',
        variant === 'success' && 'border-[#4ade80]/30 bg-[#4ade80]/10 text-[#4ade80]',
        className
      )}
      {...props}
    />
  )
}

export { Badge }
