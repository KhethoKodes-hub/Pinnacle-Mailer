import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized: ({ token }) => Boolean(token?.accessToken),
  },
});

export const config = {
  matcher: ['/admin/:path*'],
};
