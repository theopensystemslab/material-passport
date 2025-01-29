export default function Scanner({
  params,
  searchParams,
}: {
  params: Promise<{}>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  return <h1>SCAN QR CODE</h1>
}