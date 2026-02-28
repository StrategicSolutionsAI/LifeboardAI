import Link from "next/link";

export function FooterLinks() {
  return (
    <div className="mt-32 flex flex-col md:flex-row justify-between items-end border-t border-white/10 pt-8">
      <div className="text-left">
        <div className="text-2xl font-bold mb-2">Lifeboard.</div>
        <div className="text-theme-text-tertiary">© {new Date().getFullYear()}</div>
      </div>
      <div className="flex gap-8 text-sm text-theme-text-tertiary">
        <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
        <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
        <Link href="https://twitter.com/lifeboardai" className="hover:text-white transition-colors">Twitter</Link>
      </div>
    </div>
  );
}
