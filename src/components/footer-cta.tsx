import Link from "next/link";

export function FooterCTA() {
  return (
    <div className="max-w-7xl mx-auto text-center relative z-10">
      <h2 className="text-[12vw] font-bold leading-none tracking-tighter mb-8">
        START NOW
      </h2>
      <p className="text-2xl text-[#8e99a8] mb-12 font-light">
        Join 50,000+ obsessive organizers.
      </p>
      <Link href="/signup" className="interactive">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white text-black font-bold text-xl hover:scale-125 transition-transform duration-300">
          GO
        </div>
      </Link>
    </div>
  );
}
