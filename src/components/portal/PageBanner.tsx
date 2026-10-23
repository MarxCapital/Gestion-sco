import type { LucideIcon } from "lucide-react";
import { ChevronRight, Home } from "lucide-react";
import TricolorBar from "@/components/portal/TricolorBar";

interface PageBannerProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
}

export default function PageBanner({ title, description, icon: Icon }: PageBannerProps) {
  return (
    <section className="relative -mx-3 -mt-3 mb-8 overflow-hidden bg-primary px-4 pb-12 pt-6 text-primary-foreground sm:-mx-6 sm:-mt-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center gap-2 text-xs text-primary-foreground/75">
          <Home className="h-3.5 w-3.5" />
          <span>Tableau de bord</span><ChevronRight className="h-3.5 w-3.5" /><span>{title}</span>
        </div>
        <div className="flex items-start gap-3">
          {Icon && <div className="mt-1 grid h-10 w-10 shrink-0 place-items-center border border-primary-foreground/25 bg-primary-foreground/10"><Icon className="h-5 w-5" /></div>}
          <div>
            <h1 className="font-heading text-2xl font-bold sm:text-3xl">{title}</h1>
            <TricolorBar className="my-3" />
            {description && <p className="max-w-2xl text-sm text-primary-foreground/80">{description}</p>}
          </div>
        </div>
      </div>
      <svg className="absolute bottom-0 left-0 h-7 w-full" viewBox="0 0 1440 50" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 30C300 55 530 5 790 23c290 20 420 22 650 4v23H0Z" className="fill-background" />
      </svg>
    </section>
  );
}