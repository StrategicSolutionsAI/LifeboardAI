"use client"

import { ReactNode, useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Calendar,
  UserCircle2,
  ListChecks,
  FolderOpen,
  History,
  Settings,
  Zap,
  Menu,
  ShoppingCart,
  MoreHorizontal,
  LogOut,
} from "lucide-react"
import dynamic from "next/dynamic"
import { supabase } from "@/utils/supabase/client"
import { clearAllUserCaches } from "@/lib/auth-cleanup"
import { Button } from "@/components/ui/button"
import { prefetchCalendarExperience } from "@/lib/prefetch-calendar"

// Sheet is only used for mobile hamburger menu — lazy-load to keep Radix Dialog out of desktop bundle
const Sheet = dynamic(() => import("@/components/ui/sheet").then(m => m.Sheet), { ssr: false })
const SheetContent = dynamic(() => import("@/components/ui/sheet").then(m => m.SheetContent), { ssr: false })
const SheetHeader = dynamic(() => import("@/components/ui/sheet").then(m => m.SheetHeader), { ssr: false })
const SheetTitle = dynamic(() => import("@/components/ui/sheet").then(m => m.SheetTitle), { ssr: false })
const SheetTrigger = dynamic(() => import("@/components/ui/sheet").then(m => m.SheetTrigger), { ssr: false })
import { nav, interactive } from "@/lib/styles"

interface SidebarLayoutProps {
  children: ReactNode
}

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/tasks", icon: ListChecks, label: "Tasks" },
  { href: "/folders", icon: FolderOpen, label: "Folders" },
  { href: "/integrations", icon: Zap, label: "Integrations" },
  { href: "/shopping-list", icon: ShoppingCart, label: "Shopping" },
  { href: "/profile", icon: UserCircle2, label: "Profile" },
  { href: "/history", icon: History, label: "History" },
]

const mobileNavItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/tasks", icon: ListChecks, label: "Tasks" },
  { href: "/shopping-list", icon: ShoppingCart, label: "Shopping" },
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
    match: (path: string) => path.startsWith("/folders"),
    title: "Folders",
    description: "Organize and browse your files and documents.",
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
  const [sheetOpen, setSheetOpen] = useState(false)

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
    clearAllUserCaches()
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
      <aside className="hidden md:flex flex-shrink-0 flex-col bg-white rounded-2xl border border-theme-neutral-300 py-3 w-[92px] h-[calc(100vh-40px)] overflow-y-auto z-30 shadow-[0px_8px_30px_rgba(163,133,96,0.1)]">
        {/* Logo */}
        <div className="flex flex-col items-center gap-1 px-2 pb-3 mb-1 border-b border-theme-neutral-300/50">
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
                className={`group relative flex w-full flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-medium ${interactive.transitionFast} ${activeOrNav
                  ? "bg-theme-brand-tint text-theme-text-primary"
                  : "text-theme-text-subtle hover:bg-theme-brand-tint-light hover:text-theme-text-primary"
                  }`}
                aria-label={label}
                aria-current={isActiveRoute(href) ? "page" : undefined}
                title={label}
              >
                {activeOrNav && <span className={`${nav.sidebarIndicator} ${isNavigating ? "opacity-50 transition-opacity" : ""}`} aria-hidden="true" />}
                <Icon className={`h-5 w-5 ${activeOrNav ? "text-theme-primary" : "text-theme-text-tertiary group-hover:text-theme-text-primary"} ${isNavigating ? "opacity-50 transition-opacity" : ""}`} />
                <span className="leading-none">{label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto px-2 pt-3 border-t border-theme-neutral-300/50">
          <Link
            href="/dashboard/settings"
            onClick={(e) => handleNavClick(e, "/dashboard/settings")}
            className={`group relative flex w-full flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-medium ${interactive.transitionFast} ${isActiveOrNavigating("/dashboard/settings")
              ? "bg-theme-brand-tint text-theme-text-primary"
              : "text-theme-text-tertiary hover:bg-theme-brand-tint-light hover:text-theme-text-primary"
              }`}
            aria-label="Settings"
            aria-current={isActiveRoute("/dashboard/settings") ? "page" : undefined}
            title="Settings"
          >
            {isActiveOrNavigating("/dashboard/settings") && (
              <span className={`${nav.sidebarIndicator} ${navigatingTo === "/dashboard/settings" ? "opacity-50 transition-opacity" : ""}`} aria-hidden="true" />
            )}
            <Settings
              className={`h-5 w-5 ${isActiveOrNavigating("/dashboard/settings") ? "text-theme-primary" : "text-theme-text-tertiary group-hover:text-theme-text-primary"
                } ${navigatingTo === "/dashboard/settings" ? "opacity-50 transition-opacity" : ""}`}
            />
            <span className="leading-none">Settings</span>
          </Link>
        </div>
      </aside>

      {/* Right side: Header + Content */}
      <div className="flex flex-1 flex-col min-w-0 md:gap-5">
        {/* Mobile Header */}
        <header
          className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-theme-neutral-300 px-4 md:hidden bg-gradient-to-b from-white/[0.98] to-white"
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="w-8 h-8 bg-theme-primary rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold">L</span>
            </div>
            <div className="hidden sm:flex items-baseline gap-1 text-[22px] font-semibold leading-none">
              <span className="text-theme-primary">Lifeboard</span>
              <span className="text-theme-text-primary">AI</span>
            </div>
          </div>

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <button className={`p-2 rounded-lg hover:bg-theme-brand-tint-light active:bg-[rgba(183,148,106,0.14)] ${interactive.transitionFast}`} aria-label="Open quick actions">
                <Menu className="h-5 w-5 text-theme-text-primary" />
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
                    onClick={(e) => {
                      handleNavClick(e, href)
                      setSheetOpen(false)
                    }}
                    {...getPrefetchHandlers(href)}
                    className={`flex items-center gap-2 rounded-xl border border-theme-neutral-300/80 px-3 py-3 text-sm font-medium text-theme-text-primary hover:bg-theme-brand-tint-light ${interactive.transitionFast} ${navigatingTo === href ? "bg-theme-brand-tint-light" : ""}`}
                  >
                    <Icon className="h-4 w-4 text-theme-text-tertiary" />
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
          className="flex-1 w-full px-6 sm:px-8 md:px-10 pb-24 pt-4 sm:pt-6 md:h-full md:overflow-y-auto md:pb-4 md:pt-8"
        >
          <div className="flex items-center justify-between mb-10 sm:mb-12">
            <h1 className="text-2xl font-semibold text-theme-text-primary">
              {currentRoute.title}
            </h1>
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="hidden md:inline-flex items-center gap-2 text-sm font-medium text-theme-primary border-theme-primary/40 hover:bg-theme-primary/5 hover:border-theme-primary/60"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-theme-neutral-300 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85 pwa-standalone-bottom"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="grid grid-cols-5 items-center py-1.5">
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
                  className={`relative flex w-full max-w-[72px] flex-col items-center justify-center rounded-lg px-2 py-2 text-[10px] font-medium ${interactive.transitionFast} ${activeOrNav ? "text-theme-text-primary bg-[rgba(183,148,106,0.1)]" : "text-theme-text-subtle"
                    }`}
                >
                  {activeOrNav && <span className={nav.bottomIndicator} aria-hidden="true" />}
                  <Icon className={`mb-0.5 h-5 w-5 ${activeOrNav ? "text-theme-primary" : "text-theme-text-tertiary"}`} />
                  {label}
                </Link>
              </li>
            )
          })}
          <li className="flex justify-center">
            <button
              onClick={() => setSheetOpen(true)}
              aria-label="More navigation options"
              className={`relative flex w-full max-w-[72px] flex-col items-center justify-center rounded-lg px-2 py-2 text-[10px] font-medium ${interactive.transitionFast} text-theme-text-subtle`}
            >
              <MoreHorizontal className="mb-0.5 h-5 w-5 text-theme-text-tertiary" />
              More
            </button>
          </li>
        </ul>
      </nav>
    </div>
  )
}
