import { LoadingFrame, Skeleton } from "@/components/loading/page-skeleton";

export default function AdminLoading() {
  return <LoadingFrame label="Carregando área administrativa restrita">
    <div className="mb-6 flex flex-wrap gap-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-10 w-24" />)}</div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 w-full" />)}
    </div>
    <Skeleton className="mt-8 h-64 w-full" />
  </LoadingFrame>;
}
