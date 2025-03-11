export default async function Component({
  params,
  // searchParams,
}: {
  params: Promise<{ name: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const name = (await params).name
  return (
    <h1>{name}</h1>
  )
}
