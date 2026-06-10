import { clsx } from 'clsx'
import { forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'

export const Select = forwardRef(({ className, children, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={clsx(
        'flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8',
        'text-sm ring-offset-background',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
    <ChevronDown className="absolute right-2.5 top-3 h-4 w-4 opacity-50 pointer-events-none" />
  </div>
))
Select.displayName = 'Select'
