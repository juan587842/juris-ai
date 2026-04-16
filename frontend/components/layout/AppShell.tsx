"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2, FileText, Inbox, KanbanSquare, LayoutDashboard, LogOut, Scale, Users } from "lucide-react";

import { createBrowserClient } from "@/lib/supabase/client";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/crm", label: "CRM", icon: KanbanSquare },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/processos", label: "Processos", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
];

interface AppShellProps {
  children: React.ReactNode;
  userEmail?: string | null;
}

export function AppShell({ children, userEmail }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen bg-radial-gold text-foreground">
      <aside className="flex w-64 flex-col border-r border-border/60 bg-surface/60 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 border-b border-border/60 px-6 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20">
            <Scale className="h-4 w-4 text-primary" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Juris AI</span>
            <span className="label-caps">Legal Ops</span>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-5">
          <div className="label-caps mb-2 px-3">Navegação</div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    active ? "text-primary" : "group-hover:text-primary/80"
                  }`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/60 p-3">
          {userEmail ? (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-surface-elevated/50 px-3 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {userEmail.charAt(0).toUpperCase()}
              </div>
              <span className="truncate text-xs text-muted-foreground">
                {userEmail}
              </span>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
