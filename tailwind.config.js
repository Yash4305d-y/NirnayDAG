/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        siddha: {
          emerald: '#10b981',
          cyan: '#06b6d4'
        },
        vichar: '#f59e0b',
        parivartan: '#6366f1',
        tyakta: '#f43f5e',
        obsidian: '#090a0f',
        panel: 'rgba(18, 20, 28, 0.7)',
      },
      fontFamily: {
        mono: ['Geist Mono', 'JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'dot-matrix': 'radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px)',
      },
      backgroundSize: {
        'dot': '20px 20px',
      }
    },
  },
  plugins: [],
}
