import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
	],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ['"Circular Std"', 'Circular', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        // Shadcn UI colors
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        
        // Enhanced Theme Color System
        'theme-primary': {
          50: 'var(--theme-primary-50)',
          100: 'var(--theme-primary-100)',
          200: 'var(--theme-primary-200)',
          300: 'var(--theme-primary-300)',
          400: 'var(--theme-primary-400)',
          500: 'var(--theme-primary-500)',
          600: 'var(--theme-primary-600)',
          700: 'var(--theme-primary-700)',
          800: 'var(--theme-primary-800)',
          900: 'var(--theme-primary-900)',
          950: 'var(--theme-primary-950)',
          DEFAULT: 'var(--theme-primary-500)',
        },
        'theme-secondary': {
          50: 'var(--theme-secondary-50)',
          100: 'var(--theme-secondary-100)',
          200: 'var(--theme-secondary-200)',
          300: 'var(--theme-secondary-300)',
          400: 'var(--theme-secondary-400)',
          500: 'var(--theme-secondary-500)',
          600: 'var(--theme-secondary-600)',
          700: 'var(--theme-secondary-700)',
          800: 'var(--theme-secondary-800)',
          900: 'var(--theme-secondary-900)',
          950: 'var(--theme-secondary-950)',
          DEFAULT: 'var(--theme-secondary-500)',
        },
        'theme-success': {
          50: 'var(--theme-success-50)',
          100: 'var(--theme-success-100)',
          500: 'var(--theme-success-500)',
          600: 'var(--theme-success-600)',
          700: 'var(--theme-success-700)',
          DEFAULT: 'var(--theme-success-500)',
        },
        'theme-warning': {
          50: 'var(--theme-warning-50)',
          100: 'var(--theme-warning-100)',
          500: 'var(--theme-warning-500)',
          600: 'var(--theme-warning-600)',
          700: 'var(--theme-warning-700)',
          DEFAULT: 'var(--theme-warning-500)',
        },
        'theme-error': {
          50: 'var(--theme-error-50)',
          100: 'var(--theme-error-100)',
          500: 'var(--theme-error-500)',
          600: 'var(--theme-error-600)',
          700: 'var(--theme-error-700)',
          DEFAULT: 'var(--theme-error-500)',
        },
        'theme-info': {
          50: 'var(--theme-info-50)',
          100: 'var(--theme-info-100)',
          500: 'var(--theme-info-500)',
          600: 'var(--theme-info-600)',
          700: 'var(--theme-info-700)',
          DEFAULT: 'var(--theme-info-500)',
        },
        'theme-neutral': {
          0: 'var(--theme-neutral-0)',
          50: 'var(--theme-neutral-50)',
          100: 'var(--theme-neutral-100)',
          200: 'var(--theme-neutral-200)',
          300: 'var(--theme-neutral-300)',
          400: 'var(--theme-neutral-400)',
          500: 'var(--theme-neutral-500)',
          600: 'var(--theme-neutral-600)',
          700: 'var(--theme-neutral-700)',
          800: 'var(--theme-neutral-800)',
          900: 'var(--theme-neutral-900)',
          950: 'var(--theme-neutral-950)',
        },
        
        // Semantic surface colors
        'theme-surface': {
          base: 'var(--theme-surface-base)',
          raised: 'var(--theme-surface-raised)',
          overlay: 'var(--theme-surface-overlay)',
          sunken: 'var(--theme-surface-sunken)',
        },
        
        // Interactive states
        'theme-hover': 'var(--theme-hover-overlay)',
        'theme-active': 'var(--theme-active-overlay)',
        'theme-focus': 'var(--theme-focus-ring)',
        'theme-selection': 'var(--theme-selection)',
        
        // Widget-specific
        'theme-widget': {
          border: 'var(--theme-widget-border)',
          bg: 'var(--theme-widget-bg)',
          header: 'var(--theme-widget-header)',
        },
        
        // Tab colors
        'theme-tab': {
          inactive: 'var(--theme-tab-inactive)',
          active: 'var(--theme-tab-active)',
          hover: 'var(--theme-tab-hover)',
        },
        
        // Text hierarchy
        'theme-text': {
          primary: 'var(--theme-text-primary)',
          secondary: 'var(--theme-text-secondary)',
          tertiary: 'var(--theme-text-tertiary)',
          quaternary: 'var(--theme-text-quaternary)',
          inverse: 'var(--theme-text-inverse)',
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
