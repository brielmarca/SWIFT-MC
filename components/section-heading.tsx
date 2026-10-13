import type { LucideIcon } from "lucide-react";

type SectionHeadingProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
};

export function SectionHeading({ icon: Icon, eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
      <div className="status-chip !text-ultraviolet"><Icon size={15} aria-hidden="true" /> {eyebrow}</div>
      <h2 className="mt-5 text-[26px] font-extrabold uppercase leading-[34px] tracking-[-0.02em] text-ink sm:text-[32px] sm:leading-10">{title}</h2>
      <p className="mt-4 text-base leading-7 text-muted">{description}</p>
    </div>
  );
}
