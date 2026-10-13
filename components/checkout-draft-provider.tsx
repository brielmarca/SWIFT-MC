"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type Draft = { username: string; email: string };
const DraftContext = createContext<{ draft: Draft; updateDraft: (field: keyof Draft, value: string) => void } | null>(null);

// In-memory only: survives Next.js navigation without storing contact data on disk.
export function CheckoutDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>({ username: "", email: "" });
  return <DraftContext.Provider value={{ draft, updateDraft: (field, value) => setDraft((previous) => ({ ...previous, [field]: value })) }}>{children}</DraftContext.Provider>;
}

export function useCheckoutDraft() {
  const context = useContext(DraftContext);
  if (!context) throw new Error("useCheckoutDraft requires CheckoutDraftProvider");
  return context;
}
