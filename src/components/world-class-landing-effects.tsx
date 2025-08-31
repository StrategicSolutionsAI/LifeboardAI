"use client";

import { useEffect, useRef, useState } from 'react';

interface WorldClassLandingEffectsProps {
  children: React.ReactNode;
}

export default function WorldClassLandingEffects({ children }: WorldClassLandingEffectsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);

  // Advanced mouse tracking for premium interactions
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
      
      // Add magnetic effect to interactive elements
      const interactiveElements = document.querySelectorAll('.magnetic-hover');
      interactiveElements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = (e.clientX - centerX) * 0.1;
        const deltaY = (e.clientY - centerY) * 0.1;
        
        if (Math.abs(deltaX) < 50 && Math.abs(deltaY) < 50) {
          (element as HTMLElement).style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        } else {
          (element as HTMLElement).style.transform = 'translate(0px, 0px)';
        }
      });

      // Update CSS custom properties for mouse-based effects
      document.documentElement.style.setProperty('--mouse-x', `${(e.clientX / window.innerWidth) * 100}%`);
      document.documentElement.style.setProperty('--mouse-y', `${(e.clientY / window.innerHeight) * 100}%`);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Advanced scroll effects and parallax
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY;
      setScrollY(scrolled);

      // Parallax effects
      const parallaxElements = document.querySelectorAll('.parallax-slow');
      parallaxElements.forEach((element) => {
        const speed = 0.5;
        (element as HTMLElement).style.transform = `translateY(${scrolled * speed}px)`;
      });

      const parallaxMedium = document.querySelectorAll('.parallax-medium');
      parallaxMedium.forEach((element) => {
        const speed = 0.3;
        (element as HTMLElement).style.transform = `translateY(${scrolled * speed}px)`;
      });

      const parallaxFast = document.querySelectorAll('.parallax-fast');
      parallaxFast.forEach((element) => {
        const speed = 0.1;
        (element as HTMLElement).style.transform = `translateY(${scrolled * speed}px)`;
      });

      // Reveal animations on scroll
      const scrollRevealElements = document.querySelectorAll('.scroll-reveal');
      scrollRevealElements.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight * 0.8;
        
        if (isVisible) {
          element.classList.add('revealed');
        }
      });

      // Sticky CTA bar
      const stickyCtaBar = document.getElementById('sticky-cta');
      if (stickyCtaBar) {
        if (scrolled > window.innerHeight * 0.8) {
          stickyCtaBar.classList.add('sticky-cta-show');
        } else {
          stickyCtaBar.classList.remove('sticky-cta-show');
        }
      }

      // Floating particles respond to scroll
      const particles = document.querySelectorAll('.floating-particle');
      particles.forEach((particle, index) => {
        const speed = (index + 1) * 0.02;
        const rotation = scrolled * speed;
        (particle as HTMLElement).style.transform = `rotate(${rotation}deg)`;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Enhanced intersection observer for advanced animations
  useEffect(() => {
    const observerOptions = {
      threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      rootMargin: '0px 0px -10% 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const element = entry.target as HTMLElement;
        const intersectionRatio = entry.intersectionRatio;

        // Smooth opacity transitions
        if (element.classList.contains('fade-in-on-scroll')) {
          element.style.opacity = Math.max(0.1, intersectionRatio).toString();
        }

        // Scale animations
        if (element.classList.contains('scale-in-on-scroll')) {
          const scale = 0.8 + (intersectionRatio * 0.2);
          element.style.transform = `scale(${scale})`;
        }

        // Staggered animations
        if (element.classList.contains('stagger-animation') && intersectionRatio > 0.3) {
          const children = element.querySelectorAll('.stagger-child');
          children.forEach((child, index) => {
            setTimeout(() => {
              child.classList.add('animate-in');
            }, index * 100);
          });
        }
      });
    }, observerOptions);

    // Observe elements
    const elementsToObserve = document.querySelectorAll(
      '.fade-in-on-scroll, .scale-in-on-scroll, .stagger-animation'
    );
    
    elementsToObserve.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);

  // Premium button interactions
  useEffect(() => {
    const buttons = document.querySelectorAll('.btn-world-class, .cta-ultra-premium');
    
    const handleButtonMouseEnter = (e: Event) => {
      const button = e.target as HTMLElement;
      button.style.setProperty('--hover-scale', '1.05');
    };

    const handleButtonMouseLeave = (e: Event) => {
      const button = e.target as HTMLElement;
      button.style.setProperty('--hover-scale', '1');
    };

    buttons.forEach((button) => {
      button.addEventListener('mouseenter', handleButtonMouseEnter);
      button.addEventListener('mouseleave', handleButtonMouseLeave);
    });

    return () => {
      buttons.forEach((button) => {
        button.removeEventListener('mouseenter', handleButtonMouseEnter);
        button.removeEventListener('mouseleave', handleButtonMouseLeave);
      });
    };
  }, []);

  // Dynamic gradient animations
  useEffect(() => {
    const gradientElements = document.querySelectorAll('.morphing-gradient');
    
    const animateGradients = () => {
      gradientElements.forEach((element, index) => {
        const time = Date.now() * 0.001;
        const hue1 = (time * 20 + index * 60) % 360;
        const hue2 = (time * 30 + index * 60 + 60) % 360;
        const hue3 = (time * 40 + index * 60 + 120) % 360;
        
        (element as HTMLElement).style.background = `linear-gradient(45deg, 
          hsl(${hue1}, 70%, 65%), 
          hsl(${hue2}, 70%, 65%), 
          hsl(${hue3}, 70%, 65%)
        )`;
      });
    };

    const intervalId = setInterval(animateGradients, 100);
    return () => clearInterval(intervalId);
  }, []);

  // Performance optimization: Request Animation Frame for smooth animations
  useEffect(() => {
    let ticking = false;

    const updateAnimations = () => {
      // Update any smooth animations here
      ticking = false;
    };

    const requestTick = () => {
      if (!ticking) {
        requestAnimationFrame(updateAnimations);
        ticking = true;
      }
    };

    window.addEventListener('scroll', requestTick, { passive: true });
    return () => window.removeEventListener('scroll', requestTick);
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative overflow-hidden"
      style={{
        '--mouse-x': `${(mousePosition.x / (typeof window !== 'undefined' ? window.innerWidth : 1)) * 100}%`,
        '--mouse-y': `${(mousePosition.y / (typeof window !== 'undefined' ? window.innerHeight : 1)) * 100}%`
      } as React.CSSProperties}
    >
      {/* Advanced background elements */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Animated gradient orbs */}
        <div 
          className="absolute w-96 h-96 rounded-full opacity-20 parallax-slow"
          style={{
            background: 'radial-gradient(circle, rgba(132, 145, 255, 0.3), transparent)',
            top: '10%',
            left: '10%',
            transform: `translateY(${scrollY * 0.1}px) translateX(${Math.sin(scrollY * 0.01) * 20}px)`
          }}
        />
        <div 
          className="absolute w-64 h-64 rounded-full opacity-15 parallax-medium"
          style={{
            background: 'radial-gradient(circle, rgba(168, 85, 247, 0.3), transparent)',
            top: '60%',
            right: '20%',
            transform: `translateY(${scrollY * 0.15}px) translateX(${Math.cos(scrollY * 0.008) * 30}px)`
          }}
        />
        <div 
          className="absolute w-48 h-48 rounded-full opacity-10 parallax-fast"
          style={{
            background: 'radial-gradient(circle, rgba(236, 72, 153, 0.3), transparent)',
            bottom: '20%',
            left: '60%',
            transform: `translateY(${scrollY * 0.08}px) translateX(${Math.sin(scrollY * 0.012) * 25}px)`
          }}
        />
      </div>

      {children}
    </div>
  );
}