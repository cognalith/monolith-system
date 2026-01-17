/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Cognalith Cyber-Noir Palette
        'monolith-dark': '#000000',
        'monolith-green': '#00ff9d',
        'monolith-amber': '#ffb800',
        'monolith-gray': '#1a1a2e',
        // Neon Colors
        'neon-cyan': '#00f0ff',
        'neon-amber': '#ffb800',
        'neon-crimson': '#ff003c',
        'neon-green': '#00ff9d',
      },
      fontFamily: {
        'ui': ['Oxanium', 'JetBrains Mono', 'monospace'],
        'code': ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px #00f0ff, 0 0 10px rgba(0, 240, 255, 0.3)' },
          '50%': { boxShadow: '0 0 10px #00f0ff, 0 0 20px rgba(0, 240, 255, 0.5)' },
        }
      }
    },
  },
  plugins: [],
}
