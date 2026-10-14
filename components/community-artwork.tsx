import Image from "next/image";

export function CommunityArtwork() {
  return <div className="pointer-events-none relative mx-auto mt-6 h-64 w-44 sm:h-72 sm:w-52 lg:absolute lg:inset-y-6 lg:right-8 lg:mt-0 lg:h-auto lg:w-60">
    <Image src="/brand/enderman.png" alt="Enderman da SWIFT MC segurando um bloco de grama" fill sizes="(max-width: 640px) 176px, (max-width: 1024px) 208px, 240px" className="object-contain opacity-90 drop-shadow-[0_0_24px_rgba(168,85,247,0.2)]" />
  </div>;
}
