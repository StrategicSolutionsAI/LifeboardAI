"use client"

import { Footer } from "@/components/footer";
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  ArrowRight, Calendar, Zap, Brain,
  Activity, CheckCircle, Repeat, TrendingUp, Menu, X, Play
} from "lucide-react"

/* --- COMPONENTS --- */

function CustomCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const cursorQuery = window.matchMedia('(min-width: 768px) and (pointer: fine)')
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!cursorQuery.matches || motionQuery.matches) return

    const moveCursor = (e: MouseEvent) => {
      if (cursorRef.current) {
        cursorRef.current.style.left = `${e.clientX}px`
        cursorRef.current.style.top = `${e.clientY}px`
      }
    }

    const handleHover = () => cursorRef.current?.classList.add('hovering')
    const handleLeave = () => cursorRef.current?.classList.remove('hovering')

    window.addEventListener('mousemove', moveCursor)

    // Attach hover listeners to interactive elements
    const interactiveElements = document.querySelectorAll('a, button, .interactive')
    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', handleHover)
      el.addEventListener('mouseleave', handleLeave)
    })

    return () => {
      window.removeEventListener('mousemove', moveCursor)
      interactiveElements.forEach(el => {
        el.removeEventListener('mouseenter', handleHover)
        el.removeEventListener('mouseleave', handleLeave)
      })
    }
  }, [])

  return <div ref={cursorRef} className="custom-cursor hidden md:block" />
}

