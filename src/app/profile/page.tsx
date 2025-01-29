export default function Profile({
  params,
  searchParams,
}: {
  params: Promise<{}>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  return <h1>PROFILE</h1>
}