import Image from "next/image";
import Link from "next/link";

type LogoProps = { compact?: boolean };

export function Logo({ compact = false }: LogoProps) {
  return (
    <Link href="/#inicio" className="group inline-flex items-center gap-3" aria-label="SWIFT MC, início">
      <span className="relative grid h-10 w-10 place-items-center overflow-hidden">
        <Image
          src="/brand/emblem.png"
          alt=""
          fill
          sizes="40px"
          className="object-contain transition-transform duration-300 group-hover:scale-105"
          priority
        />
      </span>
      {!compact && (
        <span className="text-base font-extrabold uppercase tracking-[0.16em] text-ink">
          Swift <span className="text-ultraviolet">MC</span>
        </span>
      )}
    </Link>
  );
}
