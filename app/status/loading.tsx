import { LoadingFrame, Skeleton, SkeletonCard } from "@/components/loading/page-skeleton";

export default function StatusLoading() {
  return <LoadingFrame label="Carregando status da rede SwiftMC">
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} />)}
    </div>
    <Skeleton className="my-8 h-6 w-48" />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-24 w-full" />)}
    </div>
  </LoadingFrame>;
}
