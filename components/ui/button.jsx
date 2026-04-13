import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

const Button = React.forwardRef(
  ({ className, variant = 'default', size = 'default', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(
          'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/40 disabled:pointer-events-none disabled:opacity-50',
          variant === 'default' && 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]',
          variant === 'outline' &&
            'border border-[#1e3050] bg-transparent text-[#f0f6ff] hover:bg-[#1a2540]',
          variant === 'ghost' && 'bg-transparent hover:bg-[#1a2540]',
          variant === 'muted' && 'bg-[#1a2540] text-[#f0f6ff] hover:bg-[#162038]',
          size === 'default' && 'px-4 py-2 text-sm',
          size === 'icon' && 'h-11 w-11 rounded-full p-0',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button }
