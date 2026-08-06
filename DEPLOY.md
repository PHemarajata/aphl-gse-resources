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

## Running the admin panel

Open `public/admin.html` from your own clone. It already writes files directly
through the browser's directory picker (`showDirectoryPicker`), so it works
against a working copy with no hosting and no login.

Keeping it off the public internet removes the Firebase Auth surface entirely.
The AI intake endpoints still live on Firebase and still authenticate against
the Firebase project — see `ADMIN-AUTH.md`, and note the environment variables
there still need setting.

## Firebase

Untouched by this change. `aphlgseresources.web.app` continues to serve
whatever was last deployed with the Firebase CLI, including the admin panel.

Once the Pages site is confirmed working, the sensible follow-up is to point
Firebase Hosting at it with a redirect so the old URL keeps resolving. That is
deliberately not done in the same change: if the redirect went live before
Pages did, the site would break.

## The data file

`public/resources-data.js` is generated from `data/` by
`scripts/build-data.mjs`. Both the pull request check and the deploy job verify
the committed artifact matches its source, so a forgotten rebuild fails before
it can reach the site. See `data/README.md`.
