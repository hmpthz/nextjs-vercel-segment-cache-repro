'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function Links() {
  const searchParams = useSearchParams();
  return (
    <>
      <nav>
        <Link href="/report" data-locale="en">English</Link>
        {' | '}
        <Link href="/zh-tw/report" data-locale="zh-tw">Traditional Chinese</Link>
      </nav>
      <p>Report target: {searchParams.get('slug') ?? '(none)'}</p>
    </>
  );
}
