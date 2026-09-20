import { cn } from "#/lib/utils.ts"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

type SpinnerProps = Omit<React.ComponentProps<typeof HugeiconsIcon>, "icon" | "size"> & {
  size?: number
}

function Spinner({ className, size = 16, ...props }: SpinnerProps) {
  return (
    <HugeiconsIcon
      icon={Loading03Icon}
      size={size}
      strokeWidth={2}
      role="status"
      aria-label="불러오는 중"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
