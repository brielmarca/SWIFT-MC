import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`motion-safe:animate-pulse rounded-lg bg-white/[0.08] ${className}`} />;
}

export function LoadingFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="min-h-[70vh]">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="site-container flex h-16 items-center justify-between gap-4 border-b border-white/10">
        <Skeleton className="h-8 w-36" /><Skeleton className="h-9 w-28" />
      </div>
      <main className="site-container py-8 sm:py-12">
        <div aria-hidden="true" className="mb-8 space-y-4 border-l-2 border-violet/40 pl-5">
          <Skeleton className="h-3 w-24" /><Skeleton className="h-9 w-60 max-w-full" /><Skeleton className="h-4 w-72 max-w-full" />
        </div>
        {children}
      </main>
    </div>
  );
}

export function SkeletonCard({ image = false }: { image?: boolean }) {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.025]">
      {image && <Skeleton className="aspect-[4/3] w-full rounded-none" />}
      <div className="space-y-4 p-5">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-6 h-10 w-full" />
      </div>
    </div>
  );
}
