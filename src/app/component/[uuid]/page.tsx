export default async function Component({
  params,
  searchParams,
}: {
  params: Promise<{ uuid: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const uuid = (await params).uuid
  return (
    <>
      <h1>COMPONENT PASSPORT</h1>
      <p>UUID: {uuid}</p>
    </>
  );
}
