import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FAFAF6",
        ink: "#1C2B24",
        moss: {
          DEFAULT: "#3F7A5C",
          dark: "#2E5C44",
          light: "#E4EEE8",
        },
        marigold: {
          DEFAULT: "#E8A33D",
          // Darkened from #C6842A — axe flagged text-marigold-dark on
          // bg-marigold-light (the "Organization"/"Applied" badges) at
          // 2.66:1, short of WCAG AA's 4.5:1 for normal text. Only ever
          // used as badge text on that light background (confirmed via
          // grep before changing it), so darkening it here has no other
          // visual side effect to weigh.
          dark: "#6B4515",
          light: "#FBEBD3",
        },
        line: "#DCE3DC",
      },
      fontFamily: {
        display: ["var(--font-space-grotesk)", "sans-serif"],
        body: ["var(--font-plex-sans)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      borderRadius: {
        card: "0.75rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(28,43,36,0.04), 0 8px 20px -12px rgba(28,43,36,0.10)",
        lift: "0 4px 8px rgba(28,43,36,0.05), 0 20px 40px -16px rgba(28,43,36,0.20)",
        pop: "0 1px 1px rgba(28,43,36,0.05), 0 2px 6px rgba(28,43,36,0.08)",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        shimmer: "shimmer 1.6s ease-in-out infinite",
        "fade-in-up": "fade-in-up 0.45s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in": "fade-in 0.3s ease-out both",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
