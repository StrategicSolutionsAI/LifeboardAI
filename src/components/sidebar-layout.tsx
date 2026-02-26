"use client"

import { ReactNode, useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Calendar,
  UserCircle2,
  ListChecks,
  History,
  Settings,
  Zap,
  Menu,
  ShoppingCart,
} from "lucide-react"
import { supabase } from "@/utils/supabase/client"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { prefetchCalendarExperience } from "@/lib/prefetch-calendar"

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
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Clear navigatingTo when pathname changes (navigation completed)
  useEffect(() => {
    setNavigatingTo(null)
  }, [pathname])

  // Let Link handle navigation natively — just provide instant visual feedback
  // Next.js <Link> already prefetches routes when they enter the viewport.
  const handleNavClick = useCallback(
    (_e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      startTransition(() => {
        setNavigatingTo(href)
      })
    },
    []
  )

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

  const isActiveOrNavigating = (href: string) => {
    if (navigatingTo === href) return true
    return isActiveRoute(href)
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
      if (href === "/calendar") {
        return {
          onMouseEnter: warmCalendarNavigation,
          onFocus: warmCalendarNavigation,
          onTouchStart: warmCalendarNavigation,
        }
      }
      return {}
    },
    [warmCalendarNavigation]
  )

  return (
    <div className="relative min-h-screen flex flex-col overflow-x-hidden md:flex md:h-screen md:flex-row md:overflow-hidden md:p-5 md:gap-5" style={{ backgroundImage: "linear-gradient(90deg, rgba(252,250,248,0.7) 0%, rgba(252,250,248,0.7) 100%), linear-gradient(90deg, #fff 0%, #fff 100%)" }}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>

      {/* Sidebar - Floating Panel */}
      <aside className="hidden md:flex flex-shrink-0 flex-col bg-white rounded-2xl border border-[#dbd6cf] py-3 w-[92px] h-[calc(100vh-40px)] overflow-y-auto z-30 shadow-[0px_8px_30px_rgba(163,133,96,0.1)]">
        {/* Logo */}
        <div className="flex flex-col items-center gap-1 px-2 pb-3 mb-1 border-b border-[rgba(219,214,207,0.5)]">
          <div className="w-9 h-9 bg-theme-primary rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold">L</span>
          </div>
          <span className="section-label text-[8px] tracking-[0.5px]">Lifeboard</span>
        </div>

        <nav className="w-full px-2 space-y-1 pt-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const activeOrNav = isActiveOrNavigating(href)
            const isNavigating = navigatingTo === href
            return (
              <Link
                key={href}
                href={href}
                onClick={(e) => handleNavClick(e, href)}
                {...getPrefetchHandlers(href)}
                className={`group relative flex w-full flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-medium transition-[background-color,color] duration-150 ease-out ${activeOrNav
                  ? "bg-[rgba(183,148,106,0.12)] text-[#314158]"
                  : "text-[#6b7688] hover:bg-[rgba(183,148,106,0.08)] hover:text-[#314158]"
                  }`}
                aria-label={label}
                title={label}
              >
                {activeOrNav && <span className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[#B1916A] ${isNavigating ? "animate-pulse" : ""}`} aria-hidden="true" />}
                <Icon className={`h-5 w-5 ${activeOrNav ? "text-[#B1916A]" : "text-[#8e99a8] group-hover:text-[#314158]"} ${isNavigating ? "animate-pulse" : ""}`} />
                <span className="leading-none">{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto px-2 pt-3 border-t border-[rgba(219,214,207,0.5)]">
          <Link
            href="/dashboard/settings"
            onClick={(e) => handleNavClick(e, "/dashboard/settings")}
            className={`group relative flex w-full flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-[10px] font-medium transition-[background-color,color] duration-150 ease-out ${isActiveOrNavigating("/dashboard/settings")
              ? "bg-[rgba(183,148,106,0.12)] text-[#314158]"
              : "text-[#8e99a8] hover:bg-[rgba(183,148,106,0.08)] hover:text-[#314158]"
              }`}
            aria-label="Settings"
            title="Settings"
          >
            {isActiveOrNavigating("/dashboard/settings") && (
              <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-theme-primary ${navigatingTo === "/dashboard/settings" ? "animate-pulse" : ""}`} aria-hidden="true" />
            )}
            <Settings
              className={`h-5 w-5 ${isActiveOrNavigating("/dashboard/settings") ? "text-theme-primary" : "text-[#8e99a8] group-hover:text-[#314158]"
                } ${navigatingTo === "/dashboard/settings" ? "animate-pulse" : ""}`}
            />
            <span className="leading-none">Settings</span>
          </Link>
        </div>
      </aside>

      {/* Right side: Header + Content */}
      <div className="flex flex-1 flex-col min-w-0 md:gap-5">
        {/* Mobile Header */}
        <header
          className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#dbd6cf] px-4 md:hidden"
          style={{ backgroundImage: "linear-gradient(173.681deg, rgba(255, 255, 255, 0.98) 41.319%, rgb(255, 255, 255) 81.558%)" }}
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="w-8 h-8 bg-theme-primary rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold">L</span>
            </div>
            <div className="hidden sm:flex items-baseline gap-1 text-[22px] font-semibold leading-none">
              <span className="text-theme-primary">Lifeboard</span>
              <span className="text-[#314158]">AI</span>
            </div>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <button className="p-2 rounded-lg hover:bg-[rgba(183,148,106,0.08)] active:bg-[rgba(183,148,106,0.14)] transition-[background-color] duration-150 ease-out" aria-label="Open quick actions">
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
                    onClick={(e) => handleNavClick(e, href)}
                    {...getPrefetchHandlers(href)}
                    className={`flex items-center gap-2 rounded-xl border border-[#dbd6cf]/80 px-3 py-3 text-sm font-medium text-[#314158] hover:bg-[rgba(183,148,106,0.08)] transition-[background-color] duration-150 ease-out ${navigatingTo === href ? "bg-[rgba(183,148,106,0.08)]" : ""}`}
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
        </header>

        {/* Main content area */}
        <main
          id="main-content"
          className="flex-1 w-full px-4 pb-24 pt-4 sm:pt-6 md:h-full md:overflow-y-auto md:px-2 md:pb-4 md:pt-0"
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[#dbd6cf] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5 items-center py-1">
          {mobileNavItems.map(({ href, icon: Icon, label }) => {
            const activeOrNav = isActiveOrNavigating(href)
            return (
              <li key={href} className="flex justify-center">
                <Link
                  href={href}
                  onClick={(e) => handleNavClick(e, href)}
                  {...getPrefetchHandlers(href)}
                  aria-label={label}
                  aria-current={isActiveRoute(href) ? "page" : undefined}
                  className={`relative flex w-full max-w-[72px] flex-col items-center justify-center rounded-lg px-2 py-2 text-[10px] font-medium transition-[background-color,color] duration-150 ease-out ${activeOrNav ? "text-[#314158] bg-[rgba(183,148,106,0.1)]" : "text-[#6b7688]"
                    }`}
                >
                  {activeOrNav && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-[2px] rounded-full bg-[#B1916A]" aria-hidden="true" />}
                  <Icon className={`mb-0.5 h-5 w-5 ${activeOrNav ? "text-[#B1916A]" : "text-[#8e99a8]"}`} />
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
