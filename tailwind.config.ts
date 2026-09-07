import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#070908",
        panel: "#0d110f",
        line: "#202722",
        signal: "#b8ff65",
        muted: "#8a968e",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "Consolas", "monospace"],
      },
      boxShadow: {
        signal: "0 0 0 1px rgba(184,255,101,.15), 0 22px 80px rgba(0,0,0,.45)",
      },
    },
  },
  plugins: [],
};

export default config;
