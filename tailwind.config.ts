import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#05070F",
          900: "#0A0E1A",
          800: "#10162A",
        },
      },
      backgroundImage: {
        "brand-gradient":
          "linear-gradient(135deg, #3B82F6 0%, #6366F1 45%, #A855F7 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, rgba(59,130,246,0.16) 0%, rgba(99,102,241,0.16) 45%, rgba(168,85,247,0.16) 100%)",
      },
      boxShadow: {
        glow: "0 0 40px rgba(99,102,241,0.35)",
      },
      animation: {
        "pulse-slow": "pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 8s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
