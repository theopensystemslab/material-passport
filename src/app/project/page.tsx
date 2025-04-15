import { kebabCase } from 'es-toolkit'
import Link from 'next/link'

import { ReturnButton } from '@/components/ReturnButton'
import { Button } from '@/components/ui/button'
import { getProjects } from '@/lib/airtable'
import type { Project } from '@/lib/schema'
import { shouldShowRecord } from '@/lib/utils'

export const revalidate = 7200

export default async function Page() {  
  let projects: Project[] = []
  try {
    projects = await getProjects()
  } catch (error) {
    const msg = `Failed to fetch projects - ${error}`
    console.error(msg)
    throw new Error(msg)
  }

  return <>
    <ReturnButton href="/" label="Go home" />
    <h2 className="p-4 mb-8">
      Choose your project
    </h2>
    {projects
      .filter(project => shouldShowRecord(project))
      .map((project, i) => {
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
