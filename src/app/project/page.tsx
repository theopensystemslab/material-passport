import { kebabCase } from 'es-toolkit'
import Link from 'next/link'

import { ReturnButton } from '@/components/ReturnButton'
import { Button } from '@/components/ui/button'
import { getProjects } from '@/lib/airtable'

export default async function Page() {
  const projects = await getProjects()
  return <>
    <ReturnButton href="/" label="Go home" />
    <h2 className="p-4 mb-8">
      Choose your project
    </h2>
    {projects.map((project, i) => {
      return (
        <Button key={i} variant="outline" size="lg" asChild className="rounded-md px-16 py-4 lg:text-lg">
          <Link href={`/project/${kebabCase(project.projectName)}`}>
            {project.projectName}
          </Link>
        </Button>
      )
    })}
  </>
}
