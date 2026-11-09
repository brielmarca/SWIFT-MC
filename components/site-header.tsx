"use client";

import { ChevronDown, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";
import { getNavigationGroup, isNavigationItemActive, navigationGroups, type NavigationItem } from "@/lib/navigation";
import { useCart } from "./cart-provider";
import { Logo } from "./logo";
import { SiteSearchDialog, useSiteSearchHotkeys } from "./site-search";
import { LogoutButton } from "./auth/logout-button";

export type AuthUser = {
  id: string;
  emailNormalized: string | null;
  displayName: string;
  role: string;
};

function ContextualNav({ pathname }: { pathname: string }) {
  const group = getNavigationGroup(pathname);
  if (!group) return null;

  return (
    <div className="border-t border-white/[0.06] bg-void/80">
      <div className="site-container flex min-w-0 items-center gap-3">
        <span className="shrink-0 text-xs font-bold uppercase tracking-wider text-ultraviolet xl:hidden">{group.label}</span>
        <nav aria-label={`Subtópicos — ${group.label}`} className="flex min-w-0 gap-1 overflow-x-auto">
          {group.items.map((item) => (
            <a key={item.href} href={item.href}
              target={item.external ? "_blank" : undefined}
              rel={item.external ? "noopener noreferrer" : undefined}
              aria-current={isNavigationItemActive(item, pathname) ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ultraviolet ${isNavigationItemActive(item, pathname) ? "border-ultraviolet bg-violet/10 text-ultraviolet" : "border-transparent text-muted hover:bg-white/5 hover:text-ink"}`}
            >{item.label}</a>
          ))}
        </nav>
      </div>
    </div>
  );
}

function MobileNav({
  isOpen,
  onClose,
  pathname,
  openSearch,
  authUser,
}: {
  isOpen: boolean;
  onClose: () => void;
  pathname: string;
  openSearch: () => void;
  authUser?: AuthUser;
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

      {navigationGroups.map((group) => (
        <div key={group.label} className="border-t border-white/[0.06] pt-1">
          <MobileNavGroup label={group.label} items={group.items} pathname={pathname} onClose={onClose} />
        </div>
      ))}
      {authUser && <div className="border-t border-white/[0.06] pt-3 sm:hidden"><LogoutButton /></div>}
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
  items: NavigationItem[];
  pathname: string;
  onClose: () => void;
}) {
  const groupActive = items.some((item) => isNavigationItemActive(item, pathname));
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
              aria-current={isNavigationItemActive(item, pathname) ? "page" : undefined}
              className={`flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium ${isNavigationItemActive(item, pathname) ? "bg-violet/10 text-ultraviolet" : "text-muted"} hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet`}
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function AuthActions({ authUser }: { authUser?: AuthUser }) {
  if (authUser) {
    return (
      <div className="flex items-center gap-2">
        <a
          href="/account"
          className="icon-button"
          aria-label={`Conta: ${authUser.displayName}`}
        >
          <User size={18} aria-hidden="true" />
        </a>
        <div className="hidden sm:block"><LogoutButton compact /></div>
      </div>
    );
  }

  return (
    <a
      href="/login"
      className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet"
      aria-label="Entrar na conta"
    >
      <User size={18} aria-hidden="true" />
      <span className="hidden sm:inline">Entrar</span>
    </a>
  );
}

export function SiteHeader({ authUser }: { authUser?: AuthUser } = {}) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { itemCount, openCart, isOpen: cartOpen } = useCart();
  const pathname = usePathname();
  const activeGroup = getNavigationGroup(pathname);
  const menuRef = useRef<HTMLButtonElement>(null);

  function openSearch() {
    setOpen(false);
    setSearchOpen(true);
  }

  useSiteSearchHotkeys(!searchOpen && !cartOpen, openSearch);

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
          {navigationGroups.map((group) => (
            <a key={group.label} href={group.items[0].href}
              className={`nav-link ${activeGroup === group ? "text-ultraviolet" : ""}`}
              aria-current={activeGroup === group ? "true" : undefined}
            >{group.label}</a>
          ))}
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
          <AuthActions authUser={authUser} />
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

      <ContextualNav pathname={pathname} />
      <MobileNav isOpen={open} onClose={() => setOpen(false)} pathname={pathname} openSearch={openSearch} authUser={authUser} />

      {searchOpen && <SiteSearchDialog onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
