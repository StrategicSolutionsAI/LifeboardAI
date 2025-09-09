"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Play, Star, CheckCircle, Users, Calendar, Zap, ArrowRight, Shield, Clock, Heart, ChevronDown, Quote, Smartphone, Globe, Lock } from "lucide-react"
import WorldClassLandingEffects from "@/components/world-class-landing-effects"

export default function Home() {
  return (
    <WorldClassLandingEffects>
    <div className="min-h-screen relative overflow-hidden">
      {/* Sticky CTA Bar - Appears on scroll */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#8491FF] text-white p-4 shadow-2xl transform translate-y-full transition-transform duration-300" id="sticky-cta">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <div className="font-bold text-lg">Ready to organize your family life?</div>
            <div className="text-sm text-white/80">Join 10,000+ families • Free 30-day trial</div>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/signup">
              <Button className="bg-white text-[#8491FF] hover:bg-gray-100 px-6 py-3 rounded-lg font-semibold shadow-lg">
                Start Free Trial
              </Button>
            </Link>
            <button className="text-white/80 hover:text-white" onClick={() => document.getElementById('sticky-cta')!.style.transform='translateY(100%)'}>
              ×
            </button>
          </div>
        </div>
      </div>
      {/* Background Image Layer */}
      <div className="absolute inset-0 w-full h-full min-h-screen -z-10 pointer-events-none overflow-hidden">
        <img 
          src="/images/background.png" 
          alt="hero background" 
          className="w-full h-full object-cover object-center" 
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-white/20 to-white/10"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-white/20 via-transparent to-transparent"></div>
      </div>

      {/* Navigation Header */}
      <nav className="relative z-10 flex items-center justify-between px-4 md:px-16 py-4 md:py-6 backdrop-blur-sm bg-white/90 border-b border-white/20">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-[#8491FF] rounded-lg flex items-center justify-center shadow-lg">
            <span className="text-white text-sm font-bold">L</span>
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-xl md:text-2xl font-bold text-[#8491FF]">Lifeboard</span>
            <span className="text-xl md:text-2xl font-bold text-gray-800">AI</span>
          </div>
        </div>
        
        <div className="hidden lg:flex items-center space-x-8">
          <Link href="#features" className="text-gray-600 hover:text-gray-800 transition-colors font-medium">Features</Link>
          <Link href="#pricing" className="text-gray-600 hover:text-gray-800 transition-colors font-medium">Pricing</Link>
          <Link href="#testimonials" className="text-gray-600 hover:text-gray-800 transition-colors font-medium">Reviews</Link>
          <Link href="#support" className="text-gray-600 hover:text-gray-800 transition-colors font-medium">Support</Link>
          
          <div className="flex items-center space-x-4 ml-8 border-l border-gray-200 pl-8">
            <Link href="/login" className="text-gray-600 hover:text-gray-800 font-medium transition-colors">Sign In</Link>
            <Link href="/signup">
              <Button className="text-white px-6 py-2.5 rounded-lg bg-[#8491FF] hover:bg-[#8491FF]/90 transition-all duration-200 transform hover:scale-105 shadow-lg font-medium">
                Get Started
              </Button>
            </Link>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="lg:hidden flex items-center space-x-3">
          <Link href="/login" className="text-gray-600 hover:text-gray-800 font-medium text-sm">Sign In</Link>
          <Link href="/signup">
            <Button className="text-white px-4 py-2 rounded-lg bg-[#8491FF] hover:bg-[#8491FF]/90 text-sm font-medium shadow-lg">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Social Proof Bar */}
      <div className="relative z-10 px-4 md:px-16 py-3 md:py-4">
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-8 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-[#8491FF]" />
            <span className="font-medium">Join 10,000+ families</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center">
              {[1,2,3,4,5].map((star) => (
                <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <span className="font-medium">4.9/5 rating</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 px-4 md:px-16 py-12 md:py-24 lg:py-32 flex flex-col lg:flex-row items-center justify-between gap-8 md:gap-12 lg:gap-20 max-w-7xl mx-auto">
        <div className="flex-1 max-w-2xl text-center lg:text-left hero-grand-entrance">
          {/* Trust Badge */}
          <div className="inline-flex items-center space-x-2 bg-[#8491FF]/10 text-[#8491FF] px-4 py-2.5 rounded-full text-sm font-medium mb-6 md:mb-8 border border-[#8491FF]/20 backdrop-blur-sm">
            <CheckCircle className="w-4 h-4" />
            <span>Free for 30 days - No credit card required</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black text-gray-900 leading-[1.1] mb-6 md:mb-8 tracking-tight text-reveal">
            <span className="block stagger-1">Organize Your Life,</span>
            <span className="block stagger-2 text-[#8491FF] font-extrabold">Effortlessly</span>
            <span className="block stagger-3">With AI</span>
          </h1>
          
          <p className="text-lg md:text-xl lg:text-2xl text-gray-600 mb-8 md:mb-12 leading-relaxed max-w-2xl font-light text-reveal stagger-4 mx-auto lg:mx-0">
            Stop juggling family schedules, tasks, and to-dos across multiple apps. LifeboardAI brings everything together in one intelligent dashboard that learns your family's unique needs.
          </p>

          {/* Key Benefits */}
          <div className="flex flex-wrap gap-3 mb-8 md:mb-12 justify-center lg:justify-start">
            <div className="flex items-center space-x-2 text-gray-800 bg-white/60 backdrop-blur-sm px-4 py-2.5 rounded-full border border-[#8491FF]/20 hover:border-[#8491FF]/40 transition-all duration-200">
              <Calendar className="w-4 h-4 text-[#8491FF]" />
              <span className="font-medium text-sm">Unified calendar</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-800 bg-white/60 backdrop-blur-sm px-4 py-2.5 rounded-full border border-[#8491FF]/20 hover:border-[#8491FF]/40 transition-all duration-200">
              <Zap className="w-4 h-4 text-[#8491FF]" />
              <span className="font-medium text-sm">AI-powered insights</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-800 bg-white/60 backdrop-blur-sm px-4 py-2.5 rounded-full border border-[#8491FF]/20 hover:border-[#8491FF]/40 transition-all duration-200">
              <Users className="w-4 h-4 text-[#8491FF]" />
              <span className="font-medium text-sm">Family collaboration</span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-6 mb-8 md:mb-12 justify-center lg:justify-start">
            <Link href="/signup">
              <Button className="w-full sm:w-auto text-white px-8 md:px-12 py-4 md:py-6 rounded-full text-lg md:text-xl font-bold bg-gradient-to-r from-[#8491FF] to-[#8491FF]/80 hover:from-[#8491FF]/90 hover:to-[#8491FF]/70 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
                Start Free Trial
              </Button>
            </Link>
            
            <Button variant="ghost" className="w-full sm:w-auto flex items-center justify-center space-x-3 text-gray-700 hover:text-gray-900 group px-4">
              <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center group-hover:bg-gray-700 transition-colors shadow-lg">
                <Play className="w-5 h-5 text-white ml-0.5" />
              </div>
              <span className="text-lg font-semibold">See How It Works</span>
            </Button>
          </div>

          {/* Additional Social Proof */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 md:gap-6 text-gray-500 text-sm">
            <span className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="font-medium">Setup in under 5 minutes</span>
            </span>
            <span className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="font-medium">Cancel anytime</span>
            </span>
            <span className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <span className="font-medium">24/7 support</span>
            </span>
          </div>
        </div>

        {/* Hero Image */}
        <div className="relative w-full max-w-lg md:max-w-xl lg:max-w-2xl dashboard-preview-interactive">
          {/* Background glow effects */}
          <div className="absolute -inset-4 bg-[#8491FF]/10 rounded-3xl blur-3xl"></div>
          <div className="absolute -inset-8 bg-[#8491FF]/5 rounded-3xl blur-2xl transform rotate-12"></div>
          
          {/* Hero image container - AI Dashboard Mockup */}
          <div className="relative ultra-glass rounded-3xl p-3 shadow-2xl">
            <div className="bg-gray-50 rounded-2xl p-6 shadow-xl widget-demo">
              {/* Dashboard Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-[#8491FF] rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm font-bold">L</span>
                  </div>
                  <span className="text-lg font-bold text-gray-800">Family Dashboard</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <span className="text-xs">👤</span>
                  </div>
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-xs">👤</span>
                  </div>
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-xs">👤</span>
                  </div>
                </div>
              </div>

              {/* AI Insight Card */}
              <div className="bg-[#8491FF]/8 rounded-xl p-4 mb-4 border border-[#8491FF]/20 magnetic-hover">
                <div className="flex items-center space-x-2 mb-2">
                  <Zap className="w-4 h-4 text-[#8491FF]" />
                  <span className="text-sm font-semibold text-[#8491FF]">AI Insight</span>
                </div>
                <p className="text-xs text-gray-700">Sarah has soccer practice at 4pm. I've rearranged grocery shopping to 2pm to avoid traffic.</p>
              </div>

              {/* Calendar Widget */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">Today</h3>
                    <Calendar className="w-4 h-4 text-[#8491FF]" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-xs text-gray-600">Soccer Practice</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      <span className="text-xs text-gray-600">Grocery Shopping</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                      <span className="text-xs text-gray-600">Dinner Prep</span>
                    </div>
                  </div>
                </div>

                {/* Tasks Widget */}
                <div className="bg-white rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">Tasks</h3>
                    <CheckCircle className="w-4 h-4 text-[#8491FF]" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 border-2 border-green-400 rounded-sm bg-green-400"></div>
                      <span className="text-xs text-gray-600 line-through">Pack lunch</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 border-2 border-gray-300 rounded-sm"></div>
                      <span className="text-xs text-gray-600">Pick up dry cleaning</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 border-2 border-gray-300 rounded-sm"></div>
                      <span className="text-xs text-gray-600">Call dentist</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Advanced floating particles */}
          <div className="absolute -top-4 -right-4 w-8 h-8 bg-[#8491FF]/30 rounded-full floating-particle floating-particle-delay-1"></div>
          <div className="absolute -bottom-6 -left-4 w-12 h-12 bg-[#8491FF]/25 rounded-full floating-particle floating-particle-delay-2"></div>
          <div className="absolute -top-8 left-1/4 w-6 h-6 bg-[#a855f7]/20 rounded-full floating-particle floating-particle-delay-3"></div>
          <div className="absolute bottom-1/4 -right-8 w-10 h-10 bg-[#8491FF]/15 rounded-full floating-particle floating-particle-delay-4"></div>
          <div className="absolute top-1/3 -left-6 w-4 h-4 bg-[#a855f7]/30 rounded-full floating-particle floating-particle-delay-5"></div>
        </div>
      </div>

      {/* Feature Preview Cards */}
      <div className="relative z-10 px-4 md:px-16 py-24 md:py-32 bg-white/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
              Everything your family needs, in one place
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto font-light">
              Streamline your family's daily life with intelligent features designed for modern families
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            <div className="feature-card-interactive rounded-3xl p-10 shadow-xl border border-white/30 group relative hardware-accelerate">
              <div className="relative">
                <div className="w-20 h-20 bg-[#8491FF]/15 rounded-3xl flex items-center justify-center mb-8 magnetic-hover">
                  <Calendar className="w-10 h-10 text-[#8491FF]" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-[#8491FF] transition-colors duration-300">Smart Scheduling</h3>
                <p className="text-gray-600 leading-relaxed text-lg">AI automatically organizes family events and finds the best times for everyone.</p>
              </div>
            </div>
            
            <div className="feature-card-interactive rounded-3xl p-10 shadow-xl border border-white/30 group relative hardware-accelerate md:mt-12 lg:mt-16">
              <div className="relative">
                <div className="w-20 h-20 bg-[#8491FF]/15 rounded-3xl flex items-center justify-center mb-8 magnetic-hover">
                  <CheckCircle className="w-10 h-10 text-[#8491FF]" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-[#8491FF] transition-colors duration-300">Task Management</h3>
                <p className="text-gray-600 leading-relaxed text-lg">Keep track of chores, homework, and family responsibilities with smart reminders.</p>
              </div>
            </div>
            
            <div className="feature-card-interactive rounded-3xl p-10 shadow-xl border border-white/30 group relative hardware-accelerate">
              <div className="relative">
                <div className="w-20 h-20 bg-[#8491FF]/15 rounded-3xl flex items-center justify-center mb-8 magnetic-hover">
                  <Zap className="w-10 h-10 text-[#8491FF]" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4 group-hover:text-[#8491FF] transition-colors duration-300">AI Insights</h3>
                <p className="text-gray-600 leading-relaxed text-lg">Get personalized suggestions to optimize your family's routine and productivity.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Showcase */}
      <div className="relative z-10 py-16 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-4 md:px-16">
          <div className="text-center mb-12">
            <h3 className="text-lg font-semibold text-gray-600 mb-8">Integrates seamlessly with your existing tools</h3>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-8 items-center justify-items-center opacity-60">
              {/* Google */}
              <div className="integration-logo flex items-center space-x-2 text-2xl font-bold text-gray-400 cursor-pointer">
                <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white text-sm">G</div>
                <span className="hidden sm:inline">Google</span>
              </div>
              {/* Apple */}
              <div className="integration-logo flex items-center space-x-2 text-2xl font-bold text-gray-400 cursor-pointer">
                <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white text-sm">🍎</div>
                <span className="hidden sm:inline">Apple</span>
              </div>
              {/* Outlook */}
              <div className="integration-logo flex items-center space-x-2 text-2xl font-bold text-gray-400 cursor-pointer">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm">O</div>
                <span className="hidden sm:inline">Outlook</span>
              </div>
              {/* Todoist */}
              <div className="integration-logo flex items-center space-x-2 text-2xl font-bold text-gray-400 cursor-pointer">
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center text-white text-sm">T</div>
                <span className="hidden sm:inline">Todoist</span>
              </div>
              {/* Slack */}
              <div className="integration-logo flex items-center space-x-2 text-2xl font-bold text-gray-400 cursor-pointer">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm">#</div>
                <span className="hidden sm:inline">Slack</span>
              </div>
              {/* Notion */}
              <div className="integration-logo flex items-center space-x-2 text-2xl font-bold text-gray-400 cursor-pointer">
                <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center text-white text-sm">N</div>
                <span className="hidden sm:inline">Notion</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Social Proof & Testimonials Section - Redesigned Layout */}
      <div className="relative z-10 py-24 md:py-32 bg-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-32 h-32 bg-[#8491FF] rounded-full blur-3xl"></div>
          <div className="absolute bottom-32 right-16 w-24 h-24 bg-[#8491FF] rounded-full blur-2xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 md:px-16 relative">
          {/* Centered testimonial with large quote */}
          <div className="text-center mb-20">
            <div className="inline-flex items-center space-x-2 bg-emerald-100 text-emerald-800 px-4 py-2 rounded-full text-sm font-medium mb-8">
              <Heart className="w-4 h-4" />
              <span>Loved by 10,000+ families</span>
            </div>

            {/* Featured large testimonial */}
            <div className="max-w-4xl mx-auto mb-16">
              <Quote className="w-16 h-16 text-[#8491FF]/20 mx-auto mb-8" />
              <blockquote className="text-3xl md:text-4xl font-light text-gray-800 leading-relaxed mb-8">
                "LifeboardAI saved our family chaos! The AI suggestions actually work - it moved my son's soccer practice to avoid traffic and I gained <span className="text-[#8491FF] font-semibold">30 minutes back each week</span>."
              </blockquote>
              
              <div className="flex items-center justify-center space-x-4 mb-6">
                <div className="w-16 h-16 bg-pink-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-bold text-xl">SM</span>
                </div>
                <div className="text-left">
                  <div className="text-xl font-bold text-gray-900">Sarah Mitchell</div>
                  <div className="text-gray-600">Mom of 3 • Seattle</div>
                </div>
              </div>
              
              <div className="flex justify-center mb-8">
                {[1,2,3,4,5].map((star) => (
                  <Star key={star} className="w-6 h-6 fill-yellow-400 text-yellow-400 mx-1" />
                ))}
              </div>
            </div>
          </div>

          {/* Horizontal scrolling testimonials */}
          <div className="mb-20">
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-12">What families are saying</h3>
            <div className="flex space-x-6 overflow-x-auto pb-6 scrollbar-hide">
              <div className="flex-shrink-0 w-80 testimonial-premium rounded-2xl p-6 shadow-lg border border-gray-200/50 testimonial-card">
                <div className="flex mb-4">
                  {[1,2,3,4,5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">
                  "Finally, ONE app that handles everything! My husband and I are finally synced on family schedules."
                </p>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">JC</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Jessica Chen</div>
                    <div className="text-gray-600 text-sm">Working Mom • SF</div>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 w-80 testimonial-premium rounded-2xl p-6 shadow-lg border border-gray-200/50 testimonial-card">
                <div className="flex mb-4">
                  {[1,2,3,4,5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">
                  "My kids love seeing their tasks and activities in one place. It's become our family command center!"
                </p>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">MR</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Mike Rodriguez</div>
                    <div className="text-gray-600 text-sm">Dad of 2 • Austin</div>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 w-80 testimonial-premium rounded-2xl p-6 shadow-lg border border-gray-200/50 testimonial-card">
                <div className="flex mb-4">
                  {[1,2,3,4,5].map((star) => (
                    <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 mb-4">
                  "The AI insights are genuinely helpful, not gimmicky. Setup was actually under 5 minutes!"
                </p>
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">LC</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">Lisa Chen</div>
                    <div className="text-gray-600 text-sm">Parent • NYC</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust Indicators - Redesigned as badges */}
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-12">
            <div className="flex items-center space-x-3 bg-white/90 backdrop-blur-sm px-6 py-4 rounded-full shadow-lg border border-gray-200/50">
              <Shield className="w-6 h-6 text-[#8491FF]" />
              <div>
                <div className="font-bold text-gray-900">Enterprise Security</div>
                <div className="text-gray-600 text-sm">Bank-level encryption</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 bg-white/90 backdrop-blur-sm px-6 py-4 rounded-full shadow-lg border border-gray-200/50">
              <Clock className="w-6 h-6 text-[#8491FF]" />
              <div>
                <div className="font-bold text-gray-900">5-Min Setup</div>
                <div className="text-gray-600 text-sm">Get started instantly</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 bg-white/90 backdrop-blur-sm px-6 py-4 rounded-full shadow-lg border border-gray-200/50">
              <Users className="w-6 h-6 text-[#8491FF]" />
              <div>
                <div className="font-bold text-gray-900">10,000+ Families</div>
                <div className="text-gray-600 text-sm">Join our community</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section - Redesigned with Split Layout */}
      <div className="relative z-10 section-transition bg-gray-900 text-white overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-[#8491FF]/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-[#8491FF]/10 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 py-24 md:py-32">
          <div className="max-w-7xl mx-auto px-4 md:px-16">
            {/* Left side - Pricing info */}
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center space-x-2 bg-[#8491FF]/20 text-[#8491FF] px-4 py-2 rounded-full text-sm font-medium mb-8">
                  <Heart className="w-4 h-4" />
                  <span>Simple, transparent pricing</span>
                </div>
                
                <h2 className="text-4xl md:text-6xl font-bold mb-8 leading-tight">
                  Start free,<br />
                  <span className="text-[#8491FF]">scale up</span><br />
                  when ready
                </h2>
                
                <p className="text-xl text-gray-300 mb-12 leading-relaxed">
                  No hidden fees, no surprises. Start with our free forever plan, then upgrade when your family needs more advanced AI features.
                </p>

                {/* Value Props */}
                <div className="space-y-4 mb-8">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                    <span className="text-lg">30-day free trial for Pro features</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                    <span className="text-lg">Cancel anytime, no questions asked</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-6 h-6 text-emerald-400" />
                    <span className="text-lg">Free forever plan available</span>
                  </div>
                </div>

                <div className="flex items-center space-x-8 text-gray-400 text-sm">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-5 h-5" />
                    <span>SOC 2 Compliant</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Lock className="w-5 h-5" />
                    <span>Bank-grade Security</span>
                  </div>
                </div>
              </div>

              {/* Right side - Pricing Cards */}
              <div className="space-y-6">
                {/* Free Plan */}
                <div className="pricing-card bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 hover:border-[#8491FF]/50 transition-all duration-300">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-2xl font-bold">Free Forever</h3>
                      <p className="text-gray-400">Perfect for getting started</p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold">$0</div>
                      <div className="text-gray-400">forever</div>
                    </div>
                  </div>
                  
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span>Up to 4 family members</span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span>Basic calendar sync</span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <span>Simple task management</span>
                    </li>
                  </ul>

                  <Link href="/signup">
                    <Button className="w-full py-4 text-lg font-semibold bg-white/20 hover:bg-white/30 text-white rounded-xl border border-white/30">
                      Start Free
                    </Button>
                  </Link>
                </div>

                {/* Pro Plan */}
                <div className="pricing-card premium-gradient rounded-2xl p-8 shadow-2xl relative">
                  <div className="absolute -top-3 -right-3 bg-yellow-400 text-yellow-900 px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                    MOST POPULAR
                  </div>
                  
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-2xl font-bold premium-text-glow">LifeboardAI Pro</h3>
                      <p className="text-white/80">Full AI-powered experience</p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold">$12</div>
                      <div className="text-white/70">/month</div>
                    </div>
                  </div>
                  
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-white" />
                      <span>Everything in Free, plus:</span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-white" />
                      <span>Unlimited family members</span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-white" />
                      <span>AI scheduling optimization</span>
                    </li>
                    <li className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-white" />
                      <span>Smart insights & suggestions</span>
                    </li>
                  </ul>

                  <Link href="/signup">
                    <Button className="w-full py-4 text-lg font-semibold bg-white text-[#8491FF] hover:bg-gray-100 rounded-xl shadow-lg">
                      Start 30-Day Free Trial
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile App Preview Section */}
      <div className="relative z-10 py-24 md:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-16">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Content */}
            <div>
              <div className="inline-flex items-center space-x-2 bg-[#8491FF]/10 text-[#8491FF] px-4 py-2 rounded-full text-sm font-medium mb-8">
                <Smartphone className="w-4 h-4" />
                <span>Available on all devices</span>
              </div>
              
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Your family hub,<br />
                <span className="text-[#8491FF]">anywhere</span> you go
              </h2>
              
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Native apps for iPhone, Android, iPad, Mac, and Windows. 
                Your family stays synchronized whether you're at home, work, or on the go.
              </p>

              <div className="space-y-4 mb-10">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                  <span className="text-lg text-gray-700">Real-time sync across all devices</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                  <span className="text-lg text-gray-700">Offline access when you need it</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-emerald-500" />
                  <span className="text-lg text-gray-700">Push notifications for important updates</span>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="bg-black rounded-2xl px-6 py-3 flex items-center space-x-3 cursor-pointer hover:scale-105 transition-transform">
                  <div className="text-white text-2xl">📱</div>
                  <div className="text-white">
                    <div className="text-xs">Download on the</div>
                    <div className="font-bold">App Store</div>
                  </div>
                </div>
                <div className="bg-black rounded-2xl px-6 py-3 flex items-center space-x-3 cursor-pointer hover:scale-105 transition-transform">
                  <div className="text-white text-2xl">🤖</div>
                  <div className="text-white">
                    <div className="text-xs">Get it on</div>
                    <div className="font-bold">Google Play</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Mobile Mockups */}
            <div className="relative">
              <div className="flex items-center justify-center space-x-6">
                {/* iPhone Mockup */}
                <div className="relative mobile-mockup hardware-accelerate">
                  <div className="w-64 h-[520px] bg-gray-900 rounded-[3rem] p-2 shadow-2xl">
                    <div className="w-full h-full bg-white rounded-[2.5rem] overflow-hidden relative">
                      {/* Status Bar */}
                      <div className="bg-gray-900 h-8 flex items-center justify-center rounded-t-[2.5rem]">
                        <div className="w-20 h-1 bg-gray-700 rounded-full"></div>
                      </div>
                      
                      {/* App Content */}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-[#8491FF] rounded-lg flex items-center justify-center">
                              <span className="text-white text-xs font-bold">L</span>
                            </div>
                            <span className="font-bold text-gray-900">LifeboardAI</span>
                          </div>
                          <div className="w-8 h-8 bg-gray-100 rounded-full"></div>
                        </div>

                        {/* Today's Schedule */}
                        <div className="bg-[#8491FF]/10 rounded-xl p-4 mb-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <Zap className="w-4 h-4 text-[#8491FF]" />
                            <span className="text-sm font-semibold text-[#8491FF]">AI Suggestion</span>
                          </div>
                          <p className="text-xs text-gray-700">Move piano lesson to 3pm to avoid traffic</p>
                        </div>

                        {/* Tasks */}
                        <div className="space-y-3">
                          <div className="flex items-center space-x-3">
                            <div className="w-4 h-4 bg-green-400 rounded-sm"></div>
                            <span className="text-sm text-gray-700 line-through">Pack lunches</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="w-4 h-4 border-2 border-gray-300 rounded-sm"></div>
                            <span className="text-sm text-gray-700">Pick up groceries</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <div className="w-4 h-4 border-2 border-gray-300 rounded-sm"></div>
                            <span className="text-sm text-gray-700">Soccer practice 4pm</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* iPad Mockup (partially visible) */}
                <div className="relative -ml-8 opacity-75 transform rotate-12 parallax-float">
                  <div className="w-48 h-64 bg-gray-900 rounded-2xl p-2 shadow-xl">
                    <div className="w-full h-full bg-gray-100 rounded-xl flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <Calendar className="w-8 h-8 mx-auto mb-2" />
                        <div className="text-xs">iPad App</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Dark Section with Desktop Interface */}
      <div className="relative bg-gray-800 h-96 w-full flex items-start justify-center overflow-visible">
        {/* Desktop interface mockup */}
        <div className="absolute -top-8 md:-top-12 w-[90%] max-w-5xl">
          <div className="absolute inset-0 bg-[#8491FF]/15 rounded-xl blur-2xl"></div>
          
          {/* Desktop Browser Frame */}
          <div className="relative bg-white rounded-xl shadow-2xl overflow-hidden border border-gray-200">
            {/* Browser Header */}
            <div className="bg-gray-100 px-4 py-3 flex items-center space-x-2 border-b border-gray-200">
              <div className="flex space-x-2">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-white rounded-md px-3 py-1 text-sm text-gray-600 border">
                  🔒 lifeboard.ai/dashboard
                </div>
              </div>
            </div>

            {/* Dashboard Interface */}
            <div className="bg-gray-50 p-6">
              {/* Top Navigation */}
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-[#8491FF] rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold">L</span>
                    </div>
                    <span className="text-2xl font-bold text-gray-800">LifeboardAI</span>
                  </div>
                  <nav className="hidden md:flex space-x-8">
                    <span className="text-[#8491FF] font-semibold border-b-2 border-[#8491FF] pb-1">Dashboard</span>
                    <span className="text-gray-600">Calendar</span>
                    <span className="text-gray-600">Tasks</span>
                    <span className="text-gray-600">Insights</span>
                  </nav>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="w-2 h-2 bg-green-400 rounded-full absolute -top-1 -right-1 border-2 border-white"></div>
                    <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                  </div>
                </div>
              </div>

              {/* Main Content Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* AI Insights Panel */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Featured AI Insight */}
                  <div className="bg-[#8491FF]/8 rounded-xl p-6 border border-[#8491FF]/20">
                    <div className="flex items-center space-x-3 mb-4">
                      <Zap className="w-6 h-6 text-[#8491FF]" />
                      <h3 className="text-lg font-bold text-[#8491FF]">Smart Schedule Optimization</h3>
                    </div>
                    <p className="text-gray-700 mb-4">I've analyzed your family's patterns and suggest moving Tommy's piano lesson to 3pm to avoid rush hour traffic.</p>
                    <div className="flex space-x-3">
                      <button className="bg-[#8491FF] text-white px-4 py-2 rounded-lg text-sm font-medium">Apply Change</button>
                      <button className="text-gray-600 px-4 py-2 text-sm">Not now</button>
                    </div>
                  </div>

                  {/* Calendar Overview */}
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">This Week</h3>
                      <Calendar className="w-5 h-5 text-[#8491FF]" />
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
                        <div key={day} className="text-center">
                          <div className="text-xs text-gray-500 mb-1">{day}</div>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${i === 3 ? 'bg-[#8491FF] text-white' : 'bg-gray-100 text-gray-700'}`}>
                            {15 + i}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Sidebar */}
                <div className="space-y-6">
                  {/* Family Members */}
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Family</h3>
                    <div className="space-y-3">
                      {[
                        { name: 'Sarah', color: 'bg-green-100 text-green-800', status: 'Soccer Practice' },
                        { name: 'Tommy', color: 'bg-blue-100 text-blue-800', status: 'Piano Lesson' },
                        { name: 'Mom', color: 'bg-purple-100 text-purple-800', status: 'Grocery Run' },
                        { name: 'Dad', color: 'bg-orange-100 text-orange-800', status: 'Working' }
                      ].map((member) => (
                        <div key={member.name} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${member.color}`}>
                              <span className="text-xs font-medium">{member.name[0]}</span>
                            </div>
                            <span className="font-medium text-gray-800">{member.name}</span>
                          </div>
                          <span className="text-xs text-gray-500">{member.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Quick Tasks */}
                  <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">Today's Tasks</h3>
                      <CheckCircle className="w-5 h-5 text-[#8491FF]" />
                    </div>
                    <div className="space-y-3">
                      {[
                        { task: 'Pack school lunches', done: true },
                        { task: 'Pick up dry cleaning', done: false },
                        { task: 'Buy groceries', done: false },
                        { task: 'Call dentist', done: false }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center space-x-3">
                          <div className={`w-4 h-4 border-2 rounded-sm flex items-center justify-center ${item.done ? 'bg-green-400 border-green-400' : 'border-gray-300'}`}>
                            {item.done && <div className="w-2 h-2 bg-white rounded-sm"></div>}
                          </div>
                          <span className={`text-sm ${item.done ? 'text-gray-500 line-through' : 'text-gray-700'}`}>
                            {item.task}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="relative z-10 py-24 md:py-32 bg-white">
        <div className="max-w-4xl mx-auto px-4 md:px-16">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 tracking-tight">
              Frequently asked questions
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto font-light">
              Everything you need to know about LifeboardAI. Can't find the answer you're looking for? 
              <Link href="#" className="text-[#8491FF] font-medium hover:underline ml-1">Chat with our team</Link>.
            </p>
          </div>

          <div className="space-y-8">
            <div className="faq-item bg-gray-50 rounded-2xl p-8 border border-gray-100">
              <div className="flex items-start justify-between cursor-pointer group">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-[#8491FF] transition-colors">
                    How does the AI actually help organize my family?
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Our AI analyzes your family's patterns, schedules, and preferences to suggest optimal timing for activities. 
                    It learns from your habits - like avoiding rush hour for soccer practice or grouping errands efficiently. 
                    The AI also identifies scheduling conflicts before they happen and suggests solutions that work for everyone.
                  </p>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400 mt-1 ml-4" />
              </div>
            </div>

            <div className="faq-item bg-gray-50 rounded-2xl p-8 border border-gray-100">
              <div className="flex items-start justify-between cursor-pointer group">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-[#8491FF] transition-colors">
                    Is my family's data secure and private?
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Absolutely. We use bank-level encryption (AES-256) and never sell your data. Your family information 
                    stays private and is only used to provide personalized suggestions. We're SOC 2 compliant and undergo 
                    regular security audits. You own your data and can export or delete it anytime.
                  </p>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400 mt-1 ml-4" />
              </div>
            </div>

            <div className="faq-item bg-gray-50 rounded-2xl p-8 border border-gray-100">
              <div className="flex items-start justify-between cursor-pointer group">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-[#8491FF] transition-colors">
                    What calendars and apps does LifeboardAI integrate with?
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    We integrate with Google Calendar, Apple Calendar, Outlook, and most major calendar apps. 
                    Task integration includes Todoist, Any.do, and Apple Reminders. We're constantly adding 
                    new integrations based on user requests. The setup process automatically detects and 
                    connects your existing apps in under 5 minutes.
                  </p>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400 mt-1 ml-4" />
              </div>
            </div>

            <div className="faq-item bg-gray-50 rounded-2xl p-8 border border-gray-100">
              <div className="flex items-start justify-between cursor-pointer group">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-[#8491FF] transition-colors">
                    Can I try LifeboardAI before paying anything?
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Yes! We offer a completely free forever plan for up to 4 family members with basic features. 
                    For our Pro features (AI insights, unlimited members, advanced integrations), you get a 
                    30-day free trial with no credit card required. If you're not happy, cancel anytime.
                  </p>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400 mt-1 ml-4" />
              </div>
            </div>

            <div className="faq-item bg-gray-50 rounded-2xl p-8 border border-gray-100">
              <div className="flex items-start justify-between cursor-pointer group">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-[#8491FF] transition-colors">
                    How do I get my family members to actually use it?
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    Great question! We've designed LifeboardAI to be so useful that family members naturally want to use it. 
                    Kids love seeing their activities visually, and parents appreciate having everything in one place. 
                    Start by setting it up yourself, then gradually invite family members as they see the benefits. 
                    Most families are fully onboard within the first week.
                  </p>
                </div>
                <ChevronDown className="w-5 h-5 text-gray-400 mt-1 ml-4" />
              </div>
            </div>
          </div>

          {/* CTA in FAQ */}
          <div className="text-center mt-16 p-8 bg-[#8491FF]/8 rounded-3xl border border-[#8491FF]/20">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">Ready to organize your family life?</h3>
            <p className="text-gray-600 mb-6">Join thousands of families already loving LifeboardAI</p>
            <Link href="/signup">
              <Button className="px-8 py-4 text-lg font-semibold bg-[#8491FF] hover:bg-[#8491FF]/90 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105">
                Start Your Free Trial
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 md:px-16 py-16">
          <div className="grid md:grid-cols-4 gap-12">
            {/* Brand Column */}
            <div className="md:col-span-1">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-[#8491FF] rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">L</span>
                </div>
                <span className="text-2xl font-bold">LifeboardAI</span>
              </div>
              <p className="text-gray-400 mb-6 leading-relaxed">
                The AI-powered family organization platform that brings peace of mind to busy parents and families.
              </p>
              <div className="flex space-x-4">
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 cursor-pointer transition-colors">
                  <span className="text-sm">𝕏</span>
                </div>
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 cursor-pointer transition-colors">
                  <span className="text-sm">in</span>
                </div>
                <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center hover:bg-gray-700 cursor-pointer transition-colors">
                  <span className="text-sm">fb</span>
                </div>
              </div>
            </div>

            {/* Product Column */}
            <div>
              <h3 className="font-bold text-lg mb-6">Product</h3>
              <ul className="space-y-4">
                <li><Link href="#features" className="text-gray-400 hover:text-white transition-colors">Features</Link></li>
                <li><Link href="#pricing" className="text-gray-400 hover:text-white transition-colors">Pricing</Link></li>
                <li><Link href="/integrations" className="text-gray-400 hover:text-white transition-colors">Integrations</Link></li>
                <li><Link href="/changelog" className="text-gray-400 hover:text-white transition-colors">What's New</Link></li>
                <li><Link href="/roadmap" className="text-gray-400 hover:text-white transition-colors">Roadmap</Link></li>
              </ul>
            </div>

            {/* Support Column */}
            <div>
              <h3 className="font-bold text-lg mb-6">Support</h3>
              <ul className="space-y-4">
                <li><Link href="/help" className="text-gray-400 hover:text-white transition-colors">Help Center</Link></li>
                <li><Link href="/contact" className="text-gray-400 hover:text-white transition-colors">Contact Us</Link></li>
                <li><Link href="/community" className="text-gray-400 hover:text-white transition-colors">Community</Link></li>
                <li><Link href="/status" className="text-gray-400 hover:text-white transition-colors">Status</Link></li>
                <li><Link href="/security" className="text-gray-400 hover:text-white transition-colors">Security</Link></li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h3 className="font-bold text-lg mb-6">Company</h3>
              <ul className="space-y-4">
                <li><Link href="/about" className="text-gray-400 hover:text-white transition-colors">About</Link></li>
                <li><Link href="/blog" className="text-gray-400 hover:text-white transition-colors">Blog</Link></li>
                <li><Link href="/careers" className="text-gray-400 hover:text-white transition-colors">Careers</Link></li>
                <li><Link href="/press" className="text-gray-400 hover:text-white transition-colors">Press Kit</Link></li>
                <li><Link href="/partners" className="text-gray-400 hover:text-white transition-colors">Partners</Link></li>
              </ul>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="border-t border-gray-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0">
              © 2024 LifeboardAI. All rights reserved.
            </div>
            <div className="flex items-center space-x-8 text-sm">
              <Link href="/privacy" className="text-gray-400 hover:text-white transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="text-gray-400 hover:text-white transition-colors">Terms of Service</Link>
              <Link href="/cookies" className="text-gray-400 hover:text-white transition-colors">Cookie Policy</Link>
              <div className="flex items-center space-x-2 text-gray-400">
                <Lock className="w-4 h-4" />
                <span>SOC 2 Compliant</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
    </WorldClassLandingEffects>
  )
}
