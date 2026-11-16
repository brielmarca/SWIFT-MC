import { LoadingFrame, Skeleton, SkeletonCard } from "@/components/loading/page-skeleton";

export default function NewsLoading() {
  return <LoadingFrame label="Carregando notícias SwiftMC">
    <Skeleton className="mb-7 h-12 w-full max-w-lg" />
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} image />)}
    </div>
  </LoadingFrame>;
}
