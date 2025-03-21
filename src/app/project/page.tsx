import { kebabCase } from 'es-toolkit'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { getProjects } from '@/lib/airtable'


export default async function Page({
  // params,
  // searchParams,
}: {
  params: Promise<object>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const projects = await getProjects()
  return <>
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
