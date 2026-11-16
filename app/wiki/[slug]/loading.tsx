import { LoadingFrame, Skeleton } from "@/components/loading/page-skeleton";

export default function WikiArticleLoading() {
  return <LoadingFrame label="Carregando guia da Wiki">
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="space-y-4 rounded-xl border border-white/10 p-5">
        {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-5 w-full" />)}
      </div>
      <div className="space-y-5 rounded-xl border border-white/10 p-6">
        {Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className={`h-4 ${i % 4 === 3 ? "w-2/3" : "w-full"}`} />)}
      </div>
    </div>
  </LoadingFrame>;
}
