// run with an ISR approach for component passports

// generate static paths at build time (to be updated via ISR)
export async function generateStaticParams() {
  // are we better off intergrating airtable SDK?
  const endpoint = `${process.env.NEXT_PUBLIC_AIRTABLE_API_URL}/${process.env.AIRTABLE_BASE_ID}/${process.env.AIRTABLE_COMPONENTS_TABLE_ID}`
  const data = await fetch(endpoint)
  console.log(data)
  return {
    props: {},
  };
}

export default async function Page({
  params,
  // searchParams,
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