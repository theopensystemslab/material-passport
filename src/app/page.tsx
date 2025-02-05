export default function Splash({
  // params,
  // searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  return (
    <>
      <h1>
        Component Passports
      </h1>
      <h2>
        An app written in Next.js
      </h2>
      <h3>
        Moreeeeeeee...
      </h3>
      <p> TEST </p>
    </>
  );
}