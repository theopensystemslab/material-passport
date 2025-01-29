export default async function Component({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const slug = (await params).slug
  return (
    <h1>{slug}</h1>
  );
}
