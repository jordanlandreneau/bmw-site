// Optional password protection for the whole site.
//
// The site has logins and passwords on it, so by default it asks for a
// shared team password. Set it in Vercel:
//   Project → Settings → Environment Variables → add  SITE_PASSWORD = <your password>
// then redeploy. Anyone can type any username; only the password is checked.
//
// To make the site fully open (no password), just don't set SITE_PASSWORD.
import { next } from '@vercel/functions';

export default function middleware(request) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return next();

  const header = request.headers.get('authorization') || '';
  if (header.startsWith('Basic ')) {
    try {
      const decoded = atob(header.slice(6));
      const given = decoded.slice(decoded.indexOf(':') + 1);
      if (given === password) return next();
    } catch (e) { /* fall through to the login prompt */ }
  }

  return new Response('Password required', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="BMW & MINI of Manhattan guide", charset="UTF-8"' },
  });
}

export const config = { matcher: '/:path*' };
