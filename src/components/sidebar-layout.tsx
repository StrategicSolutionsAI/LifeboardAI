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
  User
} from "lucide-react"
import { supabase } from "@/utils/supabase/client"

interface SidebarLayoutProps {
  children: ReactNode
}

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/calendar", icon: Calendar, label: "Calendar" },
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
    <div className="min-h-screen bg-[#F6F6FC] pl-[120px]">
      {/* Sidebar */}
      <aside className="w-20 flex-shrink-0 border-r border-gray-100 bg-white flex flex-col items-center py-4 gap-6 fixed left-0 top-16 bottom-0 z-30">
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
      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white px-10 -ml-[120px] w-[calc(100%+120px)]">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-1 text-2xl font-semibold">
            <span className="text-theme-primary">Lifeboard</span>
            <span>AI</span>
          </div>
          <div className="flex items-center space-x-4">
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
        </div>
      </header>

      {/* Main content area */}
      {/* Main content area */}
      <div className="flex-1 overflow-y-auto pr-10 pt-6 sm:pt-10">{children}</div>
    </div>
  )
}
