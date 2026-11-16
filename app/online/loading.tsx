import { LoadingFrame, Skeleton } from "@/components/loading/page-skeleton";

export default function OnlineLoading() {
  return <LoadingFrame label="Buscando jogadores da SwiftMC">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28 w-full" />)}
    </div>
  </LoadingFrame>;
}
