import { type JSX } from 'react'

interface CenteredContainerProps {
  children: React.ReactNode;
}

export const CenteredContainer = ({ children }: CenteredContainerProps): JSX.Element => {
  return (
    <div className="flex flex-col flex-grow justify-center items-center space-y-4">
      {children}
    </div>
  )
}
