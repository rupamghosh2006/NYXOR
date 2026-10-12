/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#080B11",
        surface: "#0F1523",
        "surface-card": "#131B2E",
        border: "#1E293B",
        phase: {
          open: "#10B981",
          preclose: "#F59E0B",
          closed: "#8B5CF6",
          reopen: "#3B82F6",
        },
        accent: {
          violet: "#8B5CF6",
          cyan: "#06B6D4",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
