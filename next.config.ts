import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // enable strict mode to encourage best practices
  reactStrictMode: true,
  experimental: {
    // any turbopack bundler config goes here
    turbo: {
      // rules: {}
    },
  },
  outputFileTracingIncludes: {
    // instruct Next to keep pdfkit assets regardless of file tracing
    '/api/airtable/generate-pdf': ['./node_modules/pdfkit/js/data/**'],
  },
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
