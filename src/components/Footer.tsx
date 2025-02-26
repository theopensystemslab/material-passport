import { type JSX } from 'react'

export const Footer = (): JSX.Element => {
  return (
    <footer className="flex flex-col items-start p-8 bg-foreground text-background">
      <nav>
        <a
          className="flex items-center gap-2"
          href="https://www.opensystemslab.io/news/100-factories"
          target="_blank"
          rel="noopener noreferrer"
        >
          What is this?
        </a>
        <a
          className="flex items-center gap-2"
          href="https://www.opensystemslab.io/contact"
          target="_blank"
          rel="noopener noreferrer"
        >
          Feedback
        </a>
        <a
          className="flex items-center gap-2"
          href="https://www.opensystemslab.io/contact"
          target="_blank"
          rel="noopener noreferrer"
        >
          Contact
        </a>
        <a
          className="flex items-center gap-2"
          href="https://www.opensystemslab.io/"
          target="_blank"
          rel="noopener noreferrer"
        >
          OSL
        </a>
      </nav>
    </footer>
  )
}
