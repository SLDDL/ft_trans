/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./public/**/*.{html,js}"],
  theme: {
    extend: {
      colors: {
        'neon-green': '#00ff00',
        'neon-blue': '#00ccff',
        'dark-navy': '#001122',
        'medium-navy': '#003366',
        'bright-navy': '#0066cc',
      },
      fontFamily: {
        'game': ['Arial', 'sans-serif'],
      },
      boxShadow: {
        'neon-green': '0 0 15px rgba(0, 255, 0, 0.4)',
        'neon-green-strong': '0 0 30px rgba(0, 255, 0, 0.3)',
      },
      textShadow: {
        'neon': '0 0 10px rgba(0, 255, 0, 0.5)',
        'game': '2px 2px 4px rgba(0, 0, 0, 0.8)',
        'game-light': '1px 1px 2px rgba(0, 0, 0, 0.8)',
      },
      animation: {
        'pulse-neon': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [
    function({ matchUtilities, theme }) {
      matchUtilities(
        {
          'text-shadow': (value) => ({
            textShadow: value,
          }),
        },
        { values: theme('textShadow') }
      )
    },
  ],
}
