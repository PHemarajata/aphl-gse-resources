# Genomic Epidemiology Resources Portal — User & Admin Guide

This guide covers:
- How visitors use the public resource portal.
- How curators use the Admin Panel for data curation, validation, versioning, and publishing/export.

---

## 1) Public user guide (for all visitors)

### 1.1 Open the portal
1. Navigate to the website home page (`index.html` in this project).
2. Use the search bar to search by keywords in title, description, organization, and topics.
3. Use audience filters to narrow results:
   - Laboratorians
   - Epidemiologists
   - Bioinformaticians
   - Policymakers
4. Click **Show All** to clear audience filtering.

### 1.2 Browse resources
- Resource cards show title, organization, and key tags.
- Click a resource card to open full details in a modal.
- In the modal, use **Visit Resource** to open the source URL.
- If related resources are available, click them to navigate quickly.

### 1.3 Tips for efficient searching
- Combine audience filter + keyword search for best precision.
- Search by organization names (e.g., WHO, Africa CDC).
- Search topical terms such as `surveillance`, `bioinformatics`, `qms`, or `costing`.

---

## 2) Admin guide (for curation team)

## 2.1 What the admin panel does
The Admin Panel supports:
- Add, edit, and delete resources.
- Import/export data (TSV, JS, JSON import support; TSV/JSON export).
- Validate new/modified resources or all resources.
- Save updated database output.
- Track version history, compare versions, and rollback.

## 2.2 Admin dashboard explained
At the top of Admin:
- **Database Resources**: baseline count.
- **Validated**: resources marked validated.
- **Imported/New**: resources added/modified in current session.
- **Need Validation**: new/modified resources not yet validated.
- **Unsaved**: resources with unsaved session changes.
- **Last Updated**: date of last saved database metadata update.

Alerts appear when there are unsaved changes or pending validations.

## 2.3 Add a new resource (manual curation)
1. Click **New** (or clear the form).
2. Fill required fields:
   - Resource ID (kebab-case, lowercase)
   - Organization
   - Title
   - Description
   - URL (HTTPS recommended)
3. Select at least one item in each required category:
   - Audiences
   - Stages
   - Types
   - Geography
   - Topics
4. Optionally add:
   - Key Features (one per line)
   - Practical Use
   - Related Resource IDs
5. Click **Save Resource**.

### ID conventions (important)
Use IDs like: `who-global-strategy`.
- Lowercase only
- Numbers allowed
- Hyphens allowed
- No spaces, underscores, or special characters

## 2.4 Edit or delete a resource
- Use the right-side **Existing Resources** list.
- Search by title/org/ID.
- Click **Edit** to load a record into the form, modify it, then save.
- Click **Delete** to remove a resource.

## 2.5 Import data safely
Admin supports multiple import types via file picker:
- **Import TSV**
- **Import JS (resources-data.js)**
- **Import JSON**

### Import modes
- **Append** (default): merges incoming data with existing session data.
- **Replace All**: replaces current session dataset with imported file.
- **Overwrite duplicates by ID**: when enabled, incoming record replaces existing ID.

### Recommended import order
1. Backup/export current data first.
2. Import file in **Append** mode.
3. Validate new/modified resources.
4. Review validation report.
5. Save database output.

## 2.6 Validation workflow
Validation can be run in two ways:
- **Validate New/Modified Resources**
- **Validate All Resources**

Validation checks include:
- Required fields and arrays
- ID format and URL pattern checks
- Enum/category values
- Duplicate IDs
- Basic quality warnings (e.g., missing practicalUse, empty keyFeatures)

### Understanding validation outcomes
- **Critical issues**: must be fixed before production save/publish.
- **Warnings**: recommended fixes for quality and consistency.

Use downloaded validation JSON reports for audit trail and review.

## 2.7 Save and versioning workflow
Before saving:
1. Enter **Saved By** (email or curator identifier).
2. Ensure validation has been run and critical issues are resolved.
3. Click **Save to Database**.

On save, the app creates:
- Updated `resourcesDatabase` payload with metadata.
- Backup output file.
- Version history entry with summary metrics.

Version history includes immutable snapshots with:
- Version ID
- Timestamp
- Editor identity
- Added/updated/deleted summary
- Validation statistics

