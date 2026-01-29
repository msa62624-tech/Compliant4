import * as React from "react"
import { cn } from "@/lib/utils"
import { badgeVariants } from "./ui/badge-variants"
import { type VariantProps } from "class-variance-authority"

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({
  className,
  variant,
  ...props
}: BadgeProps) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge }
// badgeVariants can be imported directly from "./ui/badge-variants" if needed
