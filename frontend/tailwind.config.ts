import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "bg-base": "#0A0E1A",
        "bg-surface": "#111827",
        "bg-border": "#1F2937",
        "accent-cyan": "#00D4FF",
        danger: "#FF4444",
        warning: "#F59E0B",
        safe: "#10B981",
        "text-primary": "#F9FAFB",
        "text-muted": "#6B7280",
      },
    },
  },
  plugins: [],
};

export default config;

