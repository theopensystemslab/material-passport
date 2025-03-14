import path from 'path'

import copyWebpackPlugin from 'copy-webpack-plugin'
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // enable strict mode to encourage best practices
  reactStrictMode: true,
  experimental: {
    // any turbopack bundler config goes here
    turbo: {},
  },
  outputFileTracingIncludes: {
    // instruct Next to keep pdfkit assets on hand regardless of file tracing (for copying by webpack)
    '/api/airtable/generate-pdf': ['./node_modules/pdfkit/js/data/**'],
  },
  // Next still uses webpack in production, even though it prefers turbopack in dev
  webpack: (config, { isServer }) => {
    // we use a webpack plugin to copy pdfkit assets for local dev server and builds (does not work on production!)
    let targetDir
    if (isServer) {
      targetDir = path.join(config.output.path!, 'chunks', 'data')
    } else {
      targetDir = path.join(config.output.path!, 'server', 'vendor-chunks', 'data')
    }
    config.plugins.push(
      new copyWebpackPlugin({
        patterns: [
          {
            from: path.join(process.cwd(), 'node_modules', 'pdfkit', 'js', 'data', 'Helvetica.afm'),
            to: path.join(targetDir, 'Helvetica.afm'),
          },
          {
            from: path.join(process.cwd(), 'node_modules', 'pdfkit', 'js', 'data', 'sRGB_IEC61966_2_1.icc'),
            to: path.join(targetDir, 'sRGB_IEC61966_2_1.icc'),
          },
        ]
      })
    )
    return config
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
