import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // enable strict mode to encourage best practices
  reactStrictMode: true,
  experimental: {
    // any turbopack bundler config goes here
    turbo: {},
  },
  // this tiny bit of config fixes the pdfkit asset issue across dev with turbo OR webpack, local build and production !!
  serverExternalPackages: ['pdfkit'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.airtableusercontent.com',
        port: '',
      },
      {
        protocol: 'https',
        hostname: 'xuwucd0hn1ls3mxf.public.blob.vercel-storage.com',
        port: '',
      },
    ]
  },
}

export default nextConfig
