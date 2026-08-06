# Admin authorization

How access to the admin panel and the callable functions is controlled, and what
you must set for it to actually be closed.

## The two layers

**Browser (`public/admin-auth.js`)** — reads its allow-list from
`window.__ADMIN_AUTH_POLICY__`, which is defined in `public/admin.html` directly
above the `admin-auth.js` script tag. This layer only enables or disables the
admin UI controls. It is a convenience, not a security boundary: anyone can open
devtools and re-enable a button.

**Server (`functions/index.js`, `requireAdmin`)** — verifies the Firebase ID
token, then checks the caller against `ADMIN_ALLOWED_EMAILS` and
`ADMIN_ALLOWED_DOMAINS`. This is the layer that actually matters. It guards
`categorizeResource`, `aiHealth`, and `saveResources`.

`categorizeResource` spends OpenAI credit, so leaving the server layer
unconfigured is a billing exposure, not just a data one.

## What you must set

Browser side is already configured, in `public/admin.html`:

    window.__ADMIN_AUTH_POLICY__ = {
      allowedDomains: ['aphl.org'],
      allowedEmails: [],
      allowDomainOrEmailFallback: true,
      requireAdminClaim: false
    };

**Confirm `aphl.org` is the right domain** and add any individual collaborators
to `allowedEmails`.

Server side must be set on the deployed functions — these are environment
variables, so they are not in the repo and cannot be verified from a checkout:

    firebase functions:config:set ...        # or, for v2 functions:
    firebase deploy --only functions

with the environment carrying:

    ADMIN_ALLOWED_DOMAINS=aphl.org
    ADMIN_ALLOWED_EMAILS=someone@example.org,another@example.org
    ADMIN_REQUIRE_CLAIM=false

Either variable alone is enough; set at least one. Check the current deployed
values in the Google Cloud console under the function's runtime environment
variables before assuming this is done.

## Both layers now fail closed

Until 2026-08-05 both layers **failed open**. The browser layer returned `true`
for any signed-in account when no policy was configured — and no policy was ever
configured, because `window.__ADMIN_AUTH_POLICY__` appeared nowhere in the repo
except the line that read it. The server layer did the same whenever the two
environment variables were unset.

Both now deny by default and say why. The practical consequence: if you deploy
the functions without setting the environment variables, the AI endpoints will
return 401 with `Server authorization is not configured` rather than silently
serving anyone.

## Recovery

A Firebase custom claim of `{ admin: true }` authorizes unconditionally on both
layers, ignoring every list above. Use it if a misconfigured domain locks
everyone out:

    // one-off, from a trusted environment with admin credentials
    await admin.auth().setCustomUserClaims(uid, { admin: true });

The user must sign out and back in for a new claim to appear in their token.

## Notes

- `requireAdminClaim: true` (browser) or `ADMIN_REQUIRE_CLAIM=true` (server)
  ignores the allow-lists entirely and demands the custom claim. That is the
  tightest setting, and the right one if the curator group becomes small and
  stable.
- Domain comparison is exact, not `endsWith`. `evil.com@aphl.org` style local
  parts do not match.
- The server rejects tokens whose `email_verified` is explicitly `false`.
- The admin panel is no longer published to the public site. It is excluded
  from the GitHub Pages build and runs from a curator's own clone — see
  `DEPLOY.md`. That removes this browser-side layer from the public internet;
  the server-side allow-list above still matters, because the AI endpoints on
  Firebase remain reachable.
- `saveResources` returns 501 by design. Publishing now happens by merging to
  `main`, not from the admin panel.
