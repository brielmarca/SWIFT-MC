"use client";

import { ChevronDown, Menu, Search, ShoppingBag, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useId, useRef, useState, useEffect } from "react";
import { useCart } from "./cart-provider";
import { Logo } from "./logo";
import { SiteSearchDialog, useSiteSearchHotkeys } from "./site-search";

const navGroups = {
  jogar: [
    { href: "/play", label: "Como jogar" },
    { href: "/status", label: "Status" },
    { href: "/online", label: "Online" },
    { href: "/leaderboards", label: "Ranking" },
  ],
  comunidade: [
    { href: "/community", label: "Visão geral" },
    { href: "/news", label: "Notícias" },
    { href: "/events", label: "Eventos" },
    { href: "/player", label: "Jogadores" },
    { href: "https://discord.gg/Bupp8tWvpu", label: "Discord", external: true },
  ],
  recursos: [
    { href: "/wiki", label: "Wiki" },
    { href: "/rules", label: "Regras" },
    { href: "/faq", label: "FAQ" },
  ],
};

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
  const panelId = useId();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleFocusOut(event: FocusEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.relatedTarget as Node | null)) {
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
      document.addEventListener("focusout", handleFocusOut);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("focusout", handleFocusOut);
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
        className={`nav-link ${groupActive ? "text-ultraviolet" : ""}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={label}
      >
        <span>{label}</span>
        <ChevronDown size={14} className="shrink-0 transition-transform" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }} />
      </button>
      {open && (
        <div
          id={panelId}
          className="absolute left-0 top-full z-50 mt-2 w-56 origin-top rounded-xl border border-white/10 bg-void/95 p-2 shadow-lg backdrop-blur-xl animate-dropdown-enter"
        >
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noopener noreferrer" : undefined}
              onClick={() => setOpen(false)}
              className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet ${isActive === item.href || isActive.startsWith(`${item.href}/`) ? "bg-violet/10 text-ultraviolet" : "text-muted"}`}
              aria-current={isActive === item.href ? "page" : undefined}
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

      <MobileNavGroup
        label="Jogar"
        items={navGroups.jogar}
        pathname={pathname}
        onClose={onClose}
      />

      <div className="border-t border-white/[0.06] my-1" />

<MobileNavGroup
  label="Loja"
  items={[{ href: "/store", label: "VIPs" }]}
  pathname={pathname}
  onClose={onClose}
/>

      <div className="border-t border-white/[0.06] my-1" />

      <MobileNavGroup
        label="Comunidade"
        items={navGroups.comunidade}
        pathname={pathname}
        onClose={onClose}
      />

      <div className="border-t border-white/[0.06] my-1" />

      <MobileNavGroup
        label="Recursos"
        items={navGroups.recursos}
        pathname={pathname}
        onClose={onClose}
      />
    </nav>
  );
}

function MobileNavGroup({
  label,
  items,
  pathname,
  onClose,
}: {
  label: string;
  items: Array<{ href: string; label: string; external?: boolean }>;
  pathname: string;
  onClose: () => void;
}) {
  const groupActive = items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  const [open, setOpen] = useState(groupActive);
  const panelId = useId();

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-11 w-full items-center justify-between rounded-lg px-3 py-3 text-sm font-bold uppercase tracking-wider hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet ${groupActive ? "text-ultraviolet" : "text-muted"}`}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span>{label}</span>
        <ChevronDown size={16} className="transition-transform" aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : "rotate(0)" }} />
      </button>
      {open && (
        <div id={panelId} className="space-y-1 py-2 pl-3 animate-dropdown-enter">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noopener noreferrer" : undefined}
              onClick={onClose}
              aria-current={pathname === item.href ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? "bg-violet/10 text-ultraviolet" : "text-muted"} hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet`}
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
          <NavDropdown
            label="Jogar"
            items={navGroups.jogar}
            isActive={pathname}
          />
<NavDropdown
  label="Loja"
  items={[{ href: "/store", label: "VIPs" }]}
  isActive={pathname}
/>
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
            className="icon-button hidden xl:grid"
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
