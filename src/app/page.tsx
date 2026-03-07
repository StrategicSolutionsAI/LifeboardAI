import { Footer } from "@/components/footer"
import { LandingNav } from "@/components/landing/landing-nav"
import { ScrollReveal } from "@/components/landing/scroll-reveal"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  ArrowRight, Calendar, Zap, Brain,
  Activity, CheckCircle, Star,
  BarChart3, Link2, MessageCircle, Mic,
  LayoutGrid, List, Columns3, Droplets,
  Moon, Heart, Dumbbell, Coffee,
  Apple, Pill, ShoppingCart, Users,
  Wallet, Sun, CloudSun
} from "lucide-react"

/* --- SUB-COMPONENTS --- */

function DashboardMockup() {
  return (
    <div role="img" aria-label="Preview of the LifeboardAI dashboard" className="relative max-w-5xl mx-auto mt-10 sm:mt-16 px-0 sm:px-4">
      {/* Subtle radial glow behind */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(177,145,106,0.1)_0%,_transparent_70%)] scale-125" />

      {/* Main dashboard card */}
      <div className="relative bg-white rounded-2xl shadow-warm-lg border border-warm-200 overflow-hidden">
        {/* Browser chrome */}
        <div className="h-10 border-b border-warm-200 flex items-center px-4 gap-2 bg-theme-surface-alt">
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
          <div className="hidden md:flex flex-col items-center w-16 bg-theme-surface-alt border-r border-warm-200 py-4 gap-3">
            <div className="w-8 h-8 rounded-lg bg-warm-500 flex items-center justify-center text-white text-xs font-bold">L</div>
            <div className="mt-2 w-8 h-8 rounded-lg bg-warm-100 flex items-center justify-center"><LayoutGrid className="w-4 h-4 text-warm-600" /></div>
            <div className="w-8 h-8 rounded-lg hover:bg-warm-50 flex items-center justify-center"><Calendar className="w-4 h-4 text-theme-text-tertiary" /></div>
            <div className="w-8 h-8 rounded-lg hover:bg-warm-50 flex items-center justify-center"><CheckCircle className="w-4 h-4 text-theme-text-tertiary" /></div>
            <div className="w-8 h-8 rounded-lg hover:bg-warm-50 flex items-center justify-center"><ShoppingCart className="w-4 h-4 text-theme-text-tertiary" /></div>
            <div className="w-8 h-8 rounded-lg hover:bg-warm-50 flex items-center justify-center"><BarChart3 className="w-4 h-4 text-theme-text-tertiary" /></div>
          </div>

          {/* Main content area */}
          <div className="flex-1 p-4 md:p-5">
            {/* Greeting + weather */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-32 bg-warm-200 rounded" />
                  <CloudSun className="w-4 h-4 text-warm-400" />
                  <span className="text-[10px] text-theme-text-tertiary">72&#176;F</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-7 flex-1 min-w-[120px] bg-warm-50 rounded-lg border border-warm-200 px-2 flex items-center">
                  <span className="text-[10px] text-theme-text-tertiary">Quick add task...</span>
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
                      : 'bg-warm-50 text-theme-text-tertiary border border-warm-200'
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
                  <span className="text-[9px] font-semibold text-theme-text-subtle">Daily Steps</span>
                </div>
                <div className="text-base font-bold text-theme-text-primary">8,432</div>
                <div className="mt-1 h-1.5 w-full bg-warm-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full" style={{ width: '84%' }} />
                </div>
              </div>
              {/* Water widget */}
              <div className="bg-white rounded-xl border border-warm-200 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Droplets className="w-3 h-3 text-blue-500" />
                  <span className="text-[9px] font-semibold text-theme-text-subtle">Water Intake</span>
                </div>
                <div className="text-base font-bold text-theme-text-primary">6 / 8</div>
                <div className="mt-1 h-1.5 w-full bg-warm-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: '75%' }} />
                </div>
              </div>
              {/* Mood widget */}
              <div className="hidden md:block bg-white rounded-xl border border-warm-200 p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Heart className="w-3 h-3 text-pink-500" />
                  <span className="text-[9px] font-semibold text-theme-text-subtle">Mood</span>
                </div>
                <div className="text-base font-bold text-theme-text-primary">8/10</div>
                <div className="text-[9px] text-theme-text-tertiary">Feeling great</div>
              </div>
            </div>
          </div>
        </div>

        {/* Chat bar at bottom - matches actual app */}
        <div className="border-t border-warm-200 bg-theme-surface-alt px-4 py-2.5 flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-warm-400" />
          <div className="flex-1 h-7 bg-white rounded-full border border-warm-200 px-3 flex items-center">
            <span className="text-[10px] text-theme-text-tertiary">Ask AI anything about your day...</span>
          </div>
          <Mic className="w-4 h-4 text-warm-400" />
        </div>
      </div>

      {/* Floating widget: AI Insight */}
      <div className="hidden sm:block absolute -top-3 right-2 md:-right-4 z-10 bg-white p-3 rounded-xl shadow-warm border border-warm-200 animate-float">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-warm-50 flex items-center justify-center">
            <Brain className="w-4 h-4 text-warm-600" />
          </div>
          <div>
            <div className="text-[9px] text-warm-500 font-semibold">AI INSIGHT</div>
            <div className="text-xs font-semibold text-theme-text-primary">Focus time at 2pm</div>
          </div>
        </div>
      </div>

      {/* Floating widget: Nutrition */}
      <div className="hidden sm:block absolute -bottom-3 left-2 md:-left-4 z-10 bg-white p-3 rounded-xl shadow-warm border border-warm-200 animate-float" style={{ animationDelay: '3s' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
            <Apple className="w-4 h-4 text-green-600" />
          </div>
          <div>
            <div className="text-[9px] text-green-600 font-semibold">NUTRITION</div>
            <div className="text-xs font-semibold text-theme-text-primary">1,420 / 2,000 cal</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatItem({ value, label, icon: Icon }: { value: string; label: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="flex flex-col items-center px-4 sm:px-6 md:px-10">
      <div className="flex items-center gap-1.5">
        <span className="text-2xl md:text-3xl font-bold text-theme-text-primary">{value}</span>
        {Icon && <Icon className="w-5 h-5 text-warm-500" />}
      </div>
      <span className="text-[10px] sm:text-xs text-theme-text-tertiary uppercase tracking-wider mt-1">{label}</span>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, desc, color }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string; color: string }) {
  return (
    <div className="scroll-reveal bg-white rounded-2xl border border-warm-200 p-5 sm:p-8 hover:shadow-warm transition-shadow duration-300">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-lg sm:text-xl font-bold mt-5 mb-3 text-theme-text-primary">{title}</h3>
      <p className="text-theme-text-subtle leading-relaxed">{desc}</p>
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
        <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-4 text-theme-text-primary">{title}</h3>
        <p className="text-theme-text-subtle leading-relaxed mb-6">{desc}</p>
        <ul className="space-y-2.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5 text-sm text-theme-text-body">
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
      <h3 className="text-xl font-bold mt-3 mb-2 text-theme-text-primary">{title}</h3>
      <p className="text-theme-text-subtle leading-relaxed">{desc}</p>
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

/* --- MAIN PAGE --- */

export default function Page() {
  return (
    <main className="min-h-[100dvh] bg-[#FDFCF8] text-theme-text-primary selection:bg-warm-600 selection:text-white overflow-x-hidden">
      <LandingNav />
      <ScrollReveal />

      {/* ── Hero ── */}
      <section className="pt-28 sm:pt-36 md:pt-44 pb-16 px-4 sm:px-6 relative">
        <div className="max-w-7xl mx-auto text-center mb-4">
          <div className="animate-fade-in-up inline-block mb-6 px-4 py-1.5 rounded-full border border-warm-200 bg-white/60 backdrop-blur text-xs font-semibold uppercase tracking-[0.15em] text-warm-500">
            Your life, one dashboard
          </div>
          <h1 className="animate-fade-in-up delay-100 text-[2rem] sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight mb-8 leading-[1.2] sm:leading-[1.1] text-theme-text-primary">
            Tasks, health &amp; AI<br />
            <span className="text-warm-500">all in one place.</span>
          </h1>
          <p className="animate-fade-in-up delay-200 text-[0.95rem] sm:text-base md:text-xl text-theme-text-subtle max-w-2xl mx-auto leading-relaxed mb-10 font-light px-0">
            Organize your life with customizable buckets, 30+ tracking widgets, an AI assistant, and integrations with the tools you already use.
          </p>

          <div className="animate-fade-in-up delay-300 flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link href="/signup" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-warm-600 text-white hover:bg-warm-700 h-12 px-7 rounded-full text-base transition-all hover:scale-105 shadow-warm">
                Start Free Trial <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="#features" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto h-12 px-7 rounded-full text-base border-warm-300 text-warm-700 hover:bg-warm-50">
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
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-0 sm:divide-x sm:divide-warm-200 px-6 sm:px-0">
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
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 text-theme-text-primary">Everything you need, nothing you don&apos;t.</h2>
            <p className="text-lg text-theme-text-subtle leading-relaxed">
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
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4 text-theme-text-primary">30+ widgets for every part of your life.</h2>
            <p className="text-lg text-theme-text-subtle">
              Health, wellness, nutrition, finance, family, and productivity &mdash; all in one dashboard.
            </p>
          </div>

          <div className="scroll-reveal grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-4 max-w-3xl mx-auto">
            {widgetShowcase.map((w) => (
              <div key={w.label} className="flex flex-col items-center gap-1.5 sm:gap-2 p-3 sm:p-4 rounded-2xl bg-theme-surface-alt border border-warm-200 hover:shadow-warm-sm transition-shadow">
                <div className={`w-10 h-10 rounded-xl ${w.color} flex items-center justify-center`}>
                  <w.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-theme-text-subtle">{w.label}</span>
              </div>
            ))}
          </div>
          <p className="scroll-reveal text-center mt-6 text-sm text-theme-text-tertiary">
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
                    <div className="bg-warm-50 rounded-lg p-2.5 text-xs text-theme-text-body">
                      What should I focus on today?
                    </div>
                    <div className="bg-theme-surface-alt rounded-lg p-2.5 text-xs text-theme-text-body border border-warm-100">
                      Based on your energy patterns, tackle the project report now. You have a 2-hour focus window before lunch.
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-white rounded-lg p-3 shadow-sm border border-warm-200 flex items-center gap-2">
                    <Mic className="w-4 h-4 text-warm-400" />
                    <span className="text-[10px] text-theme-text-tertiary">Voice mode available</span>
                  </div>
                  <div className="flex-1 bg-white rounded-lg p-3 shadow-sm border border-warm-200 text-center">
                    <div className="text-sm font-bold text-theme-text-primary">92%</div>
                    <div className="text-[9px] text-theme-text-tertiary">Focus score</div>
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
                  <div className="px-3 py-1 bg-white border border-warm-200 text-theme-text-tertiary rounded-md text-[10px] font-semibold flex items-center gap-1"><List className="w-3 h-3" /> List</div>
                  <div className="px-3 py-1 bg-white border border-warm-200 text-theme-text-tertiary rounded-md text-[10px] font-semibold flex items-center gap-1"><LayoutGrid className="w-3 h-3" /> Board</div>
                </div>
                {/* Kanban columns mockup */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-white rounded-lg p-2 border border-warm-200">
                    <div className="text-[9px] font-bold text-theme-text-tertiary mb-2 uppercase">To Do</div>
                    <div className="space-y-1.5">
                      <div className="bg-warm-50 rounded p-1.5 text-[9px] text-theme-text-body border-l-2 border-[#6B8AF7]">Review proposal</div>
                      <div className="bg-warm-50 rounded p-1.5 text-[9px] text-theme-text-body border-l-2 border-[#48B882]">Grocery run</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-warm-200">
                    <div className="text-[9px] font-bold text-theme-text-tertiary mb-2 uppercase">In Progress</div>
                    <div className="space-y-1.5">
                      <div className="bg-warm-50 rounded p-1.5 text-[9px] text-theme-text-body border-l-2 border-[#C4A44E]">Budget Q2</div>
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-2 border border-warm-200">
                    <div className="text-[9px] font-bold text-theme-text-tertiary mb-2 uppercase">Done</div>
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
                    <span className="text-[10px] font-medium text-theme-text-subtle">{item.name}</span>
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
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-theme-text-primary">Up and running in minutes.</h2>
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
      <section id="pricing" className="border-y border-warm-200 bg-theme-surface-alt py-24 md:py-28 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="scroll-reveal mx-auto mb-14 max-w-2xl text-center">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-warm-500">Pricing</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight md:text-5xl text-theme-text-primary">Start simple. Scale when you need it.</h2>
            <p className="mt-4 text-lg text-theme-text-subtle">All plans include bucket tabs, task management, and your AI assistant.</p>
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
                className={`scroll-reveal rounded-3xl border p-5 sm:p-7 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-warm ${
                  plan.popular
                    ? "border-warm-300 bg-white ring-2 ring-warm-400 shadow-warm"
                    : "border-warm-200 bg-white"
                }`}
              >
                <div className="mb-5 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-theme-text-primary">{plan.name}</h3>
                  {plan.popular && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warm-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-warm-700 border border-warm-300">
                      <Zap className="h-3.5 w-3.5" />
                      Most Popular
                    </span>
                  )}
                </div>

                <p className="mb-4 text-4xl font-bold tracking-tight text-theme-text-primary">
                  {plan.price}
                  <span className="ml-1 text-base font-medium text-theme-text-tertiary">{plan.cadence}</span>
                </p>
                <p className="mb-6 text-sm leading-6 text-theme-text-subtle">{plan.summary}</p>

                <ul className="mb-8 space-y-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-theme-text-body">
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
                        : "bg-[#111] text-white hover:bg-theme-text-primary"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </article>
            ))}
          </div>

          <p className="text-sm text-theme-text-tertiary text-center mt-8">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <Footer />
    </main>
  )
}
