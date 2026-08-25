import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FoodPadi — your food companion',
  description: 'Your food companion that plans with you, not for you.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
