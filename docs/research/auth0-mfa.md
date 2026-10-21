# Research spike: two-factor authentication with Auth0

**Status:** research only. Nothing in this document is implemented. It's input for a follow-up plan.
**Checked against:** `@auth0/nextjs-auth0` 4.27.0 (installed), Auth0 docs and pricing page, October 2026.

## Recommendation

Use **opt-in, per-user MFA** driven by a Post-Login Action, offering **OTP authenticator apps and WebAuthn (passkeys or security keys)**, plus **recovery codes**. Skip SMS.

- It needs a paid plan. The Free plan includes no MFA factors, and Essentials (from $35/month) is the cheapest plan that does. This is the deciding constraint: confirm the tenant's plan before any build work.
- Opt-in keeps sign-in unchanged for users who don't want 2FA. Tenant-wide "Always" would force every learner to enroll at their next login.
- OTP and WebAuthn have no per-message cost. SMS adds Twilio or another provider, per-message fees and SIM-swap risk.
- Before building, change `beforeSessionSaved` in `src/lib/auth0.js` to keep the `amr` claim. Without it, the app can't tell that MFA happened, which step-up needs.

## 1. Factors and plan cost

| Factor | Notes |
|---|---|
| One-time passwords (Google Authenticator, Guardian, 1Password…) | No per-use cost. A good default. |
| WebAuthn: device biometrics (Touch ID, Face ID, Windows Hello) | The best user experience on phones and laptops. |
| WebAuthn: security keys (YubiKey) | For users who have one. |
| Email codes | Users must also enroll in another factor, so email can't be the only one. |
| SMS / voice | Needs a messaging provider and has per-message cost. SIM-swap risk. |
| Push (Auth0 Guardian app) | Needs the Guardian app. |
| Recovery codes | Let users get back in without their device. Offer them alongside any factor. |

**Plans (B2C):**
- **Free:** up to 25,000 monthly active users and $0, but **no MFA factors**. Passkeys are available as a *login* method, which is a separate feature from MFA.
- **Essentials:** from $35/month. Includes MFA factors.
- **Professional:** from $240/month.
- **Adaptive (risk-based) MFA:** an Enterprise add-on only.

The pricing page's highlights and its feature table disagree on whether Essentials includes "Enterprise MFA" factors. Confirm in the tenant dashboard or with Auth0.

## 2. Policy model

| Option | How it works | Fit |
|---|---|---|
| Tenant-wide **Always** | Every login requires MFA. | Too heavy for a learning app. Forces enrollment on everyone. |
| **Adaptive MFA** | Challenges only risky logins. | Enterprise add-on only. Out of budget. |
| **Opt-in per user** (recommended) | A Post-Login Action challenges only users with `app_metadata.mfa_enabled === true`. | Matches the "Enable 2FA" toggle idea. |

Opt-in Action sketch (not deployed):

```js
exports.onExecutePostLogin = async (event, api) => {
  if (!event.user.app_metadata?.mfa_enabled) return;

  const enrolled = event.user.enrolledFactors ?? [];
  if (enrolled.length > 0) {
    api.authentication.challengeWithAny(enrolled.map((f) => ({ type: f.type })));
  } else {
    api.authentication.enrollWithAny([{ type: "otp" }, { type: "webauthn-platform" }]);
  }
};
```

Tenant prerequisites, from Auth0's "Customize MFA selection" docs:
- Turn on **Security → Multi-factor Auth → Additional Settings → Customize MFA Factors using Actions**. Flows don't work properly without it.
- Enable the chosen factors in the tenant.
- Use Universal Login. Actions-based MFA doesn't work with Classic Login.
- One login flow can run at most **four** `challengeWith*` / `enrollWith*` commands.
- `event.user.enrolledFactors[].type` values include `otp`, `email`, `phone`, `push-notification`, `webauthn-platform` and `webauthn-roaming`.

Check the exact `enrollWithAny` signature against the Post-Login API reference when building. The guide names it but doesn't document its signature.

## 3. Enrollment UX

