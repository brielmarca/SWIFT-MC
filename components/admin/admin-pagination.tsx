import Link from "next/link";

export function AdminPagination({ base, page, hasNext }: { base: string; page: number; hasNext: boolean }) {
  if (page === 1 && !hasNext) return null;
  return (
    <nav aria-label="Paginação" className="mt-6 flex items-center justify-between gap-4 text-sm">
      {page > 1
        ? <Link className="button-secondary px-4" href={`${base}?page=${page - 1}`}>Página anterior</Link>
        : <span />}
      <span className="text-muted">Página {page}</span>
      {hasNext
        ? <Link className="button-secondary px-4" href={`${base}?page=${page + 1}`}>Próxima página</Link>
        : <span />}
    </nav>
  );
}

export async function adminPageNumber(searchParams: Promise<{ page?: string | string[] }>): Promise<number> {
  const raw = (await searchParams).page;
  const text = typeof raw === "string" ? raw : "";
  if (!/^[1-9]\d{0,2}$/.test(text)) return 1;
  return Math.min(Number(text), 100);
}