## 2.8 Compare versions
Use **Compare Versions**:
1. Select Version A and Version B.
2. Click **Compare Metadata**.
3. Review differences in saved metadata and summary fields.

Use this during QA sign-off before publishing externally.

## 2.9 Rollback procedure
If a bad import or bad save occurs:
1. Open **Version History**.
2. Identify last known-good version.
3. Run rollback action for that version.
4. Validate all resources post-rollback.
5. Save again with rollback reason in your internal change log.

## 2.10 Curation SOP (recommended)
For each curation cycle:
1. **Plan**: define scope (new resources, edits, deprecations).
2. **Curate**: add/edit/delete entries.
3. **Validate**: run New/Modified validation first, then full validation for release candidates.
4. **Review**: check warnings, check link accessibility, check related IDs.
5. **Save**: enter curator identity and save.
6. **Version QA**: compare with previous version.
7. **Publish**: publish via your deployment path.
8. **Archive**: keep validation report and release notes.

## 2.11 Admin auth note
The repository contains Firebase auth scaffolding intended for protected publishing. Ensure your deployment config provides:
- valid Firebase app config
- allowed admin user policy
- secured publish endpoint token verification

Do not rely on client-side allowlists alone for security.

### Firebase Google auth setup checklist
1. Enable **Google** sign-in provider in Firebase Authentication.
2. Configure Firebase web config and inject it at runtime as `window.__FIREBASE_CONFIG__`.
3. If auth status shows *not configured*, click **Configure Auth** in Admin and paste Firebase Web Config JSON (stored locally in browser).
4. Configure `window.__ADMIN_AUTH_POLICY__` in deployment config:
   - `allowedDomains: []`
   - `allowedEmails: []`
   - `allowDomainOrEmailFallback: false` (recommended default).
5. Enforce server-side token verification for `/api/saveResources`.
6. Prefer custom claims (e.g., `admin: true`) for long-term authorization control.

---

## 3) Data standards for curators

### 3.1 Required data model
Each resource should include:
- `id`
- `title`
- `organization`
- `description`
- `url`
- `audiences[]`
- `stages[]`
- `types[]`
- `geography[]`
- `topics[]`

Optional but recommended:
- `keyFeatures[]`
- `practicalUse`
- `relatedResources[]`

### 3.2 Controlled vocabulary
Use only approved enum values for categorical arrays to avoid drift and broken filters.

### 3.3 Content quality checklist
Before release, confirm:
- Description is specific and practical.
- URL is current and reachable.
- At least one key feature included.
- Practical use text is present and clear.
- Related resource IDs actually exist.

---

## 4) Troubleshooting

### Issue: Import succeeded but many fields look misaligned
- Cause: malformed TSV columns or inconsistent delimiters.
- Fix: verify header order and delimiter usage; re-import using validated template.

### Issue: Validation reports many enum errors
- Cause: non-standard category values.
- Fix: normalize values to approved vocabulary; re-run validation.

### Issue: Resource does not appear in expected audience filter
- Cause: incorrect `audiences` values or missing required array values.
- Fix: edit record and reassign correct audience categories.

### Issue: Save completed but publish did not update live site
- Cause: save/export is local workflow; publish may require separate authenticated backend action.
- Fix: verify publish endpoint + auth + deployment integration.

### Issue: Sign-in failed with `auth/configuration-not-found`
- Cause: Firebase Authentication is not fully enabled/configured for the same project as your Web config.
- Fix:
  1. In Firebase Console, enable **Authentication** for the project.
  2. Under **Authentication → Sign-in method**, enable **Google** provider.
  3. Under **Authentication → Settings → Authorized domains**, add your hosting domain.
  4. Re-check `apiKey`, `authDomain`, `projectId`, and `appId` in Configure Auth.

---

## 5) Operational best practices
- Run full validation before every production release.
- Preserve exported backups and validation reports per release.
- Require peer review for high-impact edits.
- Use clear change notes in your release process.
- Limit admin access and rotate credentials periodically.

---

## 6) Quick start (one-page summary)
1. Open Admin.
2. Import (or edit) data.
3. Validate New/Modified.
4. Fix critical issues.
5. Validate All.
6. Enter Saved By.
7. Save to database.
8. Compare against prior version.
9. Publish and archive reports.
