import * as React from 'react'
import { cn } from '@/lib/utils'

const Avatar = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#1e3050] bg-gradient-to-br from-[#1e3a5f] to-[#2563eb] text-sm font-extrabold text-white',
      className
    )}
    {...props}
  />
))
Avatar.displayName = 'Avatar'

const AvatarFallback = React.forwardRef(({ className, ...props }, ref) => (
  <span ref={ref} className={cn('flex h-full w-full items-center justify-center', className)} {...props} />
))
AvatarFallback.displayName = 'AvatarFallback'

export { Avatar, AvatarFallback }
