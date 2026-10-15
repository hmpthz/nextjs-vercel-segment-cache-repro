export function generateStaticParams() {
  // Leave zh-tw out so its first request generates and caches the page.
  const locales = process.env.PRERENDER_ALL_LOCALES === '1'
    ? ['en', 'zh-tw']
    : ['en'];
  return locales.map((locale) => ({ locale }));
}

export default async function Layout({ children, params }) {
  const { locale } = await params;
  return <html lang={locale}><body>{children}</body></html>;
}
