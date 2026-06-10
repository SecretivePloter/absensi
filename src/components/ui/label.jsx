import { clsx } from 'clsx'
import { forwardRef } from 'react'

export const Label = forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={clsx(
      'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
      className
    )}
    {...props}
  />
))
Label.displayName = 'Label'
