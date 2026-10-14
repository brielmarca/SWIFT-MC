"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Rank } from "@/data/ranks";

type Draft = { username: string; email: string };
type DemoReceipt = { items: readonly Rank[]; totalCents: number | null };
const DraftContext = createContext<{ draft: Draft; updateDraft: (field: keyof Draft, value: string) => void; receipt: DemoReceipt | null; completeDemo: (receipt: DemoReceipt) => void } | null>(null);

// In-memory only: survives Next.js navigation without storing contact data on disk.
export function CheckoutDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>({ username: "", email: "" });
  const [receipt, setReceipt] = useState<DemoReceipt | null>(null);
  return <DraftContext.Provider value={{ draft, receipt, completeDemo: setReceipt, updateDraft: (field, value) => setDraft((previous) => ({ ...previous, [field]: value })) }}>{children}</DraftContext.Provider>;
}

export function useCheckoutDraft() {
  const context = useContext(DraftContext);
  if (!context) throw new Error("useCheckoutDraft requires CheckoutDraftProvider");
  return context;
}
