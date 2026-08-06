# Deployment

The public site is published to GitHub Pages by
`.github/workflows/deploy.yml` on every merge to `main`.

**Merging a pull request is publishing.** That is the point of the move: the
previous arrangement required a maintainer with the Firebase CLI and a local
checkout for every change, which was the real bottleneck rather than the
editing UI.

## One-time setup

Pages must be enabled once, by hand: **Settings → Pages → Build and
deployment → Source: GitHub Actions**. The workflow cannot do this for you.
Until it is set, the deploy job will fail with a message about Pages not being
enabled.

## What gets published

    index.html
    404.html
    taxonomy.js
    resources-data.js
    APHL_long_white_transparent-background.png

About 200 KB in total. The workflow copies `public/` wholesale and then removes
what must not be public, rather than copying an allow-list — so a new public
asset ships automatically instead of being silently dropped.

## What does not get published

    admin.html
    admin.js
    admin-auth.js
    validation.js
    gpt-json-import-prompt.txt

The admin panel is deliberately absent from the public site. A copy-then-delete
assembly is one typo away from shipping it, so the workflow asserts afterwards
that none of those files reached the output and fails the build if any did.

## Curating

There is no admin panel. It was retired because it wrote
`public/resources-data.js` directly and knew nothing about `data/`, so any edit
made through it was either rejected by CI or silently destroyed by the next
build. See `CONTRIBUTING.md` for how curation works now.

The removals above are therefore normally no-ops, kept as a safety net in case a
browser editor is ever reintroduced under `public/`.

## There is no server side

The Cloud Functions were deleted along with the admin panel that was their only
caller. `categorizeResource` spent OpenAI credit and was reachable by anyone
holding a Firebase token for the project; AI drafting now runs in
`.github/workflows/ai-draft.yml` instead, against a repository secret, and
produces a reviewable pull request.

`firebase.json` keeps only its hosting block. `aphlgseresources.web.app` still
serves whatever was last deployed there and is now stale; it was never
advertised, so it is being left to lapse rather than redirected. If that ever
changes, add a redirect to the Pages URL — but only after confirming Pages is
healthy, or the site breaks.

## The data file

`public/resources-data.js` is generated from `data/` by
`scripts/build-data.mjs`. Both the pull request check and the deploy job verify
the committed artifact matches its source, so a forgotten rebuild fails before
it can reach the site. See `data/README.md`.
