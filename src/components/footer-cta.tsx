import Link from "next/link";

export function FooterCTA() {
  return (
    <div className="max-w-7xl mx-auto text-center relative z-10">
      {/* text-white must be on the h2 itself: the global h1–h6 rule in
          globals.css sets color directly, which beats inherited color. */}
      <h2 className="text-[12vw] font-bold leading-none tracking-tighter mb-8 text-white">
        START NOW
      </h2>
      <p className="text-2xl text-theme-text-tertiary mb-12 font-light">
        Join 50,000+ obsessive organizers.
      </p>
      <Link href="/signup">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white text-black font-bold text-xl hover:scale-125 transition-transform duration-300">
          GO
        </div>
      </Link>
    </div>
  );
}
