/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg:       "#0d0f14",
        surface:  "#141720",
        surface2: "#1c2030",
        border:   "#252a3a",
        gold:     "#f5a623",
        "gold-dim": "#c4830d",
        muted:    "#8a93a8",
        dim:      "#5a6075",
      },
    },
  },
  plugins: [],
}
