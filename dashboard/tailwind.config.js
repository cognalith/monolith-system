/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'monolith-dark': '#0a0a0f',
        'monolith-green': '#00ff88',
        'monolith-amber': '#ffaa00',
        'monolith-gray': '#1a1a2e',
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
