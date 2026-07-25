import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "@/lib/session-cookie";

export async function POST(request: NextRequest) {
  let idToken: string | undefined;
  try {
    const body = await request.json();
    idToken = body.idToken;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!idToken) {
    return NextResponse.json({ error: "idToken is required." }, { status: 400 });
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(idToken);
    if (decoded.firebase.sign_in_provider === "anonymous") {
      return NextResponse.json({ error: "Anonymous sessions are not allowed." }, { status: 403 });
    }

    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_MS / 1000,
    });
    return response;
  } catch (error) {
    console.error("Failed to create session cookie", error);
    return NextResponse.json({ error: "Could not create session." }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
