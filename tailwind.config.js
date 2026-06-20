/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:       'hsl(var(--bg))',
        surface:  'hsl(var(--surface))',
        surface2: 'hsl(var(--surface2))',
        accent:   'hsl(var(--accent))',
        fg:       'hsl(var(--fg))',
        'fg-2':   'hsl(var(--fg-2))',
        'fg-3':   'hsl(var(--fg-3))',
        border:   'hsl(var(--border))',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        sm:      'var(--radius-sm)',
        lg:      'var(--radius-lg)',
      },
      fontFamily: {
        sans: ['"Apfel Grotezk"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        lore: ['"LORE Bold"', '"Apfel Grotezk"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
