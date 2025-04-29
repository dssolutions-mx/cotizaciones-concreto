"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, CircleIcon } from "lucide-react"

interface StepsProps {
  value: number
  onChange?: (value: number) => void
  children: React.ReactNode
  className?: string
}

interface StepsItemProps {
  title: string
  description?: string
  children?: React.ReactNode
  className?: string
  isCompleted?: boolean
}

interface StepsContentProps {
  children: React.ReactNode
  className?: string
}

const StepsContext = React.createContext<{
  activeStep: number
  setActiveStep: (step: number) => void
  stepsCount: number
}>({
  activeStep: 0,
  setActiveStep: () => {},
  stepsCount: 0,
})

export function Steps({ value, onChange, children, className }: StepsProps) {
  const [activeStep, setActiveStep] = React.useState(value)
  const [stepsCount, setStepsCount] = React.useState(0)

  React.useEffect(() => {
    const childrenArray = React.Children.toArray(children)
    setStepsCount(childrenArray.length)
  }, [children])

  React.useEffect(() => {
    setActiveStep(value)
  }, [value])

  const handleStepChange = (step: number) => {
    setActiveStep(step)
    onChange?.(step)
  }

  // Renderiza solo el contenido del paso activo
  let activeContent = null
  React.Children.forEach(children, (child, index) => {
    if (React.isValidElement(child) && index === activeStep) {
      const element = child as React.ReactElement;
      activeContent = element.props.children;
    }
  });

  return (
    <StepsContext.Provider
      value={{
        activeStep,
        setActiveStep: handleStepChange,
        stepsCount,
      }}
    >
      <div className={cn("space-y-8", className)}>
        <div className="flex items-center justify-between">
          {React.Children.map(children, (child, index) => {
            if (React.isValidElement(child)) {
              return React.cloneElement(child as React.ReactElement<StepsItemProps>, {
                isCompleted: index < activeStep,
              })
            }
            return child
          })}
        </div>
        {activeContent}
      </div>
    </StepsContext.Provider>
  )
}

export function StepsItem({ title, description, className, isCompleted }: StepsItemProps) {
  const context = React.useContext(StepsContext)
  const { activeStep, setActiveStep, stepsCount } = context
  
  // Calculamos el índice del paso actual fuera de cualquier hook
  let stepIndex = -1
  
  // @ts-ignore - Implementación sin useMemo para evitar hooks dentro de hooks
  const children = context.children
  if (children) {
    const childrenArray = React.Children.toArray(children)
    for (let i = 0; i < childrenArray.length; i++) {
      const child = childrenArray[i]
      if (React.isValidElement(child)) {
        const element = child as React.ReactElement;
        if (element.props.title === title) {
          stepIndex = i;
          break;
        }
      }
    }
  }

  const isActive = activeStep === stepIndex
  const isClickable = stepIndex <= activeStep || isCompleted

  return (
    <div
      className={cn(
        "flex flex-1 items-center",
        stepIndex < stepsCount - 1 && "after:ml-2 after:h-[2px] after:flex-1 after:bg-gray-200",
        stepIndex < stepsCount - 1 && (isActive || isCompleted) && "after:bg-primary",
        className
      )}
    >
      <button
        type="button"
        className={cn(
          "group flex items-center gap-2",
          isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-70"
        )}
        onClick={() => isClickable && setActiveStep(stepIndex)}
      >
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium",
            isActive || isCompleted
              ? "border-primary bg-primary text-primary-foreground"
              : "border-gray-300 bg-white text-gray-500"
          )}
        >
          {isCompleted ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <span>{stepIndex + 1}</span>
          )}
        </div>
        <div className="flex flex-col items-start text-left">
          <span className={cn(
            "text-sm font-medium",
            isActive || isCompleted ? "text-primary" : "text-gray-700"
          )}>
            {title}
          </span>
          {description && (
            <span className="text-xs text-gray-500">{description}</span>
          )}
        </div>
      </button>
    </div>
  )
}

export function StepsContent({ children, className }: StepsContentProps) {
  return (
    <div className={cn("mt-4", className)}>
      {children}
    </div>
  )
} 