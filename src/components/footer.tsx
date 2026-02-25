
import { FooterCTA } from "./footer-cta";
import { FooterLinks } from "./footer-links";

export function Footer() {
  return (
    <footer className="bg-black text-white py-32 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-[url('/images/noise.png')] opacity-10 mix-blend-overlay" />
      <FooterCTA />
      <FooterLinks />
    </footer>
  );
}
