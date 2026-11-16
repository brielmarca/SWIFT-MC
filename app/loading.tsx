import { LoadingFrame, Skeleton, SkeletonCard } from "@/components/loading/page-skeleton";

export default function HomeLoading() {
  return <LoadingFrame label="Carregando SwiftMC">
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-5">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-4/5" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-12 w-48" />
      </div>
      <Skeleton className="aspect-square w-full max-w-[420px]" />
    </div>
    <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} image />)}
    </div>
  </LoadingFrame>;
}
