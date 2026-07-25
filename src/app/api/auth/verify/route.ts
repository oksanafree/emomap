import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie";

// Called by middleware (Edge runtime) to check the session cookie, since
// firebase-admin needs Node.js APIs and can't run in Edge middleware directly.
export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  try {
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    if (decoded.firebase.sign_in_provider === "anonymous") {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({ authenticated: true });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
