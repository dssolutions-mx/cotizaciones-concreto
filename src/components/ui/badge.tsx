import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground text-shadow-xs shadow-sm hover:bg-primary/80 hover:shadow-md",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-sm",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground text-shadow-xs shadow-sm hover:bg-destructive/80 hover:shadow-md",
        outline: "text-foreground hover:shadow-sm",
        success:
          "border-transparent bg-green-500 text-white text-shadow-xs shadow-sm hover:bg-green-600 hover:shadow-md",
        warning:
          "border-transparent bg-yellow-500 text-white text-shadow-xs shadow-sm hover:bg-yellow-600 hover:shadow-md",
        info:
          "border-transparent bg-blue-500 text-white text-shadow-xs shadow-sm hover:bg-blue-600 hover:shadow-md",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(badgeVariants({ variant }), className)}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge, badgeVariants }
export default Badge
