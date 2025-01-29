export default function Projects({
  params,
  searchParams,
}: {
  params: Promise<{}>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  return <h1>PROJECTS</h1>
}