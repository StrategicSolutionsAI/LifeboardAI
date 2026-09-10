"use client"

import { ReactNode, useCallback, useEffect, useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Calendar,
  ListChecks,
  FolderOpen,
  Settings,
  Wallet,
  Zap,
  Menu,
  ShoppingCart,
  StickyNote,
  Mail,
  MoreHorizontal,
  LogOut,
  UserRound,
} from "lucide-react"
import dynamic from "next/dynamic"
import { supabase } from "@/utils/supabase/client"
import { clearAllUserCaches } from "@/lib/auth-cleanup"
import { Button } from "@/components/ui/button"
import { PageHeaderActionsProvider } from "@/components/page-header-actions"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { prefetchCalendarExperience } from "@/lib/prefetch-calendar"
import { prefetchDashboardExperience } from "@/lib/prefetch-dashboard"
import { prefetchNotes } from "@/lib/prefetch-notes"
import { prefetchAllTasks, prefetchTasksExperience } from "@/lib/prefetch-tasks"
import { prefetchUserPreferences, prefetchGreetingName } from "@/lib/prefetch-user-prefs"

// Load the complete dialog together so its accessible title is present on mount.
const MobileNavigationSheet = dynamic(() => import("@/components/mobile-navigation-sheet"), { ssr: false })
import { nav, interactive, surface } from "@/lib/styles"

interface SidebarLayoutProps {
  children: ReactNode
}

