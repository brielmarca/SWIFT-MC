"use client";

import { ChevronDown, Menu, Search, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import { useCart } from "./cart-provider";
import { Logo } from "./logo";
import { SiteSearchDialog, useSiteSearchHotkeys } from "./site-search";

const navGroups = {
  comunidade: [
    { href: "/player", label: "Jogadores" },
    { href: "/online", label: "Online" },
    { href: "/leaderboards", label: "Ranking" },
    { href: "/news", label: "Notícias" },
    { href: "/events", label: "Eventos" },
    { href: "https://discord.gg/Bupp8tWvpu", label: "Discord", external: true },
  ],
  recursos: [
    { href: "/wiki", label: "Wiki" },
    { href: "/rules", label: "Regras" },
    { href: "/faq", label: "FAQ" },
    { href: "/status", label: "Status do servidor" },
  ],
};

const topLinks = [
  { href: "/play", label: "Jogar" },
  { href: "/store", label: "Loja" },
];

function NavDropdown({
  label,
  items,
  isActive,
}: {
  label: string;
  items: Array<{ href: string; label: string; external?: boolean }>;
  isActive: string;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const allLinks = items.map((i) => i.href);
  const groupActive = allLinks.some((href) => isActive === href || isActive.startsWith(`${href}/`));

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={`nav-link dropdown-trigger ${groupActive ? "text-ultraviolet" : ""}`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={label}
      >
        <span>{label}</span>
        <ChevronDown size={14} className="ml-1 transition-transform" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }} />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 z-50 mt-2 w-56 origin-top rounded-xl border border-white/[0.07] bg-void/95 backdrop-blur-xl shadow-lg p-2 animate-dropdown-enter"
          role="menu"
        >
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noopener noreferrer" : undefined}
              onClick={() => setOpen(false)}
              className={`block px-3 py-2 text-sm font-medium text-muted hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet rounded-lg ${isActive === item.href || isActive.startsWith(`${item.href}/`) ? "text-ultraviolet" : ""}`}
              role="menuitem"
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function MobileNav({
  isOpen,
  onClose,
  pathname,
  openSearch,
}: {
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
  openSearch: () => void;
}) {
  if (!isOpen) return null;

  return (
    <nav id="mobile-navigation" className="site-container grid max-h-[calc(100dvh-72px)] gap-1 overflow-y-auto border-t border-white/[0.06] py-3 xl:hidden" aria-label="Navegação móvel">
      <button
        type="button"
        data-search-trigger
        onClick={openSearch}
        className="flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-wider text-muted hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"
      >
        <Search size={18} aria-hidden="true" /> Buscar
      </button>

      <Link
        href="/play"
        onClick={onClose}
        className={`rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-wider ${pathname === "/play" ? "text-ultraviolet" : "text-muted"} hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet`}
      >
        Jogar
      </Link>

      <div className="border-t border-white/[0.06] my-1" />

      {Object.entries(navGroups).map(([key, items]) => (
        <MobileNavGroup key={key} items={items} pathname={pathname} onClose={onClose} />
      ))}

      <div className="border-t border-white/[0.06] my-1" />

      <Link
        href="/store"
        onClick={onClose}
        className={`rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-wider ${pathname === "/store" ? "text-ultraviolet" : "text-muted"} hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet`}
      >
        Loja
      </Link>
    </nav>
  );
}

function MobileNavGroup({
  items,
  pathname,
  onClose,
}: {
  items: Array<{ href: string; label: string; external?: boolean }>;
  pathname: string;
  onClose: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-3 text-sm font-bold uppercase tracking-wider text-muted hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"
        aria-expanded={open}
      >
        <span>{items[0].label === "Jogadores" ? "Comunidade" : "Recursos"}</span>
        <ChevronDown size={16} className="transition-transform" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }} />
      </button>
      {open && (
        <div className="pl-3 py-2 space-y-1 animate-dropdown-enter">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noopener noreferrer" : undefined}
              onClick={onClose}
              className={`block px-3 py-2 text-sm font-medium ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? "text-ultraviolet" : "text-muted"} hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet rounded-lg`}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

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
    <header
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          menuRef.current?.focus();
        }
      }}
      className="sticky top-0 z-50 border-b border-white/[0.06] bg-void/80 backdrop-blur-xl"
    >
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo
      </a>
      <div className="site-container flex h-[64px] items-center justify-between">
        <Logo />

        <nav className="hidden items-center gap-6 xl:flex" aria-label="Navegação principal">
          {topLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "page" : undefined}
              className={`nav-link ${pathname === link.href || pathname.startsWith(`${link.href}/`) ? "text-ultraviolet" : ""}`}
            >
              {link.label}
            </Link>
          ))}

          <NavDropdown
            label="Comunidade"
            items={navGroups.comunidade}
            isActive={pathname}
          />
          <NavDropdown
            label="Recursos"
            items={navGroups.recursos}
            isActive={pathname}
          />
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
          <button
            type="button"
            onClick={openCart}
            className="cart-button"
            aria-label={`Abrir carrinho, ${itemCount} ${itemCount === 1 ? "item" : "itens"}`}
          >
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

      <MobileNav isOpen={open} onClose={() => setOpen(false)} pathname={pathname} openSearch={openSearch} />

      {searchOpen && <SiteSearchDialog onClose={() => setSearchOpen(false)} />}
    </header>
  );
}