import type { Metadata } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';

// Self-hosted by Next.js at build time (no runtime request to Google) —
// a free-license geometric sans chosen for a similar friendly, confident
// feel to what we noticed on Samsung Food's site, without using their
// actual (proprietary, non-licensable) SamsungOne/SamsungSharpSans fonts.
const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-sans',
});

export const metadata: Metadata = {
  title: 'FoodPadi — your food companion',
  description: 'Your food companion that plans with you, not for you.',
};

// Applies the saved theme to <html> before the first paint, so no one sees
// a flash of the wrong theme. Black is the default now — dark is applied
// unless the user has explicitly chosen the white/"default" palette, rather
// than the old opt-in-to-dark behaviour. Kept tiny and dependency-free.
const THEME_INIT = `(function(){try{if(localStorage.getItem('foodpadi-theme')!=='default'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={plusJakartaSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
