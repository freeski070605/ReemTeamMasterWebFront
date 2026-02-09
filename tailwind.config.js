module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#121212",
        secondary: "#1E1E1E",
        accent: "#FFD700",
        success: "#28A745",
        error: "#DC3545",
        "text-primary": "#FFFFFF",
        "text-secondary": "#A0A0A0",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}
