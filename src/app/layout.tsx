import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { type ReactNode } from 'react'

import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import './globals.css'


const interSans = Inter({
  variable: '--font-inter-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Component Passports',
  description: 'Track your WikiHouse blocks all the way home',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${interSans.variable} antialiased bg-background text-foreground flex flex-col min-h-screen justify-between`}
      >
        <Header />
        <main className="flex flex-col px-8 pt-4 pb-16 gap-8 mb-auto">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
