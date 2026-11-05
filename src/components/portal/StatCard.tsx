import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  tone?: "blue" | "mint" | "violet" | "yellow";
}

const tones = { blue: "bg-pastel-blue text-primary", mint: "bg-pastel-mint text-success", violet: "bg-pastel-violet text-primary", yellow: "bg-pastel-yellow text-warning-foreground" };

export default function StatCard({ icon: Icon, value, label, tone = "blue" }: StatCardProps) {
  return <div className="flex items-center gap-4 border bg-card p-4 shadow-soft"><div className={cn("grid h-11 w-11 place-items-center", tones[tone])}><Icon className="h-5 w-5" /></div><div><p className="font-heading text-2xl font-bold text-foreground">{value}</p><p className="text-xs uppercase text-muted-foreground">{label}</p></div></div>;
}