import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { type ReactNode } from 'react'

import { Footer } from '@/app/Footer'
import { Header } from '@/app/Header'
import './globals.css'


const interSans = Inter({
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Material Passport',
  description: 'Track your WikiHouse blocks all the way home',
}

// we implement a minimal but decisive layout for full app here, leaving more specific layout/styling to individual pages
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
        className={`${interSans.className} antialiased bg-background text-foreground flex flex-col min-h-screen justify-start`}
      >
        <Header />
        <main className="flex flex-col flex-1 container max-w-6xl mx-auto mb-auto p-8 pt-4 gap-4">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
