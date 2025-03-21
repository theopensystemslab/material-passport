import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // enable strict mode to encourage best practices
  reactStrictMode: true,
  experimental: {
    // any turbopack bundler config goes here
    turbo: {},
    serverActions: {
      // this is just for good measure / to prevent more errant behaviour from Next
      allowedOrigins: [
        'api.airtable.com',
        'v5.airtableusercontent.com',
        'xuwucd0hn1ls3mxf.public.blob.vercel-storage.com',
      ],
      // default limit for server action transfer is 1mb, but most modern phone cameras average out much higher
      bodySizeLimit: '7mb',
    }
  },
  serverExternalPackages: [
    // this tiny bit of config fixes the pdfkit asset issue across dev with turbo OR webpack, local build and production !!
    'pdfkit',
    // and this line solves the 'e is not a function' error with Vercel's own blob put() function
    '@vercel/blob',
  ],
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
