import { LoadingFrame, Skeleton } from "@/components/loading/page-skeleton";

export default function ArticleLoading() {
  return <LoadingFrame label="Carregando notícia">
    <Skeleton className="mb-6 aspect-[3/1] w-full" />
    <div className="mx-auto max-w-4xl space-y-5 rounded-xl border border-white/10 p-6">
      {Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />)}
    </div>
  </LoadingFrame>;
}
