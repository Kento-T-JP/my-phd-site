import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const cookies = req.cookies
    .getAll()
    .filter((cookie) => cookie.name.includes('next-auth'))
    .map((cookie) => ({
      name: cookie.name,
      value: cookie.value,
    }));

  return NextResponse.json({
    token,
    cookies,
  });
}
