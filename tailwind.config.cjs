/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", "'DM Sans'", "sans-serif"],
        body: ["'DM Sans'", "'Space Grotesk'", "sans-serif"],
      },
      colors: {
        brand: {
          DEFAULT: "#7c3aed",
          accent: "#ff8a05",
          surface: "#11121a",
        },
      },
      boxShadow: {
        halo: "0 20px 45px rgba(124, 58, 237, 0.2)",
      },
    },
  },
  plugins: [],
};
