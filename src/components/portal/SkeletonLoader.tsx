import { Skeleton } from "@/components/ui/skeleton";

export default function SkeletonLoader({ rows = 5 }: { rows?: number }) {
  return <div className="space-y-2" aria-label="Chargement"><Skeleton className="h-10 w-full" />{Array.from({ length: rows }).map((_, index) => <Skeleton key={index} className="h-9 w-full" />)}</div>;
}