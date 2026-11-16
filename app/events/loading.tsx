import { LoadingFrame, SkeletonCard } from "@/components/loading/page-skeleton";

export default function EventsLoading() {
  return <LoadingFrame label="Carregando eventos da SwiftMC">
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, i) => <SkeletonCard key={i} />)}
    </div>
  </LoadingFrame>;
}
