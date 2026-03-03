"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ArrowRight, Menu, X } from "lucide-react"

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "/login", label: "Log In" },
]

export function LandingNav() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <>
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'py-3' : 'py-4 sm:py-6'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold tracking-tighter z-50" onClick={() => setIsMobileMenuOpen(false)}>
            Lifeboard<span className="text-warm-500">.</span>
          </Link>

          {/* Desktop floating pill */}
          <div className={`fixed inset-x-0 top-4 mx-auto w-fit hidden md:flex items-center gap-8 px-8 py-3 bg-white/80 backdrop-blur-md rounded-full border border-warm-200 shadow-sm transition-all duration-500 ${isScrolled ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm font-medium hover:text-warm-500 transition-colors focus-visible:text-warm-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-400 rounded-sm">
                {link.label}
              </Link>
            ))}
          </div>

          <div className="z-50 flex items-center gap-3">
            <Link href="/login" className="hidden md:block text-sm font-medium text-theme-text-subtle hover:text-theme-text-primary transition-colors">
              Log In
            </Link>
            <Link href="/signup" className="hidden md:block">
              <Button className="bg-warm-600 text-white hover:bg-warm-700 rounded-full px-6 h-10 text-sm font-medium transition-transform hover:scale-105">
                Get Started
              </Button>
            </Link>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="md:hidden inline-flex items-center justify-center h-11 w-11 rounded-full border border-warm-200 bg-white/95 text-theme-text-body shadow-sm"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          tabIndex={-1}
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile menu drawer */}
      <div className={`fixed left-4 right-4 top-20 z-50 rounded-2xl border border-warm-200 bg-white/95 p-4 shadow-xl backdrop-blur-md transition-all duration-300 md:hidden ${isMobileMenuOpen ? 'translate-y-0 opacity-100' : '-translate-y-3 pointer-events-none opacity-0'}`}>
        <div className="space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-theme-text-body hover:bg-warm-50 focus-visible:bg-warm-50 focus-visible:outline-2 focus-visible:outline-warm-400"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>{link.label}</span>
              <ArrowRight className="h-4 w-4 text-theme-text-tertiary" />
            </Link>
          ))}
          <Link href="/signup" className="mt-1 block" onClick={() => setIsMobileMenuOpen(false)}>
            <Button className="h-11 w-full rounded-xl bg-warm-600 text-white hover:bg-warm-700">
              Start Free Trial
            </Button>
          </Link>
        </div>
      </div>
    </>
  )
}
