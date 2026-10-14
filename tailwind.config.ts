import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        void: "#090a0f",
        surface: "#0e0f17",
        card: "#13141f",
        elevated: "#1c1d2d",
        ink: "#f8fafc",
        muted: "#a7a1b2",
        line: "#30283b",
        violet: "#a855f7",
        deep: "#7c3aed",
        ultraviolet: "#c084fc",
        swift: {
          primary: "#00d4ff",
          secondary: "#0099cc",
          light: "#66e4ff",
          dark: "#0077aa",
        },
        eclipse: {
          primary: "#cbd5e1",
          secondary: "#64748b",
          light: "#e2e8f0",
          dark: "#475569",
        },
        cosmic: {
          primary: "#ec4899",
          secondary: "#d946ef",
          light: "#f472b6",
          dark: "#be185d",
        },
        overdrive: {
          primary: "#f97316",
          secondary: "#ef4444",
          light: "#fb923c",
          dark: "#dc2626",
        },
      },
      boxShadow: {
        card: "0 20px 70px -28px rgba(0, 0, 0, 0.85)",
        violet: "0 0 34px -8px rgba(168, 85, 247, 0.65)",
        swift: "0 0 34px -8px rgba(0, 212, 255, 0.55)",
        eclipse: "0 0 34px -8px rgba(203, 213, 225, 0.25)",
        cosmic: "0 0 34px -8px rgba(236, 72, 153, 0.55)",
        overdrive: "0 0 34px -8px rgba(249, 115, 22, 0.55)",
      },
    },
  },
  plugins: [],
} satisfies Config;
