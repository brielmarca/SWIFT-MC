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
      },
      boxShadow: {
        card: "0 20px 70px -28px rgba(0, 0, 0, 0.85)",
        violet: "0 0 34px -8px rgba(168, 85, 247, 0.65)",
      },
    },
  },
  plugins: [],
} satisfies Config;
