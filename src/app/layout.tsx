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
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body
        className={`${interSans.variable} antialiased bg-background text-foreground flex flex-col min-h-screen justify-between`}
      >
        <Header />
        <div className="container mx-auto max-w-6xl">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  )
}
