'use client'

import * as React from "react"
import { motion } from "framer-motion"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-systemBlue text-white hover:bg-systemBlue/90 glass-interactive",
        solid: "bg-systemBlue text-white hover:bg-systemBlue/90 shadow-md",
        glassProminent: "glass-tinted-blue text-white border-0",
        glassSecondary: "glass-thin text-gray-800 dark:text-gray-100 border border-white/30 dark:border-white/10",
        secondary: "bg-systemGray-5 text-label-primary hover:bg-systemGray-4 glass-thin",
        ghost: "bg-transparent text-systemBlue hover:bg-systemBlue/10",
        glass: "glass-interactive text-label-primary",
        outline: "border-2 border-gray-600 bg-white hover:bg-gray-50 text-gray-800 shadow-sm dark:border-gray-400 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100",
        destructive: "bg-systemRed text-white hover:bg-systemRed/90 glass-interactive",
        danger: "bg-red-600 text-white hover:bg-red-700 shadow-md border-0",
      },
      size: {
        sm: "h-9 px-3 py-1.5 text-footnote rounded-xl",
        default: "h-10 px-4 py-2.5 text-body rounded-xl",
        lg: "h-11 px-6 py-3 text-callout rounded-xl",
        icon: "h-10 w-10 rounded-xl",
        capsule: "h-10 px-4 py-2.5 text-body rounded-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
  fullWidth?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, fullWidth = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    return (
      <motion.div
        whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
        className={cn(fullWidth && "w-full")}
      >
        <Comp
          className={cn(buttonVariants({ variant, size }), fullWidth && "w-full", className)}
          ref={ref}
          disabled={disabled || loading}
          {...props}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Cargando...
            </span>
          ) : children}
        </Comp>
      </motion.div>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
export default Button