// Only working destinations belong here — coming-soon pages (/profile,
// /history) stay reachable by URL but must not occupy primary nav.
const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/tasks", icon: ListChecks, label: "Tasks" },
  { href: "/budget", icon: Wallet, label: "Budget" },
  { href: "/folders", icon: FolderOpen, label: "Folders" },
  { href: "/email", icon: Mail, label: "Email" },
  { href: "/integrations", icon: Zap, label: "Integrations" },
  { href: "/shopping-list", icon: ShoppingCart, label: "Shopping" },
  { href: "/notes", icon: StickyNote, label: "Notes" },
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
  },
  {
    match: (path: string) => path.startsWith("/calendar"),
    title: "Calendar",
  },
  {
    match: (path: string) => path.startsWith("/tasks"),
    title: "Tasks",
  },
  {
    match: (path: string) => path.startsWith("/budget"),
    title: "Budget",
  },
  {
    match: (path: string) => path.startsWith("/trends"),
    title: "Trends",
  },
  {
    match: (path: string) => path.startsWith("/folders"),
    title: "Folders",
  },
  {
    match: (path: string) => path.startsWith("/email"),
    title: "Email",
  },
  {
    match: (path: string) => path.startsWith("/integrations"),
    title: "Integrations",
  },
  {
    match: (path: string) => path.startsWith("/shopping-list"),
    title: "Shopping",
  },
  {
    match: (path: string) => path.startsWith("/notes"),
    title: "Notes",
  },
  {
    match: (path: string) => path.startsWith("/history"),
    title: "History",
  },
  {
    match: (path: string) => path.startsWith("/profile"),
    title: "Profile",
  },
  {
    match: (path: string) => path.startsWith("/dashboard/settings"),
    title: "Settings",
  },
]

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const pathname = usePathname() || "/dashboard"
  const router = useRouter()
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [emailUnread, setEmailUnread] = useState(0)
  const [headerActionsTarget, setHeaderActionsTarget] = useState<HTMLDivElement | null>(null)
  const [navigationTrigger, setNavigationTrigger] = useState<HTMLButtonElement | null>(null)
  const isTaskWorkspace = pathname.startsWith("/tasks")
  const isSecondaryMobileRoute = !mobileNavItems.some(({ href }) =>
    href === "/dashboard" ? pathname === href || pathname === `${href}/` : pathname.startsWith(href)
  )

  // Fetch unread email count
  useEffect(() => {
    let cancelled = false
    // Once the API says Gmail isn't connected, skip the 2-minute poll; an
    // 'email-unread-changed' event (fired after connecting) resumes it.
    let gmailConnected = true
    const fetchUnread = () => {
      if (!gmailConnected) return
      fetch('/api/email/unread-count')
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return
          if (data.connected === false) gmailConnected = false
          setEmailUnread(data.unreadCount ?? 0)
        })
        .catch(() => {})
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 120_000) // refresh every 2 min
    // Accept absolute count from email page (overrides API-based count)
    const onUnreadChanged = (e: Event) => {
      const count = (e as CustomEvent).detail?.count as number | undefined
      if (typeof count === 'number') {
        setEmailUnread(count)
      } else {
        gmailConnected = true
        fetchUnread()
      }
    }
    window.addEventListener('email-unread-changed', onUnreadChanged)
    return () => { cancelled = true; clearInterval(interval); window.removeEventListener('email-unread-changed', onUnreadChanged) }
  }, [])

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
      }
    )
  }, [pathname])

  const warmCalendarNavigation = useCallback(() => {
    router.prefetch("/calendar")
    void prefetchCalendarExperience()
  }, [router])

  const warmDashboardNavigation = useCallback(() => {
    router.prefetch("/dashboard")
    void prefetchDashboardExperience()
    prefetchAllTasks()
    prefetchUserPreferences()
    prefetchGreetingName()
  }, [router])

  const warmTasksNavigation = useCallback(() => {
    router.prefetch("/tasks")
    void prefetchTasksExperience()
    prefetchAllTasks()
  }, [router])

  const warmNotesNavigation = useCallback(() => {
    router.prefetch("/notes")
    prefetchNotes()
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
      if (href === "/dashboard") {
        return {
          onMouseEnter: warmDashboardNavigation,
          onFocus: warmDashboardNavigation,
          onTouchStart: warmDashboardNavigation,
        }
      }
      if (href === "/tasks") {
        return {
          onMouseEnter: warmTasksNavigation,
          onFocus: warmTasksNavigation,
          onTouchStart: warmTasksNavigation,
        }
      }
      if (href === "/notes") {
        return {
          onMouseEnter: warmNotesNavigation,
          onFocus: warmNotesNavigation,
          onTouchStart: warmNotesNavigation,
        }
      }
      return {}
    },
    [warmCalendarNavigation, warmDashboardNavigation, warmTasksNavigation, warmNotesNavigation]
  )

  return (
    <PageHeaderActionsProvider target={headerActionsTarget}>
    <div className={`relative flex flex-col overflow-x-hidden md:h-[100dvh] md:flex-row md:overflow-hidden md:p-5 md:gap-5 ${isTaskWorkspace ? "h-[100dvh] overflow-hidden" : "min-h-[100dvh]"}`} style={surface.pageBgStyle}>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-theme-surface-raised focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to content
      </a>

      {/* Sidebar - Floating Panel */}
      <aside className="hidden md:flex flex-shrink-0 flex-col bg-theme-surface-raised rounded-2xl border border-theme-neutral-300 py-3 w-[92px] h-[calc(100dvh-40px)] overflow-y-auto z-30 shadow-[0px_8px_30px_rgba(163,133,96,0.1)]">
        {/* Logo */}
        <div className="flex flex-col items-center gap-1 px-2 pb-3 mb-1 border-b border-theme-neutral-300/50">
          <div className="w-9 h-9 bg-theme-primary rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold">L</span>
          </div>
          <span className="section-label text-2xs tracking-[0.5px]">Lifeboard</span>
        </div>

        <nav aria-label="Primary navigation" className="w-full px-2 space-y-1 pt-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const activeOrNav = isActiveOrNavigating(href)
            const isNavigating = navigatingTo === href
            const badgeCount = href === "/email" ? emailUnread : 0
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
                <span className="relative">
                  <Icon className={`h-5 w-5 ${activeOrNav ? "text-theme-primary" : "text-theme-text-tertiary group-hover:text-theme-text-primary"} ${isNavigating ? "opacity-50 transition-opacity" : ""}`} />
                  {badgeCount > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-theme-error-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  )}
                </span>
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Account menu" className="flex w-full flex-col items-center gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-medium text-theme-text-subtle hover:bg-theme-brand-tint-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary">
                <UserRound className="h-5 w-5" />
                Account
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end">
              <DropdownMenuItem asChild><Link href="/dashboard/settings"><Settings className="mr-2 h-4 w-4" />Settings</Link></DropdownMenuItem>
              <DropdownMenuItem onSelect={handleSignOut}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Right side: Header + Content */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        {/* Mobile Header */}
        <header
          className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-theme-neutral-300 px-4 md:hidden bg-theme-surface-raised"
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

          <button
            onClick={(event) => { setNavigationTrigger(event.currentTarget); setSheetOpen(true) }}
            className={`p-2 rounded-lg hover:bg-theme-brand-tint-light active:bg-theme-active ${interactive.transitionFast}`}
            aria-label="Open navigation"
            aria-expanded={sheetOpen}
            aria-haspopup="dialog"
          >
            <Menu className="h-5 w-5 text-theme-text-primary" />
          </button>
          {sheetOpen && (
            <MobileNavigationSheet onOpenChange={setSheetOpen} returnFocusTo={navigationTrigger}>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {/* Only destinations the bottom bar does not already show. */}
                {[...navItems.filter(({ href }) => !mobileNavItems.some((item) => item.href === href)), { href: "/dashboard/settings", icon: Settings, label: "Settings" }].map(({ href, icon: Icon, label }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={(e) => {
                      handleNavClick(e, href)
                      setSheetOpen(false)
                    }}
                    {...getPrefetchHandlers(href)}
                    aria-current={isActiveRoute(href) ? "page" : undefined}
                    className={`flex items-center gap-2 rounded-xl border border-theme-neutral-300/80 px-3 py-3 text-sm font-medium text-theme-text-primary hover:bg-theme-brand-tint-light ${interactive.transitionFast} ${isActiveOrNavigating(href) ? "bg-theme-brand-tint border-theme-primary/50" : ""}`}
                  >
                    <Icon className="h-4 w-4 text-theme-text-tertiary" />
                    {label}
                  </Link>
                ))}
              </div>

              <Button onClick={handleSignOut} variant="outline" className="mt-4 w-full">
                Sign out
              </Button>
            </MobileNavigationSheet>
          )}
        </header>

        {/* Main content area */}
        <main
          id="main-content"
          data-workspace={isTaskWorkspace ? "tasks" : undefined}
          className={`flex-1 min-h-0 w-full px-6 sm:px-8 md:px-10 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-4 sm:pt-6 md:pb-4 ${isTaskWorkspace ? "flex flex-col overflow-hidden" : "md:overflow-y-auto"}`}
        >
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-5 sm:mb-6">
            <h1 className="text-2xl font-semibold text-theme-text-primary">
              {currentRoute.title}
            </h1>
            <div ref={setHeaderActionsTarget} className="flex min-w-0 flex-wrap items-center gap-2" />
          </div>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-theme-neutral-300 bg-theme-surface-raised pwa-standalone-bottom"
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
                  className={`relative flex w-full max-w-[72px] flex-col items-center justify-center rounded-lg px-2 py-2 text-[11px] font-medium ${interactive.transitionFast} ${activeOrNav ? "text-theme-text-primary bg-theme-brand-tint" : "text-theme-text-subtle"
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
              onClick={(event) => { setNavigationTrigger(event.currentTarget); setSheetOpen(true) }}
              aria-label="More navigation options"
              aria-current={isSecondaryMobileRoute ? "true" : undefined}
              aria-expanded={sheetOpen}
              aria-haspopup="dialog"
              className={`relative flex w-full max-w-[72px] flex-col items-center justify-center rounded-lg px-2 py-2 text-[11px] font-medium ${interactive.transitionFast} ${isSecondaryMobileRoute ? "text-theme-text-primary bg-theme-brand-tint" : "text-theme-text-subtle"}`}
            >
              {isSecondaryMobileRoute && <span className={nav.bottomIndicator} aria-hidden="true" />}
              <MoreHorizontal className={`mb-0.5 h-5 w-5 ${isSecondaryMobileRoute ? "text-theme-primary" : "text-theme-text-tertiary"}`} />
              More
            </button>
          </li>
        </ul>
      </nav>
    </div>
    </PageHeaderActionsProvider>
  )
}
