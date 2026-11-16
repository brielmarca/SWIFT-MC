import { LoadingFrame, Skeleton, SkeletonCard } from "@/components/loading/page-skeleton";

export default function RankLoading() {
  return <LoadingFrame label="Carregando benefícios VIP">
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <Skeleton className="aspect-[4/3] w-full" />
      <div className="space-y-4">
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-6 w-40" />
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}
        <Skeleton className="h-12 w-full max-w-sm" />
      </div>
    </div>
    <div className="mt-8 grid gap-5 sm:grid-cols-2">
      <SkeletonCard /><SkeletonCard />
    </div>
  </LoadingFrame>;
}
