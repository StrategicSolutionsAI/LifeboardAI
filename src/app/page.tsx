import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Play } from "lucide-react"

export default function Home() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Image Layer */}
      <div className="absolute inset-0 top-0 h-[1048px] w-full -z-10 pointer-events-none">
        <img src="/images/background.png" alt="hero background" className="w-full h-full object-cover" />
      </div>

      {/* Navigation Header */}
      <nav className="relative z-10 flex items-center justify-between px-16 py-6">
        <div className="flex items-center space-x-2">
          <span className="text-2xl font-bold text-theme-primary">Lifeboard</span>
          <span className="text-2xl font-bold text-gray-800">AI</span>
        </div>
        
        <div className="flex items-center space-x-8">
          <Link href="#" className="text-gray-600 hover:text-gray-800">Home</Link>
          <Link href="#" className="text-gray-600 hover:text-gray-800">Product</Link>
          <Link href="#" className="text-gray-600 hover:text-gray-800">FAQ</Link>
          <Link href="#" className="text-gray-600 hover:text-gray-800">Blog</Link>
          <Link href="#" className="text-gray-600 hover:text-gray-800">About Us</Link>
          
          <div className="flex items-center space-x-4 ml-8">
            <Link href="/login" className="text-gray-600 hover:text-gray-800">Login</Link>
            <Link href="/signup">
              <Button className="bg-theme-primary hover:bg-theme-secondary text-white px-6 py-2 rounded-lg">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="relative z-10 px-16 py-20 flex flex-col md:flex-row items-center justify-between gap-12">
        <div className="max-w-2xl">
          <h1 className="text-6xl font-bold text-gray-800 leading-tight mb-8">
            Organize Your Life,<br />
            Effortlessly With AI
          </h1>
          
          <p className="text-xl text-gray-700 mb-12 leading-relaxed">
            Life can get hectic, especially when you're managing a family. That's where Lifeboard AI comes in. Our app is designed to help you stay organized and connected, powered by advanced AI technology.
          </p>
          
          <div className="flex items-center space-x-6">
            <Link href="/signup">
              <Button className="bg-theme-primary hover:bg-theme-secondary text-white px-8 py-4 rounded-full text-lg font-medium">
                Try free trial
              </Button>
            </Link>
            
            <Button variant="ghost" className="flex items-center space-x-3 text-gray-800 hover:text-gray-600">
              <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center">
                <Play className="w-4 h-4 text-white ml-0.5" />
              </div>
              <span className="text-lg font-medium">View Demo</span>
            </Button>
          </div>
        </div>

          {/* Hero Image */}
          <img
            src="/images/hero.png"
            alt="Family using Lifeboard"
            className="w-full max-w-md md:max-w-lg lg:max-w-xl rounded-xl object-cover"
          />
        </div>

      {/* Bottom Dark Section with Overlapping Computer Image */}
      <div className="relative bg-gray-800 h-96 w-full flex items-start justify-center overflow-visible">
        {/* Computer mockup image positioned so a small sliver overlaps the gradient */}
        <img
          src="/images/computer.png"
          alt="Lifeboard desktop screenshot"
          className="absolute -top-6 md:-top-8 w-[90%] max-w-4xl select-none pointer-events-none z-50"
        />
      </div>
    </div>
  )
}
