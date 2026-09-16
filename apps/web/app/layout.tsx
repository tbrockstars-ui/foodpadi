import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { CookieNotice } from '../components/CookieNotice';
import './globals.css';

// Inter — self-hosted by Next.js at build time (no runtime request to
// Google). A modern, highly readable neutral sans: editorial and confident
// for large headings, calm for body. Replaces Plus Jakarta Sans, whose
// rounder letterforms read a touch softer than the premium-food direction.
const sans = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-sans',
  display: 'swap',
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
    <html lang="en-GB" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        {children}
        <CookieNotice />
      </body>
    </html>
  );
}
