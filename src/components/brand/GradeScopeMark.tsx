import { cn } from '../../utils/cn'

interface GradeScopeMarkProps {
  className?: string
}

export function GradeScopeMark({ className }: GradeScopeMarkProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[28%] bg-gradient-to-b from-[#6366F1] to-[#5145E5] shadow-sm',
        className
      )}
      aria-hidden="true"
    >
      <div className="absolute bottom-[27%] left-[18%] h-[23%] w-[17%] rounded-[24%] bg-white/90" />
      <div className="absolute bottom-[27%] left-[42%] h-[36%] w-[17%] rounded-[24%] bg-white/90" />
      <div className="absolute bottom-[27%] left-[66%] h-[50%] w-[17%] rounded-[24%] bg-white" />
    </div>
  )
}
