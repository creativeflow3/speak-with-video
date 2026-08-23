import { Auth0Client, filterDefaultIdTokenClaims } from "@auth0/nextjs-auth0/server";

// Populated by a Post-Login Action in the Auth0 tenant (roles aren't in the ID token by default).
export const ROLES_CLAIM = "https://speak-with-video.app/roles";

export const auth0 = new Auth0Client({
  // Without this, the SDK silently drops any non-standard ID token claim
  // (including ROLES_CLAIM) before persisting the session.
  async beforeSessionSaved(session) {
    return {
      ...session,
      user: {
        ...filterDefaultIdTokenClaims(session.user),
        [ROLES_CLAIM]: session.user[ROLES_CLAIM],
      },
    };
  },
});
