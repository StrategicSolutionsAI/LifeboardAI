"use client"

import { Footer } from "@/components/footer"
import Link from "next/link"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  ArrowRight, Calendar, Zap, Brain,
  Activity, CheckCircle, Repeat, Menu, X, Star,
  BarChart3, Link2, MessageCircle, Mic,
  LayoutGrid, List, Columns3, Droplets,
  Moon, Heart, Dumbbell, Coffee,
  Apple, Pill, ShoppingCart, Users,
  Wallet, Sun, CloudSun
} from "lucide-react"

/* --- SUB-COMPONENTS --- */

function DashboardMockup() {
  return (
    <div className="relative max-w-5xl mx-auto mt-16 px-4">
      {/* Subtle radial glow behind */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(177,145,106,0.1)_0%,_transparent_70%)] scale-125" />

      {/* Main dashboard card */}
      <div className="relative bg-white rounded-2xl shadow-warm-lg border border-warm-200 overflow-hidden">
        {/* Browser chrome */}
        <div className="h-10 border-b border-warm-200 flex items-center px-4 gap-2 bg-[#faf8f5]">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-300" />
          </div>
          <div className="ml-4 h-5 w-48 bg-warm-100 rounded-md" />
        </div>

        {/* App body */}
        <div className="flex min-h-[300px] md:min-h-[380px]">
          {/* Sidebar - matches actual app sidebar */}
          <div className="hidden md:flex flex-col items-center w-16 bg-[#faf8f5] border-r border-warm-200 py-4 gap-3">
            <div className="w-8 h-8 rounded-lg bg-warm-500 flex items-center justify-center text-white text-xs font-bold">L</div>
            <div className="mt-2 w-8 h-8 rounded-lg bg-warm-100 flex items-center justify-center"><LayoutGrid className="w-4 h-4 text-warm-600" /></div>
            <div className="w-8 h-8 rounded-lg hover:bg-warm-50 flex items-center justify-center"><Calendar className="w-4 h-4 text-[#8e99a8]" /></div>
            <div className="w-8 h-8 rounded-lg hover:bg-warm-50 flex items-center justify-center"><CheckCircle className="w-4 h-4 text-[#8e99a8]" /></div>
            <div className="w-8 h-8 rounded-lg hover:bg-warm-50 flex items-center justify-center"><ShoppingCart className="w-4 h-4 text-[#8e99a8]" /></div>
            <div className="w-8 h-8 rounded-lg hover:bg-warm-50 flex items-center justify-center"><BarChart3 className="w-4 h-4 text-[#8e99a8]" /></div>
          </div>

          {/* Main content area */}
          <div className="flex-1 p-4 md:p-5">
            {/* Greeting + weather */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-32 bg-warm-200 rounded" />
                  <CloudSun className="w-4 h-4 text-warm-400" />
                  <span className="text-[10px] text-[#8e99a8]">72&#176;F</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-7 flex-1 min-w-[120px] bg-warm-50 rounded-lg border border-warm-200 px-2 flex items-center">
                  <span className="text-[10px] text-[#8e99a8]">Quick add task...</span>
                </div>
              </div>
            </div>

            {/* Bucket tabs - matches actual app */}
            <div className="flex gap-1.5 mb-4 overflow-hidden">
              {[
                { name: 'Health', color: '#48B882', active: true },
                { name: 'Work', color: '#6B8AF7', active: false },
                { name: 'Personal', color: '#B1916A', active: false },
                { name: 'Finance', color: '#C4A44E', active: false },
                { name: 'Family', color: '#D07AA4', active: false },
              ].map((tab) => (
                <div
                  key={tab.name}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                    tab.active
                      ? 'text-white shadow-sm'
                      : 'bg-warm-50 text-[#8e99a8] border border-warm-200'
                  }`}
                  style={tab.active ? { backgroundColor: tab.color } : undefined}
                >
                  {tab.name}
                </div>
              ))}
            </div>

            {/* Stat cards row */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-green-50/60 rounded-lg p-2.5 border border-green-100">
                <div className="text-[9px] text-green-600 font-medium">Completed</div>
                <div className="text-lg font-bold text-green-700">12</div>
              </div>
              <div className="bg-warm-50/60 rounded-lg p-2.5 border border-warm-100">
                <div className="text-[9px] text-warm-600 font-medium">In Progress</div>
                <div className="text-lg font-bold text-warm-700">5</div>
              </div>
              <div className="bg-blue-50/60 rounded-lg p-2.5 border border-blue-100">
                <div className="text-[9px] text-blue-600 font-medium">Upcoming</div>
                <div className="text-lg font-bold text-blue-700">8</div>
              </div>
            </div>

            {/* Widget grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {/* Steps widget */}
              <div className="bg-white rounded-xl border border-warm-200 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Activity className="w-3 h-3 text-green-500" />
                  <span className="text-[9px] font-semibold text-[#6b7688]">Daily Steps</span>
                </div>
                <div className="text-base font-bold text-[#111]">8,432</div>
                <div className="mt-1 h-1.5 w-full bg-warm-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full" style={{ width: '84%' }} />
                </div>
              </div>
              {/* Water widget */}
              <div className="bg-white rounded-xl border border-warm-200 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Droplets className="w-3 h-3 text-blue-500" />
                  <span className="text-[9px] font-semibold text-[#6b7688]">Water Intake</span>
                </div>
                <div className="text-base font-bold text-[#111]">6 / 8</div>
                <div className="mt-1 h-1.5 w-full bg-warm-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: '75%' }} />
                </div>
              </div>
              {/* Mood widget */}
              <div className="hidden md:block bg-white rounded-xl border border-warm-200 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Heart className="w-3 h-3 text-pink-500" />
                  <span className="text-[9px] font-semibold text-[#6b7688]">Mood</span>
                </div>
                <div className="text-base font-bold text-[#111]">8/10</div>
                <div className="text-[9px] text-[#8e99a8]">Feeling great</div>
              </div>
            </div>
          </div>
        </div>

        {/* Chat bar at bottom - matches actual app */}
        <div className="border-t border-warm-200 bg-[#faf8f5] px-4 py-2.5 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-warm-400" />
          <div className="flex-1 h-7 bg-white rounded-full border border-warm-200 px-3 flex items-center">
            <span className="text-[10px] text-[#8e99a8]">Ask AI anything about your day...</span>
          </div>
          <Mic className="w-4 h-4 text-warm-400" />
        </div>
      </div>

      {/* Floating widget: AI Insight */}
      <div className="absolute -top-3 right-2 md:-right-4 z-10 bg-white p-3 rounded-xl shadow-warm border border-warm-200 animate-float">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-warm-50 flex items-center justify-center">
            <Brain className="w-4 h-4 text-warm-600" />
          </div>
          <div>
            <div className="text-[9px] text-warm-500 font-semibold">AI INSIGHT</div>
            <div className="text-xs font-semibold text-[#111]">Focus time at 2pm</div>
          </div>
        </div>
      </div>

      {/* Floating widget: Nutrition */}
      <div className="absolute -bottom-3 left-2 md:-left-4 z-10 bg-white p-3 rounded-xl shadow-warm border border-warm-200 animate-float" style={{ animationDelay: '3s' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
            <Apple className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <div className="text-[9px] text-green-600 font-semibold">NUTRITION</div>
            <div className="text-xs font-semibold text-[#111]">1,420 / 2,000 cal</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatItem({ value, label, icon: Icon }: { value: string; label: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center px-6 md:px-10">
      <div className="flex items-center gap-1.5">
        <span className="text-2xl md:text-3xl font-bold text-[#111]">{value}</span>
        {Icon && <Icon className="w-5 h-5 text-warm-500" />}
      </div>
      <span className="text-xs text-[#8e99a8] uppercase tracking-wider mt-1">{label}</span>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, desc, color }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string; color: string }) {
  return (
    <div className="scroll-reveal bg-white rounded-2xl border border-warm-200 p-8 hover:shadow-warm transition-shadow duration-300">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-xl font-bold mt-5 mb-3 text-[#111]">{title}</h3>
      <p className="text-[#6b7688] leading-relaxed">{desc}</p>
    </div>
  )
}

function FeatureRow({ reverse, label, title, desc, bullets, visual }: {
  reverse: boolean
  label: string
  title: string
  desc: string
  bullets: string[]
  visual: React.ReactNode
}) {
  return (
    <div className={`scroll-reveal flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} items-center gap-10 md:gap-16`}>
      <div className="md:w-1/2">
        <p className="text-xs uppercase tracking-[0.18em] text-warm-500 font-semibold mb-3">{label}</p>
        <h3 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-[#111]">{title}</h3>
        <p className="text-[#6b7688] leading-relaxed mb-6">{desc}</p>
        <ul className="space-y-2.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-[#4a5568]">
              <CheckCircle className="w-4 h-4 text-warm-500 mt-0.5 shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      </div>
      <div className="md:w-1/2 w-full">
        <div className="bg-warm-50 rounded-3xl p-6 md:p-8">
          {visual}
        </div>
      </div>
    </div>
  )
}

function Step({ number, title, desc }: { number: string; title: string; desc: string }) {
  return (
    <div className="scroll-reveal text-center">
      <span className="text-6xl font-bold text-warm-200">{number}</span>
      <h3 className="text-xl font-bold mt-3 mb-2 text-[#111]">{title}</h3>
      <p className="text-[#6b7688] leading-relaxed">{desc}</p>
    </div>
  )
}

const widgetShowcase = [
  { icon: Droplets, label: 'Water', color: 'bg-blue-50 text-blue-500' },
  { icon: Activity, label: 'Steps', color: 'bg-green-50 text-green-500' },
  { icon: Moon, label: 'Sleep', color: 'bg-indigo-50 text-indigo-500' },
  { icon: Heart, label: 'Mood', color: 'bg-pink-50 text-pink-500' },
  { icon: Dumbbell, label: 'Exercise', color: 'bg-orange-50 text-orange-500' },
  { icon: Coffee, label: 'Caffeine', color: 'bg-amber-50 text-amber-600' },
  { icon: Apple, label: 'Nutrition', color: 'bg-red-50 text-red-500' },
  { icon: Pill, label: 'Meds', color: 'bg-purple-50 text-purple-500' },
  { icon: Wallet, label: 'Budget', color: 'bg-emerald-50 text-emerald-500' },
  { icon: Users, label: 'Family', color: 'bg-rose-50 text-rose-500' },
  { icon: Sun, label: 'Journal', color: 'bg-yellow-50 text-yellow-600' },
  { icon: BarChart3, label: 'Trends', color: 'bg-cyan-50 text-cyan-500' },
]

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "/login", label: "Log In" },
]

/* --- MAIN PAGE --- */

export default function Page() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll-reveal observer
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (motionQuery.matches) {
      document.querySelectorAll('.scroll-reveal').forEach((el) => el.classList.add('is-visible'))
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible')
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )
    document.querySelectorAll('.scroll-reveal').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return (
    <main className="min-h-screen bg-[#FDFCF8] text-[#111] selection:bg-warm-600 selection:text-white overflow-x-hidden">

      {/* ── Navigation ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'py-3' : 'py-6'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold tracking-tighter z-50" onClick={() => setIsMobileMenuOpen(false)}>
            Lifeboard<span className="text-warm-500">.</span>
          </Link>

          {/* Desktop floating pill */}
          <div className={`fixed inset-x-0 top-4 mx-auto w-fit hidden md:flex items-center gap-8 px-8 py-3 bg-white/80 backdrop-blur-md rounded-full border border-warm-200 shadow-sm transition-all duration-500 ${isScrolled ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'}`}>
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm font-medium hover:text-warm-500 transition-colors">
                {link.label}
              </Link>
            ))}
          </div>

          <div className="z-50 flex items-center gap-3">
            <Link href="/login" className="hidden md:block text-sm font-medium text-[#6b7688] hover:text-[#111] transition-colors">
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
              className="md:hidden inline-flex items-center justify-center h-11 w-11 rounded-full border border-warm-200 bg-white/95 text-[#4a5568] shadow-sm"
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
              className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-[#4a5568] hover:bg-warm-50"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>{link.label}</span>
              <ArrowRight className="h-4 w-4 text-[#8e99a8]" />
            </Link>
          ))}
          <Link href="/signup" className="mt-1 block" onClick={() => setIsMobileMenuOpen(false)}>
            <Button className="h-11 w-full rounded-xl bg-warm-600 text-white hover:bg-warm-700">
              Start Free Trial
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Hero ── */}
      <section className="pt-36 md:pt-44 pb-16 px-6 relative">
        <div className="max-w-7xl mx-auto text-center mb-4">
          <div className="animate-fade-in-up inline-block mb-6 px-4 py-1.5 rounded-full border border-warm-200 bg-white/60 backdrop-blur text-xs font-semibold uppercase tracking-[0.15em] text-warm-500">
            Your life, one dashboard
          </div>
          <h1 className="animate-fade-in-up delay-100 text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[1.05] text-[#111]">
            Tasks, health &amp; AI<br />
            <span className="text-warm-500">all in one place.</span>
          </h1>
          <p className="animate-fade-in-up delay-200 text-base md:text-xl text-[#6b7688] max-w-2xl mx-auto leading-relaxed mb-10 font-light px-2 sm:px-0">
            Organize your life with customizable buckets, 30+ tracking widgets, an AI assistant, and integrations with the tools you already use.
          </p>

          <div className="animate-fade-in-up delay-300 flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link href="/signup">
              <Button className="bg-warm-600 text-white hover:bg-warm-700 h-12 px-7 rounded-full text-base transition-all hover:scale-105 shadow-warm">
                Start Free Trial <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="#features">
              <Button variant="outline" className="h-12 px-7 rounded-full text-base border-warm-300 text-warm-700 hover:bg-warm-50">
                See all features
              </Button>
            </Link>
          </div>
        </div>

        <div className="animate-fade-in-up delay-400">
          <DashboardMockup />
        </div>
      </section>

      {/* ── Social Proof Bar ── */}
      <section className="py-10 md:py-12 border-y border-warm-200 bg-white">
        <div className="max-w-5xl mx-auto flex flex-wrap justify-center gap-y-6 divide-x divide-warm-200">
          <StatItem value="30+" label="Tracking widgets" />
          <StatItem value="3" label="Task views" />
          <StatItem value="5+" label="Integrations" />
          <StatItem value="4.9" label="User rating" icon={Star} />
        </div>
      </section>

      {/* ── Feature Pillars ── */}
      <section id="features" className="py-24 md:py-32 px-6 bg-[#FDFCF8]">
        <div className="max-w-7xl mx-auto">
          <div className="scroll-reveal mb-16 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-warm-500 font-semibold mb-3">Features</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-[#111]">Everything you need, nothing you don&apos;t.</h2>
            <p className="text-lg text-[#6b7688] leading-relaxed">
              Lifeboard adapts to you. Organize tasks your way, track what matters, and let AI handle the rest.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={LayoutGrid}
              title="Custom Buckets"
              desc="Organize your life into color-coded categories like Health, Work, Personal, Finance, and Family. Each bucket is fully customizable."
              color="bg-warm-50 text-warm-600"
            />
            <FeatureCard
              icon={Columns3}
              title="Multi-View Tasks"
              desc="Switch between List, Board, and Kanban views. Drag-and-drop tasks, set due dates, add recurring patterns, and filter by status."
              color="bg-blue-50 text-blue-500"
            />
            <FeatureCard
              icon={Brain}
              title="AI Assistant"
              desc="Ask questions about your day, get smart suggestions, and create tasks with text or voice. Your AI understands your full context."
              color="bg-purple-50 text-purple-500"
            />
            <FeatureCard
              icon={Activity}
              title="Health & Wellness"
              desc="Track steps, water, sleep, mood, nutrition, medications, and more with 30+ widgets. See how wellness affects productivity."
              color="bg-green-50 text-green-500"
            />
          </div>
        </div>
      </section>

      {/* ── Widget Showcase ── */}
      <section className="py-20 md:py-28 px-6 bg-white border-y border-warm-200">
        <div className="max-w-7xl mx-auto">
          <div className="scroll-reveal text-center mb-14 max-w-2xl mx-auto">
            <p className="text-xs uppercase tracking-[0.18em] text-warm-500 font-semibold mb-3">Widgets</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-[#111]">30+ widgets for every part of your life.</h2>
            <p className="text-lg text-[#6b7688]">
              Health, wellness, nutrition, finance, family, and productivity &mdash; all in one dashboard.
            </p>
          </div>

          <div className="scroll-reveal grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 max-w-3xl mx-auto">
            {widgetShowcase.map((w) => (
              <div key={w.label} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[#faf8f5] border border-warm-200 hover:shadow-warm-sm transition-shadow">
                <div className={`w-10 h-10 rounded-xl ${w.color} flex items-center justify-center`}>
                  <w.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-[#6b7688]">{w.label}</span>
              </div>
            ))}
          </div>
          <p className="scroll-reveal text-center mt-6 text-sm text-[#8e99a8]">
            Plus meditation, gratitude journal, chores, meal planning, pomodoro timer, and many more.
          </p>
        </div>
      </section>

      {/* ── Feature Deep Dive ── */}
      <section className="py-24 md:py-32 px-6 bg-[#FDFCF8]">
        <div className="max-w-7xl mx-auto space-y-24 md:space-y-32">
          {/* AI Assistant */}
          <FeatureRow
            reverse={false}
            label="AI Assistant"
            title="Your personal AI that knows your day"
            desc="Not a generic chatbot. Lifeboard's AI sees your tasks, calendar, health data, and habits to give contextual suggestions that actually help."
            bullets={[
              "Text or voice input with real-time responses",
              "Creates tasks and schedules from conversation",
              "Summarizes your day and suggests priorities",
              "Multiple voice options for audio responses",
            ]}
            visual={
              <div className="space-y-3">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-warm-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-warm-500" />
                    <span className="text-[10px] font-semibold text-warm-600">AI ASSISTANT</span>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-warm-50 rounded-lg p-2.5 text-xs text-[#4a5568]">
                      What should I focus on today?
                    </div>
                    <div className="bg-[#faf8f5] rounded-lg p-2.5 text-xs text-[#4a5568] border border-warm-100">
                      Based on your energy patterns, tackle the project report now. You have a 2-hour focus window before lunch.
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white rounded-lg p-3 shadow-sm border border-warm-200 flex items-center gap-2">
                    <Mic className="w-4 h-4 text-warm-400" />
                    <span className="text-[10px] text-[#8e99a8]">Voice mode available</span>
                  </div>
                  <div className="flex-1 bg-white rounded-lg p-3 shadow-sm border border-warm-200 text-center">
                    <div className="text-sm font-bold text-[#111]">92%</div>
                    <div className="text-[9px] text-[#8e99a8]">Focus score</div>
                  </div>
                </div>
              </div>
            }
          />

          {/* Task Management */}
          <FeatureRow
            reverse={true}
            label="Task Management"
            title="Three views. One workflow."
            desc="Switch between List, Board, and Kanban views to match your work style. Organize tasks into custom buckets with color-coded categories."
            bullets={[
              "Kanban columns: To Do, In Progress, Done",
              "Drag-and-drop reordering and status changes",
              "Recurring tasks (daily, weekly, monthly)",
              "Smart filters by bucket, status, and due date",
            ]}
            visual={
              <div className="space-y-3">
                {/* View switcher */}
                <div className="flex gap-1.5 mb-2">
                  <div className="px-3 py-1 bg-warm-500 text-white rounded-md text-[10px] font-semibold flex items-center gap-1"><Columns3 className="w-3 h-3" /> Kanban</div>
                  <div className="px-3 py-1 bg-white border border-warm-200 text-[#8e99a8] rounded-md text-[10px] font-semibold flex items-center gap-1"><List className="w-3 h-3" /> List</div>
                  <div className="px-3 py-1 bg-white border border-warm-200 text-[#8e99a8] rounded-md text-[10px] font-semibold flex items-center gap-1"><LayoutGrid className="w-3 h-3" /> Board</div>
                </div>
                {/* Kanban columns mockup */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white rounded-lg p-2 border border-warm-200">
                    <div className="text-[9px] font-bold text-[#8e99a8] mb-2 uppercase">To Do</div>
                    <div className="space-y-1.5">
                      <div className="bg-warm-50 rounded p-1.5 text-[9px] text-[#4a5568] border-l-2 border-[#6B8AF7]">Review proposal</div>
                      <div className="bg-warm-50 rounded p-1.5 text-[9px] text-[#4a5568] border-l-2 border-[#48B882]">Grocery run</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-warm-200">
                    <div className="text-[9px] font-bold text-[#8e99a8] mb-2 uppercase">In Progress</div>
                    <div className="space-y-1.5">
                      <div className="bg-warm-50 rounded p-1.5 text-[9px] text-[#4a5568] border-l-2 border-[#C4A44E]">Budget Q2</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-warm-200">
                    <div className="text-[9px] font-bold text-[#8e99a8] mb-2 uppercase">Done</div>
                    <div className="space-y-1.5">
                      <div className="bg-green-50 rounded p-1.5 text-[9px] text-green-600 border-l-2 border-green-400 line-through">Call dentist</div>
                      <div className="bg-green-50 rounded p-1.5 text-[9px] text-green-600 border-l-2 border-green-400 line-through">Send invoice</div>
                    </div>
                  </div>
                </div>
              </div>
            }
          />

          {/* Integrations */}
          <FeatureRow
            reverse={false}
            label="Integrations"
            title="Works with your favorite tools"
            desc="Connect once and everything stays in sync. Lifeboard pulls data from your calendars, task apps, and health devices automatically."
            bullets={[
              "Todoist two-way sync for tasks",
              "Google Calendar and Outlook events",
              "Fitbit, Withings, and Google Fit health data",
              "Nutrition data with smart meal tracking",
            ]}
            visual={
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: 'Todoist', icon: CheckCircle, color: 'bg-red-50 text-red-500' },
                  { name: 'Google Cal', icon: Calendar, color: 'bg-blue-50 text-blue-500' },
                  { name: 'Fitbit', icon: Activity, color: 'bg-teal-50 text-teal-500' },
                  { name: 'Withings', icon: Heart, color: 'bg-pink-50 text-pink-500' },
                  { name: 'Google Fit', icon: Dumbbell, color: 'bg-green-50 text-green-500' },
                  { name: 'More...', icon: Link2, color: 'bg-warm-50 text-warm-600' },
                ].map((item) => (
                  <div key={item.name} className="bg-white rounded-xl p-4 shadow-sm border border-warm-200 flex flex-col items-center gap-2 hover:shadow-warm-sm transition-shadow">
                    <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-medium text-[#6b7688]">{item.name}</span>
                  </div>
                ))}
              </div>
            }
          />
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how-it-works" className="py-24 md:py-32 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="scroll-reveal mb-16">
            <p className="text-xs uppercase tracking-[0.18em] text-warm-500 font-semibold mb-3">How it works</p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-[#111]">Up and running in minutes.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            <Step
              number="1"
              title="Create your buckets"
              desc="Set up categories like Health, Work, Personal, and Family. Choose colors that resonate with you."
            />
            <Step
              number="2"
              title="Add widgets &amp; connect"
              desc="Pick from 30+ widgets and link your calendars, Todoist, and health devices with one-click OAuth."
            />
            <Step
              number="3"
              title="Let AI optimize"
              desc="Your AI assistant learns your patterns and helps you prioritize, plan, and stay on track every day."
            />
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="border-y border-warm-200 bg-[#faf8f5] py-24 md:py-28 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="scroll-reveal mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-warm-500">Pricing</p>
            <h2 className="text-4xl font-bold tracking-tight md:text-5xl text-[#111]">Start simple. Scale when you need it.</h2>
            <p className="mt-4 text-lg text-[#6b7688]">All plans include bucket tabs, task management, and your AI assistant.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                name: "Starter",
                price: "$0",
                cadence: "/month",
                cta: "Create Account",
                summary: "Personal planning with essential task management and widgets.",
                features: ["5 custom buckets", "List & Board views", "10 tracking widgets", "AI chat assistant"],
                popular: false,
              },
              {
                name: "Pro",
                price: "$18",
                cadence: "/month",
                cta: "Start Pro Trial",
                summary: "Full power with unlimited widgets, health integrations, and Kanban.",
                features: ["Unlimited buckets & widgets", "Kanban view + drag-and-drop", "Fitbit, Withings & Todoist sync", "Voice AI + priority insights"],
                popular: true,
              },
              {
                name: "Team",
                price: "$39",
                cadence: "/month",
                cta: "Contact Sales",
                summary: "Shared dashboards for families, assistants, or small teams.",
                features: ["Shared bucket boards", "Role-based access", "Family meal planning", "Priority support"],
                popular: false,
              },
            ].map((plan) => (
              <article
                key={plan.name}
                className={`scroll-reveal rounded-3xl border p-7 shadow-sm transition-all duration-200 hover:scale-[1.02] ${
                  plan.popular
                    ? "border-warm-300 bg-white ring-2 ring-warm-400 shadow-warm"
                    : "border-warm-200 bg-white"
                }`}
              >
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-[#111]">{plan.name}</h3>
                  {plan.popular && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warm-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-warm-700 border border-warm-300">
                      <Zap className="h-3.5 w-3.5" />
                      Most Popular
                    </span>
                  )}
                </div>

                <p className="mb-4 text-4xl font-bold tracking-tight text-[#111]">
                  {plan.price}
                  <span className="ml-1 text-base font-medium text-[#8e99a8]">{plan.cadence}</span>
                </p>
                <p className="mb-6 text-sm leading-6 text-[#6b7688]">{plan.summary}</p>

                <ul className="mb-8 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-[#4a5568]">
                      <CheckCircle className="h-4 w-4 text-warm-500 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link href={plan.name === "Team" ? "/login" : "/signup"}>
                  <Button
                    className={`w-full rounded-xl ${
                      plan.popular
                        ? "bg-warm-600 text-white hover:bg-warm-700"
                        : "bg-[#111] text-white hover:bg-[#314158]"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </article>
            ))}
          </div>

          <p className="text-sm text-[#8e99a8] text-center mt-8">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <Footer />
    </main>
  )
}
