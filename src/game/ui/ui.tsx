import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Emblem({ className = "h-16 w-16" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <polygon
        points="32,4 56,18 56,46 32,60 8,46 8,18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
      />
      <path d="M18 40 L32 16 L46 40" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M22 40 H42" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="32" cy="44" r="2.2" fill="currentColor" />
    </svg>
  );
}

const base =
  "pointer-events-auto inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 font-display text-sm font-semibold tracking-wide transition active:scale-95 disabled:opacity-40";

export function PrimaryButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`${base} bg-primary text-bg ${className}`} {...props} />;
}

export function GoldButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`${base} bg-accent text-bg ${className}`} {...props} />;
}

export function GhostButton({ className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`${base} border border-line bg-bg-elev/80 text-fg ${className}`} {...props} />;
}

export function Panel({ className = "", children }: { className?: string; children: ReactNode }) {
  return <section className={`panel pointer-events-auto ${className}`}>{children}</section>;
}
