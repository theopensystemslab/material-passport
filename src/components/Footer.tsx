import { type JSX } from 'react'
import { type FooterProps } from 'react-html-props'

import { cn } from '@/lib/utils'

interface FooterPropsCN extends FooterProps {
  className?: string,
}

export const Footer = ({ className, ...props }: FooterPropsCN): JSX.Element => {
  return (
    <footer 
      {...props}
      className={cn(className, 'flex flex-col items-start p-8 lg:px-16 bg-foreground text-background')}
    >
      <a
        href="https://www.opensystemslab.io/news/100-factories"
        target="_blank"
        rel="noopener noreferrer"
      >
        What is this?
      </a>
      <a
        href="https://www.opensystemslab.io/contact"
        target="_blank"
        rel="noopener noreferrer"
      >
        Feedback
      </a>
      <a
        href="https://www.opensystemslab.io/contact"
        target="_blank"
        rel="noopener noreferrer"
      >
        Contact
      </a>
      <a
        href="https://www.opensystemslab.io/"
        target="_blank"
        rel="noopener noreferrer"
      >
        OSL
      </a>
    </footer>
  )
}
