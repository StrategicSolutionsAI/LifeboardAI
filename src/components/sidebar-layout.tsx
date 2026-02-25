"use client"

import { ReactNode, useCallback, useEffect, useMemo, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Calendar,
  UserCircle2,
  ListChecks,
  History,
  Settings,
  User,
  Zap,
  Menu,
  ShoppingCart,
  Plus,
} from "lucide-react"
import { supabase } from "@/utils/supabase/client"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { prefetchCalendarExperience, shouldPrefetchCalendar } from "@/lib/prefetch-calendar"

interface SidebarLayoutProps {
  children: ReactNode
}

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/tasks", icon: ListChecks, label: "Tasks" },
  { href: "/integrations", icon: Zap, label: "Integrations" },
  { href: "/shopping-list", icon: ShoppingCart, label: "Shopping" },
  { href: "/profile", icon: UserCircle2, label: "Profile" },
  { href: "/history", icon: History, label: "History" },
]

const mobileNavItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/tasks", icon: ListChecks, label: "Tasks" },
  { href: "/integrations", icon: Zap, label: "Integrations" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
]

const routeContext = [
  {
    match: (path: string) => path === "/dashboard" || path === "/dashboard/",
    title: "Dashboard",
    description: "Track your priorities and daily momentum at a glance.",
  },
  {
    match: (path: string) => path.startsWith("/calendar"),
    title: "Calendar",
    description: "Plan your schedule and drag tasks directly into time slots.",
  },
  {
    match: (path: string) => path.startsWith("/tasks"),
    title: "Tasks",
    description: "Organize work into buckets and ship high-impact items first.",
  },
  {
    match: (path: string) => path.startsWith("/integrations"),
    title: "Integrations",
    description: "Connect tools and keep all your data in one workflow.",
  },
  {
    match: (path: string) => path.startsWith("/shopping-list"),
    title: "Shopping",
    description: "Capture and manage your household list quickly.",
  },
  {
    match: (path: string) => path.startsWith("/history"),
    title: "History",
    description: "Review trends and progress across recent activity.",
  },
  {
    match: (path: string) => path.startsWith("/profile"),
    title: "Profile",
    description: "Personalize your account and preferences.",
  },
  {
    match: (path: string) => path.startsWith("/dashboard/settings"),
    title: "Settings",
    description: "Fine-tune themes, behavior, and account controls.",
  },
]

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const pathname = usePathname() || "/dashboard"
  const router = useRouter()
  const hasPrefetchedCalendarRef = useRef(false)

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/")
  }

  const isActiveRoute = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard" || pathname === "/dashboard/"
    }
    return pathname.startsWith(href)
  }

  const currentRoute = useMemo(() => {
    return (
      routeContext.find((route) => route.match(pathname)) ?? {
        title: "Workspace",
        description: "Stay focused and keep your day in flow.",
      }
    )
  }, [pathname])

  const warmCalendarNavigation = useCallback(() => {
    router.prefetch("/calendar")
    void prefetchCalendarExperience()
  }, [router])

  const getPrefetchHandlers = useCallback(
    (href: string) => {
      if (href !== "/calendar") {
        return {}
      }
      return {
        onMouseEnter: warmCalendarNavigation,
        onFocus: warmCalendarNavigation,
        onTouchStart: warmCalendarNavigation,
      }
    },
    [warmCalendarNavigation]
  )

  useEffect(() => {
    const isDashboardRoute = pathname === "/dashboard" || pathname === "/dashboard/"
    if (!isDashboardRoute || hasPrefetchedCalendarRef.current || !shouldPrefetchCalendar()) {
      return
    }

    hasPrefetchedCalendarRef.current = true

    let cancelled = false
    const warmIfActive = () => {
      if (cancelled) return
      warmCalendarNavigation()
    }

    const windowWithIdle = window as Window & {
      requestIdleCallback?: (cb: IdleRequestCallback, opts?: IdleRequestOptions) => number
      cancelIdleCallback?: (id: number) => void
    }

    if (typeof windowWithIdle.requestIdleCallback === "function") {
      const handle = windowWithIdle.requestIdleCallback(warmIfActive, { timeout: 1200 })
      return () => {
        cancelled = true
        windowWithIdle.cancelIdleCallback?.(handle)
      }
    }

    const timeout = setTimeout(warmIfActive, 600)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [pathname, warmCalendarNavigation])

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden md:grid md:h-screen md:grid-cols-[92px_1fr] md:grid-rows-[64px_1fr] md:overflow-hidden" style={{ backgroundImage: "linear-gradient(90deg, rgba(252,250,248,0.7) 0%, rgba(252,250,248,0.7) 100%), linear-gradient(90deg, #fff 0%, #fff 100%)" }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-shrink-0 flex-col border-r border-[#dbd6cf] bg-white py-3 md:row-start-2 md:sticky md:top-16 md:h-[calc(100vh-64px)] md:max-h-[calc(100vh-64px)] md:overflow-y-auto z-30 shadow-[0px_8px_30px_rgba(163,133,96,0.1)]">
        <nav className="w-full px-2 space-y-2">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = isActiveRoute(href)
            return (
              <Link
                key={href}
                href={href}
                {...getPrefetchHandlers(href)}
                className={`group relative flex w-full flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-medium transition-colors ${active
                  ? "border border-theme-primary-200 bg-theme-primary-50 text-theme-primary-700 shadow-sm"
                  : "text-[#6b7688] hover:bg-[rgba(183,148,106,0.08)] hover:text-[#314158]"
                  }`}
                aria-label={label}
                title={label}
              >
                {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-theme-primary" aria-hidden="true" />}
                <Icon className={`h-5 w-5 ${active ? "text-theme-primary" : "text-[#8e99a8] group-hover:text-[#314158]"}`} />
                <span className="leading-none">{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto px-2 pt-3">
          <Link
            href="/dashboard/settings"
            className={`group relative flex w-full flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-medium transition-colors ${isActiveRoute("/dashboard/settings")
              ? "border border-theme-primary-200 bg-theme-primary-50 text-theme-primary-700 shadow-sm"
              : "text-[#8e99a8] hover:bg-[rgba(177,145,106,0.08)] hover:text-[#314158]"
              }`}
            aria-label="Settings"
            title="Settings"
          >
            {isActiveRoute("/dashboard/settings") && (
              <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-theme-primary" aria-hidden="true" />
            )}
            <Settings
              className={`h-5 w-5 ${isActiveRoute("/dashboard/settings") ? "text-theme-primary" : "text-[#8e99a8] group-hover:text-[#314158]"
                }`}
            />
            <span className="leading-none">Settings</span>
          </Link>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#dbd6cf] px-4 md:col-span-2 md:px-8 shadow-[0px_8px_30px_rgba(163,133,96,0.1)]" style={{ backgroundImage: "linear-gradient(173.681deg, rgba(255, 255, 255, 0.98) 41.319%, rgb(255, 255, 255) 81.558%)" }}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-8 h-8 bg-theme-primary rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold">L</span>
          </div>
          <div className="hidden sm:flex items-baseline gap-1 text-[22px] font-semibold leading-none">
            <span className="text-theme-primary">Lifeboard</span>
            <span className="text-[#314158]">AI</span>
          </div>
          <div className="hidden lg:block h-8 w-px bg-[#dbd6cf]" />
          <div className="hidden lg:block min-w-0">
            <p className="truncate text-sm font-semibold text-[#314158]">{currentRoute.title}</p>
            <p className="truncate text-xs text-[#8e99a8]">{currentRoute.description}</p>
          </div>
        </div>

        <nav className="hidden xl:flex items-center gap-1 rounded-full border border-[#dbd6cf] bg-white p-1 shadow-[0px_4px_16px_rgba(163,133,96,0.06)]">
          {mobileNavItems.slice(0, 4).map(({ href, label }) => {
            const active = isActiveRoute(href)
            return (
              <Link
                key={href}
                href={href}
                {...getPrefetchHandlers(href)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${active ? "bg-theme-primary text-white" : "text-[#6b7688] hover:bg-[rgba(183,148,106,0.08)]"
                  }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link href="/tasks">
            <Button className="h-9 rounded-lg bg-theme-primary px-3 text-white hover:bg-theme-primary-600">
              <Plus className="mr-1.5 h-4 w-4" />
              Quick Task
            </Button>
          </Link>
          <button
            onClick={handleSignOut}
            className="h-9 w-9 rounded-full border border-[#dbd6cf] bg-white flex items-center justify-center hover:bg-[rgba(183,148,106,0.08)]"
            aria-label="Sign out"
          >
            <User className="h-4 w-4 text-[#314158]" />
          </button>
        </div>

        {/* Mobile actions */}
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <button className="p-2 rounded-lg hover:bg-[rgba(183,148,106,0.08)] active:bg-[rgba(183,148,106,0.14)]" aria-label="Open quick actions">
                <Menu className="h-5 w-5 text-[#314158]" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="pb-[max(1rem,env(safe-area-inset-bottom))]">
              <SheetHeader>
                <SheetTitle>{currentRoute.title}</SheetTitle>
              </SheetHeader>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {[...navItems, { href: "/dashboard/settings", icon: Settings, label: "Settings" }].map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    {...getPrefetchHandlers(href)}
                    className="flex items-center gap-2 rounded-lg border border-[#dbd6cf] px-3 py-3 text-sm font-medium text-[#314158] hover:bg-[rgba(183,148,106,0.08)]"
                  >
                    <Icon className="h-4 w-4 text-[#8e99a8]" />
                    {label}
                  </Link>
                ))}
              </div>

              <Button onClick={handleSignOut} variant="outline" className="mt-4 w-full">
                Sign out
              </Button>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Main content area */}
      <main
        id="main-content"
        className="flex-1 w-full px-4 pb-24 pt-4 sm:pt-6 md:col-start-2 md:row-start-2 md:h-full md:overflow-y-auto md:px-8 md:pb-8"
      >
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[#dbd6cf] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5 items-center py-1">
          {mobileNavItems.map(({ href, icon: Icon, label }) => {
            const active = isActiveRoute(href)
            return (
              <li key={href} className="flex justify-center">
                <Link
                  href={href}
                  {...getPrefetchHandlers(href)}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full max-w-[72px] flex-col items-center justify-center rounded-md px-2 py-2 text-[10px] font-medium transition-colors ${active ? "text-theme-primary" : "text-[#6b7688]"
                    }`}
                >
                  <Icon className={`mb-0.5 h-5 w-5 ${active ? "text-theme-primary" : "text-[#8e99a8]"}`} />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
