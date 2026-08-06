# Admin authorization

> **Status: mostly historical.** The browser admin panel was retired — see
> `CONTRIBUTING.md`. `public/admin-auth.js`, `admin.html`, `admin.js` and
> `validation.js` no longer exist, so the client-side layer this document
> described is gone with them.
>
> What remains is the server side, and even that is now unreferenced.

## What is left

`functions/index.js` still exposes `categorizeResource`, `aiHealth` and
`saveResources`, guarded by `requireAdmin()`. **Nothing in the repository calls
them any more** — the admin panel was their only caller, and AI drafting has
moved to `.github/workflows/ai-draft.yml`, which talks to OpenAI directly and
opens a pull request.

That leaves two sensible options:

**Delete the functions.** They are dead code with a billing surface —
`categorizeResource` spends OpenAI credit and is reachable by anyone who can
obtain a Firebase token for the project. If the GitHub Action covers your AI
intake, deleting them removes the exposure entirely.

**Or keep them and lock them down.** Set both environment variables on the
deployed functions:

    ADMIN_ALLOWED_DOMAINS=aphl.org
    ADMIN_ALLOWED_EMAILS=someone@example.org

Either is sufficient; set at least one. Check the current values in the Google
Cloud console — they are not in the repo, so a checkout cannot tell you whether
this is done.

## Both layers were fixed before retirement

Until 2026-08-05 both **failed open**. The browser layer returned `true` for any
signed-in account when no policy was configured, and no policy was ever
configured — `window.__ADMIN_AUTH_POLICY__` appeared nowhere except the line
that read it. The server did the same whenever the two environment variables
were unset, which left the OpenAI-backed endpoint open to any Google account.

Both were changed to deny by default. The server still does. If you deploy the
functions without setting the variables, the endpoints return 401 with
`Server authorization is not configured` rather than quietly serving anyone.

A Firebase custom claim of `{ admin: true }` still authorizes unconditionally,
as the recovery path.

Domain comparison is exact rather than `endsWith`, and tokens with
`email_verified: false` are rejected.
