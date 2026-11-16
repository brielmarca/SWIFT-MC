import { LoadingFrame, Skeleton, SkeletonCard } from "@/components/loading/page-skeleton";

export default function StoreLoading() {
  return <LoadingFrame label="Carregando a loja SwiftMC">
    <div className="mb-8 grid gap-3 sm:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 w-full" />)}
    </div>
    <Skeleton className="mb-6 h-12 w-full max-w-md" />
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} image />)}
    </div>
  </LoadingFrame>;
}
