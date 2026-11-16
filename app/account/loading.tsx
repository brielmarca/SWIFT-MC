import { LoadingFrame, Skeleton, SkeletonCard } from "@/components/loading/page-skeleton";

export default function AccountLoading() {
  return <LoadingFrame label="Carregando sua conta">
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 rounded-xl border border-white/10 p-6 lg:col-span-2">
        <Skeleton className="h-14 w-14 rounded-full" />
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-5 w-full max-w-md" />)}
      </div>
      <SkeletonCard />
    </div>
  </LoadingFrame>;
}