function MouseParallax() {
  const [offset, setOffset] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const pointerQuery = window.matchMedia('(pointer: fine)')
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!pointerQuery.matches || motionQuery.matches) return

    const handleMove = (e: MouseEvent) => {
      const x = (e.clientX - window.innerWidth / 2) / window.innerWidth
      const y = (e.clientY - window.innerHeight / 2) / window.innerHeight
      setOffset({ x, y })
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  return (
    <div className="perspective-1000 relative w-full max-w-5xl mx-auto h-[600px] flex items-center justify-center">
      {/* Layer 1: Back Blobs */}
      <div
        className="absolute inset-0 transition-transform duration-700 ease-out"
        style={{ transform: `translate(${offset.x * -20}px, ${offset.y * -20}px)` }}
      >
        <div className="absolute top-20 left-20 w-72 h-72 bg-warm-300/30 rounded-full blur-[100px]" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-warm-200/30 rounded-full blur-[100px]" />
      </div>

      {/* Layer 2: Main Dashboard - Tilted */}
      <div
        className="relative z-10 w-[90%] h-[80%] bg-white rounded-2xl shadow-2xl border border-[#dbd6cf] overflow-hidden transition-transform duration-500 ease-out preserve-3d"
        style={{
          transform: `rotateY(${offset.x * 5}deg) rotateX(${offset.y * -5}deg) translateZ(0px)`
        }}
      >
        {/* Header */}
        <div className="h-12 border-b border-[#dbd6cf] flex items-center px-4 gap-2 bg-[#faf8f5]/50">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
            <div className="w-3 h-3 rounded-full bg-green-400/80" />
          </div>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-12 gap-6 h-full bg-white">
          <div className="col-span-3 border-r border-[#faf8f5] pr-4 space-y-4 hidden md:block">
            <div className="h-8 w-full bg-[#f5f0eb] rounded-lg animate-pulse" />
            <div className="h-8 w-3/4 bg-[#faf8f5] rounded-lg" />
            <div className="h-8 w-5/6 bg-[#faf8f5] rounded-lg" />
          </div>
          <div className="col-span-12 md:col-span-9 space-y-6">
            <div className="h-32 w-full bg-gradient-to-r from-warm-50 to-warm-100 rounded-xl p-6 flex flex-col justify-between">
              <div className="h-6 w-1/3 bg-white/50 rounded-md" />
              <div className="flex gap-4">
                <div className="h-12 w-12 bg-white/80 rounded-full" />
                <div className="h-12 w-12 bg-white/80 rounded-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-40 bg-[#faf8f5] rounded-xl border border-[#dbd6cf]" />
              <div className="h-40 bg-[#faf8f5] rounded-xl border border-[#dbd6cf]" />
            </div>
          </div>
        </div>
      </div>

      {/* Layer 3: Floating Widgets - Closer Z-Index */}
      <div
        className="absolute top-1/4 right-0 md:-right-12 z-20 bg-white p-4 rounded-xl shadow-xl border border-[#dbd6cf] transition-transform duration-300 ease-out"
        style={{ transform: `translate(${offset.x * 40}px, ${offset.y * 40}px) translateZ(50px)` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <Activity className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <div className="text-xs text-[#8e99a8]">Daily Steps</div>
            <div className="text-lg font-bold">8,432</div>
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-1/4 left-0 md:-left-12 z-20 bg-white p-4 rounded-xl shadow-xl border border-[#dbd6cf] transition-transform duration-300 ease-out"
        style={{ transform: `translate(${offset.x * 30}px, ${offset.y * 30}px) translateZ(80px)` }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-warm-100 flex items-center justify-center">
            <Brain className="w-5 h-5 text-warm-700" />
          </div>
          <div>
            <div className="text-xs text-[#8e99a8]">AI Insight</div>
            <div className="text-sm font-semibold">Focus time scheduled</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StackingCard({ index, title, desc, icon: Icon, color }: { index: number, title: string, desc: string, icon: any, color: string }) {
  return (
    <div
      className="sticky top-32 w-full max-w-4xl mx-auto mb-12 bg-white rounded-3xl border border-[#dbd6cf] shadow-xl overflow-hidden transform transition-all duration-500"
      style={{
        top: `${120 + index * 40}px`,
        zIndex: index,
        transform: `scale(${1 - index * 0.05})`
      }}
    >
      <div className="flex flex-col md:flex-row h-full min-h-[400px]">
        <div className={`p-12 md:w-1/2 flex flex-col justify-center ${color} text-white`}>
          <Icon className="w-12 h-12 mb-6" />
          <h3 className="text-4xl font-bold mb-4 font-serif tracking-tight">{title}</h3>
          <p className="text-lg opacity-90 leading-relaxed">{desc}</p>
        </div>
        <div className="md:w-1/2 bg-[#faf8f5] relative overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(#dbd6cf_1px,transparent_1px)] [background-size:16px_16px] opacity-50" />
          <div className="relative w-3/4 h-3/4 bg-white rounded-xl shadow-warm-lg border border-[#dbd6cf] p-6 transform rotate-3 hover:rotate-0 transition-transform duration-500">
            <div className="h-4 w-1/3 bg-[#f5f0eb] rounded mb-4" />
            <div className="space-y-2">
              <div className="h-2 w-full bg-[#faf8f5] rounded" />
              <div className="h-2 w-5/6 bg-[#faf8f5] rounded" />
              <div className="h-2 w-4/6 bg-[#faf8f5] rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const landingLinks = [
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
  { href: "/login", label: "Login" },
]

export default function Page() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <main className="landing-cursor-enabled min-h-screen bg-[#FDFCF8] text-[#111] selection:bg-black selection:text-white overflow-x-hidden">
      <CustomCursor />
      <div className="noise-bg" />

      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'py-4' : 'py-8'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <Link
            href="/"
            className="text-2xl font-bold tracking-tighter interactive z-50"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Lifeboard<span className="text-warm-500">.</span>
          </Link>

          <div className={`fixed inset-x-0 top-4 mx-auto w-fit hidden md:flex items-center gap-8 px-8 py-3 bg-white/80 backdrop-blur-md rounded-full border border-[#dbd6cf] shadow-sm transition-all duration-500 ${isScrolled ? 'translate-y-0 opacity-100' : 'translate-y-[-100%] opacity-0'}`}>
            {landingLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium hover:text-warm-500 transition-colors interactive"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="z-50 flex items-center gap-2">
            <Link href="/signup" className="interactive hidden md:block">
              <Button className="bg-black text-white hover:bg-[#314158] rounded-full px-6 h-12 text-sm font-medium transition-transform hover:scale-105">
                Get Started
              </Button>
            </Link>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="md:hidden inline-flex items-center justify-center h-11 w-11 rounded-full border border-[#dbd6cf] bg-white/95 text-[#4a5568] shadow-sm"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </nav>

      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-40 bg-black/20 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <div
        className={`fixed left-4 right-4 top-20 z-50 rounded-2xl border border-[#dbd6cf] bg-white/95 p-4 shadow-xl backdrop-blur-md transition-all duration-300 md:hidden ${isMobileMenuOpen ? "translate-y-0 opacity-100" : "-translate-y-3 pointer-events-none opacity-0"
          }`}
      >
        <div className="space-y-2">
          {landingLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-[#4a5568] hover:bg-[#faf8f5]"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <span>{link.label}</span>
              <ArrowRight className="h-4 w-4 text-[#8e99a8]" />
            </Link>
          ))}
          <Link
            href="/signup"
            className="mt-1 block"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <Button className="h-11 w-full rounded-xl bg-black text-white hover:bg-[#314158]">
              Start Free Trial
            </Button>
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <section className="pt-48 pb-32 px-6 relative">
        <div className="max-w-7xl mx-auto text-center mb-20">
          <div className="inline-block mb-6 px-4 py-1.5 rounded-full border border-[#dbd6cf] bg-white/50 backdrop-blur text-xs font-mono uppercase tracking-widest text-[#8e99a8] animate-fade-in-up">
            System v2.0 Available Now
          </div>
          <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tighter mb-8 leading-[0.9] text-black">
            <span className="block overflow-hidden">
              <span className="block animate-reveal-up">Organize</span>
            </span>
            <span className="block overflow-hidden text-warm-500">
              <span className="block animate-reveal-up delay-100">Your Chaos.</span>
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-[#6b7688] max-w-2xl mx-auto leading-relaxed mb-12 font-light">
            The operating system for high-performance humans. Unify your calendar, tasks, and health in one editorial-grade interface.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link href="/signup" className="interactive">
              <Button className="bg-warm-600 text-white hover:bg-warm-700 h-14 px-8 rounded-full text-lg transition-all hover:scale-105 shadow-warm-lg shadow-warm-200">
                Start Free Trial
              </Button>
            </Link>
            <Button variant="ghost" className="h-14 px-8 rounded-full text-lg hover:bg-[#f5f0eb] interactive">
              View Showreel <Play className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        <MouseParallax />
      </section>

      {/* Infinite Marquee */}
      <div className="py-16 border-y border-[#dbd6cf] bg-white overflow-hidden">
        <div className="animate-marquee flex whitespace-nowrap">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="flex items-center gap-24 px-12">
              {['WIRED', 'TechCrunch', 'TheVerge', 'FastCompany', 'Monocle', 'Vogue'].map((brand) => (
                <span key={brand} className="text-4xl md:text-6xl font-bold text-[#ebe5de] font-serif tracking-tighter uppercase">
                  {brand}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Sticky Stacking Cards Feature Section */}
      <section id="features" className="py-32 px-6 bg-[#faf8f5]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-24 max-w-3xl">
            <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
              More than a tool.<br />
              <span className="text-[#8e99a8]">A methodology.</span>
            </h2>
            <p className="text-xl text-[#6b7688] leading-relaxed">
              Most apps force you to adapt to them. Lifeboard adapts to your biology, your schedule, and your goals.
            </p>
          </div>

          <div className="relative">
            <StackingCard
              index={0}
              title="Universal Sync"
              desc="Connect Google, Outlook, and Apple Calendars. We create a unified timeline of your life, automatically finding free slots for deep work."
              icon={Calendar}
              color="bg-warm-600"
            />
            <StackingCard
              index={1}
              title="Biological Prime Time"
              desc="Our AI analyzes your energy levels and health data to schedule demanding tasks when you are naturally most alert."
              icon={Activity}
              color="bg-warm-700"
            />
            <StackingCard
              index={2}
              title="Contextual Intelligence"
              desc="The first AI that understands the difference between 'Call Mom' and 'Call Client'. It categorizes and prioritizes automatically."
              icon={Brain}
              color="bg-black"
            />
          </div>
        </div>
      </section>

      {/* Horizontal Bento / Grid */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[600px]">
            <div className="col-span-1 md:col-span-2 bg-[#F3F2ED] rounded-3xl p-10 relative overflow-hidden group interactive cursor-none">
              <div className="relative z-10">
                <h3 className="text-3xl font-bold mb-4">Habit Stacking</h3>
                <p className="text-[#6b7688] max-w-md">Build routines that stick by chaining small wins. Visual progress bars make consistency addictive.</p>
              </div>
              <div className="absolute right-[-50px] bottom-[-50px] w-[300px] h-[300px] bg-white rounded-full opacity-50 group-hover:scale-150 transition-transform duration-700 ease-out" />
              <Repeat className="absolute bottom-10 right-10 w-24 h-24 text-[#b8b0a8] group-hover:text-black transition-colors duration-500" />
            </div>
            <div className="col-span-1 bg-black text-white rounded-3xl p-10 flex flex-col justify-between interactive cursor-none group">
              <div>
                <TrendingUp className="w-12 h-12 mb-6 text-warm-400" />
                <h3 className="text-3xl font-bold">Analytics</h3>
              </div>
              <div>
                <div className="text-6xl font-bold mb-2 group-hover:text-warm-400 transition-colors">94%</div>
                <p className="text-[#8e99a8]">Productivity Score</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-y border-[#dbd6cf] bg-white py-28 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-warm-500">Pricing</p>
            <h2 className="text-4xl font-bold tracking-tight md:text-5xl">Start simple. Scale when you need it.</h2>
            <p className="mt-4 text-lg text-[#6b7688]">All plans include calendar sync, task intelligence, and a unified command center.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                name: "Starter",
                price: "$0",
                cadence: "/month",
                cta: "Create Account",
                summary: "Personal planning with essential scheduling and task workflows.",
                features: ["1 workspace", "Calendar + task sync", "Daily planning view"],
                popular: false,
              },
              {
                name: "Pro",
                price: "$18",
                cadence: "/month",
                cta: "Start Pro Trial",
                summary: "Advanced automation, deeper insights, and cross-surface workflows.",
                features: ["Unlimited widgets", "Health integrations", "Priority AI insights"],
                popular: true,
              },
              {
                name: "Team",
                price: "$39",
                cadence: "/month",
                cta: "Contact Sales",
                summary: "Shared planning space for families, assistants, or small teams.",
                features: ["Shared boards", "Role-based access", "Priority support"],
                popular: false,
              },
            ].map((plan) => (
              <article
                key={plan.name}
                className={`rounded-3xl border p-7 shadow-sm transition-all ${plan.popular ? "border-warm-300 bg-warm-50/40 shadow-[0px_4px_16px_rgba(163,133,96,0.06)]" : "border-[#dbd6cf] bg-white"
                  }`}
              >
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-xl font-semibold">{plan.name}</h3>
                  {plan.popular && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warm-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                      <Zap className="h-3.5 w-3.5" />
                      Most Popular
                    </span>
                  )}
                </div>

                <p className="mb-4 text-4xl font-bold tracking-tight">
                  {plan.price}
                  <span className="ml-1 text-base font-medium text-[#8e99a8]">{plan.cadence}</span>
                </p>
                <p className="mb-6 text-sm leading-6 text-[#6b7688]">{plan.summary}</p>

                <ul className="mb-8 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-[#4a5568]">
                      <CheckCircle className="h-4 w-4 text-warm-500" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link href={plan.name === "Team" ? "/login" : "/signup"}>
                  <Button
                    className={`w-full rounded-xl ${plan.popular ? "bg-warm-600 text-white hover:bg-warm-700" : "bg-black text-white hover:bg-[#314158]"
                      }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Massive Footer CTA */}
      <Footer />
    </main>
  )
}
