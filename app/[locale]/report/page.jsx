import { Suspense } from 'react';
import Links from './links';

export default async function Page({ params }) {
  const { locale } = await params;
  return (
    <main>
      <h1>Current locale: {locale}</h1>
      <Suspense fallback={<p>Loading links...</p>}>
        <Links />
      </Suspense>
    </main>
  );
}
