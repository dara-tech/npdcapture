/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './src/**/*.{js,jsx,ts,tsx}',
        './.d2/shell/src/**/*.{js,jsx,ts,tsx}',
    ],
    theme: {
        container: {
            center: true,
            padding: '1rem',
            screens: {
                '2xl': '1200px',
            },
        },
        extend: {
            fontFamily: {
                sans: ['Krasar', 'Kantumruy Pro', 'Khmer Battambang', 'Google Sans', 'system-ui', 'sans-serif'],
                display: ['Bayon', 'Krasar', 'Kantumruy Pro', 'Khmer Battambang', 'Google Sans', 'system-ui', 'sans-serif'],
                header: ['Bayon', 'Krasar', 'Kantumruy Pro', 'Khmer Battambang', 'Google Sans', 'system-ui', 'sans-serif'],
            },
            colors: {
                zinc: {
                    950: '#000000',
                    900: '#050505',
                    850: '#0a0a0a',
                    800: '#111111',
                    750: '#161616',
                    700: '#222222',
                    600: '#333333',
                    500: '#71717a',
                    400: '#a1a1aa',
                    300: '#d4d4d8',
                    200: '#e4e4e7',
                    100: '#f4f4f5',
                    50: '#fafafa',
                },
                primary: {
                    DEFAULT: 'var(--app-header-bar-bg, #2c6693)',
                    foreground: '#ffffff',
                },
                'app-primary': 'var(--app-header-bar-bg, #2c6693)',
                'app-tint-8': 'rgba(var(--app-header-bar-rgb, 44 102 147) / 0.08)',
                'app-tint-10': 'rgba(var(--app-header-bar-rgb, 44 102 147) / 0.10)',
                'app-tint-16': 'rgba(var(--app-header-bar-rgb, 44 102 147) / 0.16)',
                'app-tint-35': 'rgba(var(--app-header-bar-rgb, 44 102 147) / 0.35)',
            },
            borderRadius: {
                lg: '0.625rem',
                md: '0.5rem',
                sm: '0.375rem',
            },
            boxShadow: {
                card: 'none',
            },
        },
    },
    plugins: [require('tailwindcss-animate')],
}
