import { cn } from "@/lib/utils";

interface TricolorBarProps {
  className?: string;
  centered?: boolean;
}

export default function TricolorBar({ className, centered = false }: TricolorBarProps) {
  return (
    <div className={cn("flex h-1 w-[90px] overflow-hidden", centered && "mx-auto", className)} aria-hidden="true">
      <span className="flex-1 bg-tricolor-green" />
      <span className="flex-1 bg-tricolor-yellow" />
      <span className="flex-1 bg-tricolor-red" />
    </div>
  );
}