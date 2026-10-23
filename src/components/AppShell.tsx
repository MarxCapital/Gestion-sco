import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, ChevronDown, LogOut, Menu } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import logoImg from "@/assets/brand";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/use-notifications";
import YearSwitcher from "@/components/YearSwitcher";

export interface ShellItem {
  value: string;
  label: string;
  icon: LucideIcon;
}

export interface ShellSection {
  label: string;
  items: ShellItem[];
}

interface Props {
  title: string;
  subtitle?: string;
  sections: ShellSection[];
  active: string;
  onSelect: (value: string) => void;
  children: ReactNode;
}

const AppShell = ({ title, subtitle, sections, active, onSelect, children }: Props) => {
  const { signOut, user, role, profile } = useAuth();
  const { notifications, unread, markAllRead } = useNotifications(user?.id, role);
  const [open, setOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(
    Object.fromEntries(sections.map(s => [s.label, true])),
  );

  const activeLabel = sections.flatMap(s => s.items).find(i => i.value === active)?.label ?? "";
  const photo = (profile as any)?.photo_url as string | undefined;

  const Nav = (
    <nav className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 border-b border-sidebar-border px-4 py-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center bg-card p-1"><img src={logoImg} alt="GestionSco" className="h-full w-full object-contain" /></span>
        <div className="min-w-0">
          <p className="font-heading font-bold leading-tight truncate">{title}</p>
          {subtitle && <p className="text-xs text-sidebar-foreground/70 truncate">{subtitle}</p>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {sections.map(section => {
          const expanded = openGroups[section.label] ?? true;
          const hasChildren = section.items.length > 1;
          return (
            <div key={section.label}>
              <button
                type="button"
                onClick={() => setOpenGroups(g => ({ ...g, [section.label]: !expanded }))}
                className="flex w-full items-center justify-between px-3 py-1.5 font-heading text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/60"
              >
                {section.label}
                {hasChildren && <ChevronDown className={`w-3.5 h-3.5 transition ${expanded ? "" : "-rotate-90"}`} />}
              </button>
              {expanded && (
                <ul className="space-y-1 mt-1">
                  {section.items.map(item => (
                    <li key={item.value}>
                      <button
                        type="button"
                        onClick={() => { onSelect(item.value); setOpen(false); }}
                        className={`relative flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-sm transition ${
                          active === item.value
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:bg-sidebar-foreground"
                            : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-sidebar-border px-4 py-3 flex items-center gap-3">
        {photo
          ? <img src={photo} alt="" className="w-9 h-9 rounded-full object-cover" />
          : <div className="w-9 h-9 rounded-full bg-sidebar-accent" />}
        <div className="min-w-0 flex-1">
          <p className="font-heading text-sm font-semibold truncate">{profile?.display_name || profile?.identifier}</p>
          <p className="text-[10px] uppercase text-sidebar-foreground/55">{role || "Utilisateur"}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut} className="text-sidebar-foreground">
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
      <p className="border-t border-sidebar-border px-4 py-2 text-[10px] text-sidebar-foreground/45">GestionSco v1.0 · CS Bantè 2026</p>
    </nav>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden lg:block w-64 shrink-0 border-r border-sidebar-border">
        <div className="sticky top-0 h-screen">{Nav}</div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 border-b bg-card text-foreground shadow-soft">
          <div className="flex min-h-16 items-center gap-2 px-3 py-3 sm:px-5">
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                 <Button variant="ghost" size="icon" className="lg:hidden text-primary hover:bg-secondary" aria-label="Ouvrir le menu">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">{Nav}</SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
               <p className="font-heading text-sm font-semibold truncate">GestionSco</p>
               {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
            </div>

            <YearSwitcher onDark />

            <Popover onOpenChange={o => { if (!o && unread > 0) markAllRead(); }}>
              <PopoverTrigger asChild>
                 <Button variant="ghost" size="icon" className="relative text-primary hover:bg-secondary">
                  <Bell className="w-5 h-5" />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center">
                      {unread}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <p className="px-3 py-2 text-sm font-semibold border-b">Notifications</p>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <p className="p-3 text-sm text-muted-foreground">Aucune notification.</p>
                  ) : notifications.map(n => (
                    <div key={n.id} className={`px-3 py-2 border-b last:border-0 ${n.read_at ? "" : "bg-accent/40"}`}>
                      <p className="text-sm font-medium">{n.title}</p>
                      {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString("fr-FR")}
                      </p>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

             <Button variant="outline" size="sm" onClick={signOut} className="hidden sm:inline-flex">
              <LogOut className="w-4 h-4 mr-1" />Déconnexion
            </Button>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-6 max-w-full">{children}</main>
      </div>
    </div>
  );
};

export default AppShell;
