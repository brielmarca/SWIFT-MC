"use client";

import { CheckCircle2, ShoppingBag, Trash2, X } from "lucide-react";
import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { formatPrice, type Rank, type RankSlug } from "@/data/ranks";
import { CART_STORAGE_KEY, getCartRanks, getCartSubtotal, parseCart } from "@/lib/cart";

const EMPTY_CART = "[]";
const CART_EVENT = "swift-mc-cart-change";
let memoryCart: string | undefined;

type CartContextValue = {
  items: Rank[];
  itemCount: number;
  subtotalCents: number;
  isOpen: boolean;
  ready: boolean;
  addItem: (slug: RankSlug) => boolean;
  removeItem: (slug: RankSlug) => void;
  clearCart: () => void;
  hasItem: (slug: RankSlug) => boolean;
  openCart: () => void;
  closeCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function subscribeToCart(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CART_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CART_EVENT, callback);
  };
}

function getCartSnapshot() {
  if (memoryCart !== undefined) return memoryCart;
  try { return window.localStorage.getItem(CART_STORAGE_KEY) ?? EMPTY_CART; }
  catch { return EMPTY_CART; }
}

function setCart(slugs: readonly RankSlug[]) {
  const serialized = JSON.stringify(slugs);
  try { window.localStorage.setItem(CART_STORAGE_KEY, serialized); memoryCart = undefined; }
  catch { memoryCart = serialized; }
  window.dispatchEvent(new Event(CART_EVENT));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(subscribeToCart, () => true, () => false);
  const storedCart = useSyncExternalStore(subscribeToCart, getCartSnapshot, () => EMPTY_CART);
  const slugs = useMemo(() => parseCart(storedCart), [storedCart]);
  const items = useMemo(() => getCartRanks(slugs), [slugs]);
  const subtotalCents = getCartSubtotal(items);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState("");

  function announce(message: string) {
    setToast(message);
  }

  function addItem(slug: RankSlug) {
    const currentSlugs = parseCart(getCartSnapshot());
    const rank = getCartRanks([slug])[0];
    if (!rank || currentSlugs.includes(slug)) {
      if (rank) announce(`${rank.name} já está no carrinho.`);
      return false;
    }

    setCart([...currentSlugs, slug]);
    announce(`${rank.name} foi adicionado ao carrinho.`);
    return true;
  }

  function removeItem(slug: RankSlug) {
    const rank = items.find((item) => item.slug === slug);
    setCart(slugs.filter((itemSlug) => itemSlug !== slug));
    if (rank) announce(`${rank.name} foi removido do carrinho.`);
  }

  function clearCart() {
    setCart([]);
    announce("Carrinho esvaziado.");
  }

  const value: CartContextValue = {
    items,
    itemCount: items.length,
    subtotalCents,
    isOpen,
    ready,
    addItem,
    removeItem,
    clearCart,
    hasItem: (slug) => slugs.includes(slug),
    openCart: () => setIsOpen(true),
    closeCart: () => setIsOpen(false),
  };

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartDrawer />
      <div className={`cart-toast ${toast ? "cart-toast-visible" : ""}`} role="status" aria-live="polite" aria-atomic="true">
        {toast && <><CheckCircle2 size={18} aria-hidden="true" /> {toast}</>}
      </div>
      {toast && <ToastTimer message={toast} onDone={() => setToast("")} />}
    </CartContext.Provider>
  );
}

function ToastTimer({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timeout = window.setTimeout(onDone, 3200);
    return () => window.clearTimeout(timeout);
  }, [message, onDone]);
  return null;
}

function CartDrawer() {
  const { items, subtotalCents, isOpen, closeCart, removeItem, clearCart } = useCart();
  const panelRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const closeFromEffect = useEffectEvent(closeCart);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeFromEffect();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[90]" role="presentation">
      <button type="button" className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm" onClick={closeCart} aria-label="Fechar carrinho" />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        tabIndex={-1}
        className="cart-drawer"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] px-5 py-5 sm:px-6">
          <div>
            <p className="eyebrow">Sua seleção</p>
            <h2 id="cart-title" className="mt-1 text-xl font-extrabold uppercase text-ink">Carrinho</h2>
          </div>
          <button type="button" onClick={closeCart} className="icon-button" aria-label="Fechar carrinho">
            <X size={21} aria-hidden="true" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
            <span className="icon-well !h-14 !w-14"><ShoppingBag size={25} aria-hidden="true" /></span>
            <h3 className="mt-5 text-lg font-bold uppercase text-ink">Seu carrinho está vazio</h3>
            <p className="mt-2 max-w-xs text-sm leading-6 text-muted">Explore os ranks e escolha as vantagens ideais para sua jornada.</p>
            <Link href="/store#store-search" onClick={closeCart} className="button-primary mt-6">Explorar ranks</Link>
            <button type="button" disabled className="button-secondary mt-3 cursor-not-allowed opacity-50">Finalizar compra</button>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-5 sm:px-6">
              {items.map((rank) => (
                <article key={rank.slug} className="rounded-xl border border-white/[0.08] bg-white/[0.035] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className={`rank-badge ${rank.featured ? "rank-badge-featured" : ""}`}>{rank.badge}</span>
                      <h3 className="mt-3 text-lg font-extrabold uppercase text-ink">{rank.name}</h3>
                      <p className="mt-1 text-sm font-bold tabular-nums text-ultraviolet">{rank.price}</p>
                    </div>
                    <button type="button" onClick={() => removeItem(rank.slug)} className="icon-button text-muted hover:!border-red-400/40 hover:!text-red-300" aria-label={`Remover ${rank.name} do carrinho`}>
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <Link href={`/ranks/${rank.slug}`} onClick={closeCart} className="mt-3 inline-flex min-h-11 items-center text-xs font-bold uppercase tracking-wider text-muted hover:text-ink">Ver detalhes</Link>
                </article>
              ))}
            </div>
            <div className="border-t border-white/[0.08] bg-black/20 px-5 py-5 sm:px-6">
              <div className="flex items-end justify-between gap-4">
                <span className="micro-label">Subtotal</span>
                <strong className="text-2xl font-extrabold tabular-nums text-ink">{formatPrice(subtotalCents)}</strong>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">Carrinho local. Nenhum dado será enviado ou cobrado nesta etapa.</p>
              <Link href="/checkout" onClick={closeCart} className="button-primary mt-5 w-full">Finalizar compra</Link>
              <Link href="/store#store-search" onClick={closeCart} className="button-secondary mt-2 w-full">Continuar na loja</Link>
              <button type="button" onClick={clearCart} className="mt-2 min-h-11 w-full text-xs font-bold uppercase tracking-wider text-muted hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ultraviolet">Limpar carrinho</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider.");
  return context;
}
