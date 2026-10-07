"use client";

import { Menu, Search, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { playerLinks } from "@/data/server-info";
import { useCart } from "./cart-provider";
import { Logo } from "./logo";
import { SiteSearchDialog, useSiteSearchHotkeys } from "./site-search";

const links = [
  { href: "/#inicio", label: "Início" },
  { href: "/store", label: "Loja" },
  ...playerLinks,
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { itemCount, openCart, isOpen: cartOpen } = useCart();
  const pathname = usePathname();
  const menuRef = useRef<HTMLButtonElement>(null);

  function openSearch() {
    setOpen(false);
    setSearchOpen(true);
  }

  useSiteSearchHotkeys(searchOpen || cartOpen, openSearch);

  return (
    <header onKeyDown={(event) => { if (event.key === "Escape" && open) { setOpen(false); menuRef.current?.focus(); } }} className="sticky top-0 z-50 border-b border-white/[0.06] bg-void/80 backdrop-blur-xl">
      <a href="#main-content" className="skip-link">Pular para o conteúdo</a>
      <div className="site-container flex h-[72px] items-center justify-between">
        <Logo />
        <nav className="hidden items-center gap-4 xl:flex" aria-label="Navegação principal">
          {links.map((link) => (
            <Link key={link.href} href={link.href} aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "page" : undefined} className="nav-link aria-[current=page]:text-ultraviolet">
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-search-trigger
            onClick={openSearch}
            className="icon-button hidden md:grid"
            aria-label="Buscar no site (Ctrl+K)"
            aria-keyshortcuts="Control+K Meta+K"
          >
            <Search size={19} aria-hidden="true" />
          </button>
          <button type="button" onClick={openCart} className="cart-button" aria-label={`Abrir carrinho, ${itemCount} ${itemCount === 1 ? "item" : "itens"}`}>
            <ShoppingBag size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Carrinho</span>
            {itemCount > 0 && <span className="cart-count" aria-hidden="true">{itemCount}</span>}
          </button>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            ref={menuRef}
            className="icon-button xl:hidden"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls="mobile-navigation"
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-navigation" className="site-container grid max-h-[calc(100dvh-72px)] gap-1 overflow-y-auto border-t border-white/[0.06] py-3 xl:hidden" aria-label="Navegação móvel">
          <button
            type="button"
            data-search-trigger
            onClick={openSearch}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-wider text-muted hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"
          >
            <Search size={18} aria-hidden="true" /> Buscar
          </button>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "page" : undefined}
              className="rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-wider text-muted hover:bg-white/5 hover:text-ink aria-[current=page]:text-ultraviolet focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
      {searchOpen && <SiteSearchDialog onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
