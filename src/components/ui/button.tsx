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
        // Do not combine glass-* with solid bg-* — .glass-interactive / .glass-thin set `background` and override Tailwind backgrounds, washing out text.
        primary:
          "bg-systemBlue text-white hover:bg-systemBlue/90 shadow-sm hover:shadow-none hover:translate-y-0",
        solid: "bg-systemBlue text-white hover:bg-systemBlue/90 shadow-md",
        glassProminent: "glass-tinted-blue text-white border-0",
        glassSecondary: "glass-thin text-gray-800 dark:text-gray-100 border border-white/30 dark:border-white/10",
        secondary: "bg-systemGray-5 text-label-primary hover:bg-systemGray-4 border border-black/[0.06] dark:border-white/10 shadow-sm",
        ghost: "bg-transparent text-systemBlue hover:bg-systemBlue/10",
        glass: "glass-interactive text-label-primary",
        outline: "bg-white hover:bg-gray-50 text-gray-800 shadow-sm dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-100",
        destructive:
          "bg-systemRed text-white hover:bg-systemRed/90 shadow-sm hover:shadow-none hover:translate-y-0",
        danger: "bg-red-600 text-white hover:bg-red-700 shadow-md border-0",
      },
      size: {
        // Use text-sm / text-base — NOT text-body / text-footnote / text-callout. Those custom
        // `text-*` classes are in tailwind-merge's same group as `text-white` / `text-gray-800`,
        // so cn() drops the color utilities and primary/outline buttons inherit dark body text.
        sm: "h-9 px-3 py-1.5 text-sm rounded-xl",
        default: "h-10 px-4 py-2.5 text-base rounded-xl",
        lg: "h-11 px-6 py-3 text-base rounded-xl",
        icon: "h-10 w-10 rounded-xl",
        capsule: "h-10 px-4 py-2.5 text-base rounded-full",
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
    // Framer Motion's motion.div can render different wrapper nodes on server vs first client paint,
    // which triggers hydration mismatches. Match SSR + hydration with a static wrapper, then enable motion.
    const [motionReady, setMotionReady] = React.useState(false)
    React.useEffect(() => {
      setMotionReady(true)
    }, [])

    const wrapperClass = cn(fullWidth && "w-full")
    const inner = (
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
    )

    if (!motionReady) {
      return <div className={wrapperClass}>{inner}</div>
    }

    return (
      <motion.div
        whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
        className={wrapperClass}
      >
        {inner}
      </motion.div>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
export default Button


