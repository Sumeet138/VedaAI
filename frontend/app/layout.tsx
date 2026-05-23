import type { Metadata } from 'next';
import { Bricolage_Grotesque } from 'next/font/google';
import 'katex/dist/katex.min.css';
import 'katex/contrib/mhchem';
import './globals.css';

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['200', '300', '400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'VedaAI — Assessment Creator',
  description: 'AI-powered question paper generator for teachers',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${bricolage.variable} antialiased bg-white text-zinc-900 font-sans`}>
        {children}
      </body>
    </html>
  );
}
