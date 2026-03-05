
import { FooterCTA } from "./footer-cta";
import { FooterLinks } from "./footer-links";

export function Footer() {
  return (
    <footer className="bg-black text-white py-32 px-6 relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%270 0 200 200%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.65%27 numOctaves=%273%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")' }} />
      <FooterCTA />
      <FooterLinks />
    </footer>
  );
}
