import { Search } from "lucide-react";
import type { ReactNode } from "react";

export function ContentEmpty({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <div className="feedback-panel" role="status">
    <span className="icon-well mb-4"><Search size={21} aria-hidden="true" /></span>
    <div><h2 className="text-lg font-extrabold text-ink">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{description}</p></div>
    {children && <div className="mt-5">{children}</div>}
  </div>;
}
