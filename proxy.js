import { NextResponse } from 'next/server';

export function proxy(request) {
  if (request.nextUrl.pathname === '/report') {
    const url = request.nextUrl.clone();
    url.pathname = '/en/report';
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/report'] };