- **Enroll:** the user flips the toggle in `/dashboard/account`. The server sets `app_metadata.mfa_enabled = true`, and Universal Login runs enrollment on the next login. To skip waiting, the app can send the user straight through `/auth/login?returnTo=/dashboard/account` right after they flip the toggle.
- **Unenroll:** set the flag back to false, and optionally delete the user's authenticators through the Management API's authentication-methods endpoints, so they don't linger.
- **Recovery:** enable recovery codes. Auth0 shows one during enrollment. A "lost my device" path still needs support to reset factors through the Management API. Write that runbook before launch.

## 4. Fit with the existing Post-Login Action

- The tenant already has an Action that sets `https://speak-with-video.app/roles`. Put the MFA Action **after** it in the Login flow. The roles Action doesn't depend on MFA, and the MFA challenge then runs last.
- Results of a challenge show up in `event.authentication.methods` only in the *next* Action, which is another reason to keep MFA last.
- **Needed app change:** `src/lib/auth0.js` passes the ID token through `filterDefaultIdTokenClaims`. Its allow-list (`sub`, `name`, `email`, `org_id`, …) **drops `amr`**. To let the app see that MFA happened, keep `amr` the same way `ROLES_CLAIM` is kept today. When MFA ran, Auth0 sets `amr` to include `"mfa"`.

## 5. Step-up for sensitive actions

The installed SDK supports this:

- The `/auth/login` route passes extra query parameters through as authorization parameters. Every parameter except `returnTo` becomes one, per the login handler in `auth-client.js`. So step-up is a redirect to:
  `/auth/login?acr_values=http://schemas.openid.net/pape/policies/2007/06/multi-factor&returnTo=/dashboard/account`
- On the server, `auth0.startInteractiveLogin({ authorizationParameters: { acr_values }, returnTo })` does the same, using `StartInteractiveLoginOptions` in `types/authorize.d.ts`.
- The Action should treat that `acr_values` request as "challenge now", even for users who haven't opted in, provided they're enrolled.
- The protected route then checks `session.user.amr?.includes("mfa")` together with a recent `auth_time`. That check depends on the `amr` change in §4.
- v4 also exposes `MfaRequiredError` and an `auth0.mfa` client (`getAuthenticators`, `challenge`, `verify`) for access-token step-up. This app doesn't call APIs with access tokens, so the redirect approach is enough.

This would make the in-app password form (option B in the admin panel plan) safer to revisit later.

## 6. What a dashboard "Enable 2FA" toggle would need

- A **machine-to-machine app** with Management API scopes:
  - `update:users_app_metadata` to set `mfa_enabled`.
  - `read:authentication_methods` and `delete:authentication_methods` to list and remove enrolled factors when users opt out.
- New secrets: `AUTH0_M2M_CLIENT_ID` and `AUTH0_M2M_CLIENT_SECRET`, kept server-side only.
- `POST /api/account/mfa` with `{ enabled }`, guarded by `requireSession()` and rate-limited. Turning MFA **off** should require a fresh step-up (§5), so a stolen session can't disable it.
- UI: the toggle, the enrolled factors list, and the recovery-code reminder.
- The Post-Login Action from §2, and the `amr` change from §4.

## Sources

- [Customize MFA selection for Universal Login (Auth0 docs)](https://auth0.com/docs/secure/multi-factor-authentication/customize-mfa/customize-mfa-selection-universal-login)
- [Customize MFA enrollments for Universal Login (Auth0 docs)](https://auth0.com/docs/ja-jp/secure/multi-factor-authentication/customize-mfa/customize-mfa-enrollments-universal-login)
- [Post-Login trigger (Auth0 docs)](https://auth0.com/docs/customize/actions/explore-triggers/post-login)
- [Multi-factor authentication factors (Auth0 docs)](https://auth0.com/docs/secure/multi-factor-authentication/multi-factor-authentication-factors)
- [Auth0 pricing](https://auth0.com/pricing)
- Installed SDK: `node_modules/@auth0/nextjs-auth0` 4.27.0 (`types/authorize.d.ts`, `server/client.d.ts`, `server/user.js`, `server/auth-client.js`)
