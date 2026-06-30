/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#0f8a6b",
          dark: "#0f3f35",
          deep: "#06261f",
          panel: "#12372e",
          muted: "#dff2eb",
          soft: "#e3f6ef",
        },
        app: {
          background: "#f8f7f2",
          surface: "#fbfaf6",
          ink: "#0f172a",
          muted: "#64748b",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 24px 90px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
