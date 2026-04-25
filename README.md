# APHL Global Health Genomic Epidemiology Resources

Public resource portal and curator admin tools for APHL Global Health genomic epidemiology resources.

The site is hosted on Firebase Hosting. Resource data currently lives in `public/resources-data.js`, with validation and admin tools to help curators add, review, and export updates.

## Public Site

- Browse and search genomic epidemiology resources.
- Filter by audience, stage, resource type, geography, topics, and pathogen focus.
- Open resource details and source links from the public browser.

## Curator Access

Admin access is granted by the APHL Global Health system administrator and uses a Google credential. This repository intentionally does not publish administrator contact details, private email addresses, API keys, or deployment credentials.

Curators normally do **not** need Firebase CLI access or deployment permissions. The recommended workflow is:

1. Request admin access from the APHL Global Health system administrator using the Google account you will use for curation.
2. Open the hosted admin panel.
3. Sign in with Google.
4. Add, edit, batch import, or AI-assisted import resources.
5. Run validation for new/modified resources, then full validation for release candidates.
6. Use **Save Review File** or export JSON/JS to create a reviewable data file.
7. Send the exported file or change request to the maintainer for review and live deployment.

The admin panel records version/audit metadata. If the **Saved By** field is blank, it defaults to the signed-in Google email.

## AI-Assisted Intake

Curators with an OpenAI API key can use the built-in AI Intake panel.

- The OpenAI key is used only for the browser session.
- The key is not saved in the repository, Firebase config, local storage, or exported resource data.
- Single URL and batch URL intake still require curator review before saving.

Curators without an API key can download **GPT JSON Import Prompt** from the admin panel, paste it into GPT, and import the generated `.json` file through **Import JSON**.

## Data Quality Rules

Before sending changes for deployment:

- Run validation and fix all blocking errors.
- Review warnings and fix them when they indicate real data quality issues.
- Keep `id` values lowercase kebab-case.
- Use only controlled taxonomy values.
- Keep `relatedResources` limited to internal resource IDs selected from the admin picker.
- Do not place URLs, citations, or free text in `relatedResources`.
- For journal articles, use the article title as `title` and put authors/journal in `organization` or `formatDetails`.

## Maintainer Setup

Maintainers who publish live changes need repository and Firebase project access.

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd aphl-gse-resources
   ```

2. Install Firebase CLI if needed:

   ```bash
   npm install -g firebase-tools
   firebase login
   ```

3. Confirm the Firebase project:

   ```bash
   firebase use aphlgseresources
   ```

4. Install Cloud Functions dependencies:

   ```bash
   cd functions
   npm install
   cd ..
   ```

5. Validate resources:

   ```bash
   node scripts/validate-resources.mjs
   ```

6. Deploy static site/data changes:

   ```bash
   firebase deploy --only hosting --project aphlgseresources
   ```

7. Deploy function changes when AI intake or admin endpoints change:

   ```bash
   firebase deploy --only functions,hosting --project aphlgseresources
   ```

## Review And Release Checklist

Before committing or deploying:

- `node scripts/validate-resources.mjs` passes.
- Syntax checks pass for changed JavaScript files, for example:

  ```bash
  node --check public/admin.js
  node --check public/admin-auth.js
  node --check functions/index.js
  ```

- Review the `resources-data.js` diff for accidental field swaps, duplicates, or AI-generated citation clutter.
- Confirm no API keys, private credentials, or personal administrator contact details are committed.
- Commit the code/data changes after the live workflow is confirmed.

## Troubleshooting

- **Admin says auth is not configured**: use **Configure Auth**, then **Use Hosting Config**, then sign in again.
- **Signed in but not authorized**: request admin access from the APHL Global Health system administrator using the same Google account.
- **AI intake says no OpenAI key**: paste a key and click **Use for Session** or **Test**. The key clears on refresh/logout.
- **AI intake times out**: paste an abstract or source summary into **Optional context** and retry.
- **Generated JSON import fails**: ensure GPT returned raw JSON only, with no markdown/code fences, and that the file is a JSON array or an object with a `resources` array.
- **Save did not update the live site**: curator save/export creates a review file. A maintainer still needs to deploy Hosting.

## Security Notes

- Do not commit API keys or Firebase private credentials.
- Firebase Web App config is not a secret, but deployment credentials and admin permissions are sensitive.
- Public documentation should refer curators to the APHL Global Health system administrator without listing personal contact details.
