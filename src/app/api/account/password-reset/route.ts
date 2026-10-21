import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { hasDatabasePassword, requestPasswordChange } from "@/lib/auth0-account";
import { log, logRouteError } from "@/lib/logger";

export async function POST() {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  // The email always comes from the session, never the request body, so this can't reset someone else.
  if (!hasDatabasePassword(auth.auth0Sub) || !auth.email) {
    return NextResponse.json(
      { error: "Your password is managed by the service you sign in with." },
      { status: 400 },
    );
  }

  const limited = await checkRateLimit(auth.id, RATE_LIMITS.passwordReset);
  if (limited) return limited;

  try {
    await requestPasswordChange(auth.email);
    log("password_reset_requested", { userId: auth.id });
    return NextResponse.json({ sent: true });
  } catch (err) {
    logRouteError("POST /api/account/password-reset", err);
    return NextResponse.json(
      { error: "We couldn't send the email right now. Try again in a few minutes." },
      { status: 502 },
    );
  }
}
