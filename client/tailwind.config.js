/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Deep green reads as "shared, sustainable transport" without being the
        // default framework blue every other project ships with.
        brand: {
          50: "#f0f7f4",
          100: "#dbeee5",
          200: "#b9dccd",
          300: "#8cc3ae",
          400: "#5aa38b",
          500: "#3a866e",
          600: "#286b57",
          700: "#215647",
          800: "#1c453a",
          900: "#183a31",
        },
        surface: {
          DEFAULT: "#ffffff",
          sunken: "#f5f6f7",
          raised: "#fbfcfc",
        },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)",
        lift: "0 4px 12px rgba(16, 24, 40, 0.08)",
        sheet: "0 -4px 16px rgba(16, 24, 40, 0.08)",
      },
      borderRadius: { xl2: "12px" },
    },
  },
  plugins: [],
};
