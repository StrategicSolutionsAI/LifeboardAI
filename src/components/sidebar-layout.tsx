"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { 
  LayoutDashboard,
  Calendar,
  UserCircle2,
  ListChecks,
  History,
  Settings,
  Search,
  Bell,
  User,
  Zap,
  Menu
} from "lucide-react"
import { supabase } from "@/utils/supabase/client"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

interface SidebarLayoutProps {
  children: ReactNode
}

const navItems = [
  { href: "/calendar", icon: Calendar, label: "Calendar" },
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/integrations", icon: Zap, label: "Integrations" },
  { href: "/profile", icon: UserCircle2, label: "Profile" },
  { href: "/tasks", icon: ListChecks, label: "Tasks" },
  { href: "/history", icon: History, label: "History" },
]

export function SidebarLayout({ children }: SidebarLayoutProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#F6F6FC] pl-0 md:pl-[120px] pb-16 md:pb-0 overflow-x-hidden">
      {/* Sidebar */}
      <aside className="hidden md:flex w-20 flex-shrink-0 border-r border-gray-100 bg-white flex-col items-center py-4 gap-6 fixed left-0 top-16 bottom-0 z-30">
        {navItems.map(({ href, icon: Icon, label }) => {
          // More precise active state detection
          let active = false;
          if (href === '/dashboard') {
            // Dashboard link should only be active when exactly on /dashboard
            // Not on sub-routes like /dashboard/settings
            active = pathname === '/dashboard' || pathname === '/dashboard/';
          } else {
            // Other links use startsWith for proper matching
            active = pathname?.startsWith(href);
          }
          return (
            <Link
              key={href}
              href={href}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
                active ? "bg-theme-primary" : "hover:bg-gray-100"
              }`}
              aria-label={label}
            >
              <Icon
                className={`w-5 h-5 ${active ? "text-white" : "text-gray-400"}`}
              />
            </Link>
          )
        })}

        <div className="flex-1" />

        {/* Settings at bottom */}
        <Link
          href="/dashboard/settings"
          className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 hover:bg-gray-100 ${
            pathname?.startsWith("/dashboard/settings") ? "bg-theme-primary" : ""
          }`}
          aria-label="Settings"
        >
          <Settings
            className={`w-5 h-5 ${
              pathname?.startsWith("/dashboard/settings") ? "text-white" : "text-gray-400"
            }`}
          />
        </Link>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white pl-4 pr-4 md:pl-5 md:pr-10 md:-ml-[120px] md:w-[calc(100%+120px)]">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3 text-2xl font-semibold">
            <div className="w-8 h-8 bg-theme-primary rounded-lg flex items-center justify-center shadow-lg">
              <span className="text-white text-sm font-bold">L</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-theme-primary">Lifeboard</span>
              <span className="text-gray-800">AI</span>
            </div>
          </div>
          <div className="hidden md:flex items-center space-x-4">
            <button className="p-2 rounded-full hover:bg-gray-100">
              <Search className="h-5 w-5 text-gray-500" />
            </button>
            <button className="p-2 rounded-full hover:bg-gray-100">
              <Bell className="h-5 w-5 text-gray-500" />
            </button>
            <button onClick={handleSignOut} className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
              <User className="h-4 w-4 text-gray-600" />
            </button>
          </div>

          {/* Mobile actions */}
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <button className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200" aria-label="Open actions">
                  <Menu className="h-5 w-5 text-gray-600" />
                </button>
              </SheetTrigger>
              <SheetContent side="bottom" className="pb-[max(1rem,env(safe-area-inset-bottom))]">
                <SheetHeader>
                  <SheetTitle>Quick actions</SheetTitle>
                </SheetHeader>
                <div className="grid grid-cols-3 gap-4 pt-4">
                  <button className="flex flex-col items-center justify-center rounded-lg border p-3 hover:bg-gray-50">
                    <Search className="h-5 w-5 text-gray-700 mb-1" />
                    <span className="text-xs text-gray-700">Search</span>
                  </button>
                  <button className="flex flex-col items-center justify-center rounded-lg border p-3 hover:bg-gray-50">
                    <Bell className="h-5 w-5 text-gray-700 mb-1" />
                    <span className="text-xs text-gray-700">Notifications</span>
                  </button>
                  <button onClick={handleSignOut} className="flex flex-col items-center justify-center rounded-lg border p-3 hover:bg-gray-50">
                    <User className="h-5 w-5 text-gray-700 mb-1" />
                    <span className="text-xs text-gray-700">Sign out</span>
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex-1 overflow-y-auto pr-4 md:pr-10 pt-4 sm:pt-10">{children}</div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <ul className="flex items-center justify-around py-1.5">
          {[
            ...navItems,
            { href: "/dashboard/settings", icon: Settings, label: "Settings" },
          ].map(({ href, icon: Icon, label }) => {
            const active = href === '/dashboard'
              ? pathname === '/dashboard' || pathname === '/dashboard/'
              : pathname?.startsWith(href)
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-label={label}
                  aria-current={active ? 'page' : undefined}
                  className={`flex flex-col items-center justify-center h-14 min-w-[56px] px-3 py-2.5 rounded-md text-[11px] font-medium transition-colors ${
                    active ? 'text-theme-primary' : 'text-gray-500'
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-theme-primary-500`}
                >
                  <Icon className={`h-6 w-6 mb-0.5 ${active ? 'text-theme-primary' : 'text-gray-400'}`} />
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
