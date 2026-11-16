import { LoadingFrame, Skeleton } from "@/components/loading/page-skeleton";

export default function OrdersLoading() {
  return <LoadingFrame label="Carregando seus pedidos">
    <div className="mx-auto max-w-3xl space-y-4 rounded-xl border border-white/10 p-5 sm:p-6">
      <Skeleton className="h-7 w-48" />
      {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16 w-full" />)}
    </div>
  </LoadingFrame>;
}
