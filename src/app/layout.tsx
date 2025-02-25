import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import ProfileButton from "./ProfileButton";
import Footer from "./Footer"
import "./globals.css";

const interSans = Inter({
  variable: '--font-inter-sans',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Component Passports',
  description: 'Track your WikiHouse blocks all the way home',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${interSans.variable} antialiased bg-background text-foreground flex flex-col min-h-screen justify-between`}
      >
          <main className="flex flex-col p-8 pb-20 gap-16 mb-auto">
            <ProfileButton />
            {children}
          </main>
          <Footer />
      </body>
    </html>
  );
}
