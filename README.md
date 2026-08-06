<p align="center">
  <img src="assets/readme-banner.png" alt="APHL Global Health — Genomic Epidemiology Resources" width="100%" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/APHL-Global_Health-00A0AF?style=flat-square&labelColor=006E79" alt="APHL Global Health" />
  <img src="https://img.shields.io/badge/Hosting-GitHub_Pages-181717?style=flat-square&labelColor=404040" alt="GitHub Pages" />
  <img src="https://img.shields.io/badge/Status-Active-68BD49?style=flat-square&labelColor=404040" alt="Status: Active" />
  <img src="https://img.shields.io/badge/Curation-Pull_requests-00A0AF?style=flat-square&labelColor=404040" alt="Curation: Pull requests" />
</p>

<p align="center">
  <a href="https://phemarajata.github.io/aphl-gse-resources/">
    <img src="https://img.shields.io/badge/%E2%86%92%20Visit%20the%20Resource-phemarajata.github.io-00A0AF?style=for-the-badge&labelColor=006E79" alt="Visit the resource" height="42" />
  </a>
</p>

<p align="center">
  <sub>Live site: <a href="https://phemarajata.github.io/aphl-gse-resources/"><b>https://phemarajata.github.io/aphl-gse-resources/</b></a></sub>
</p>

---

## Overview

A curated, faceted library of genomic epidemiology resources for public health
laboratories, with an emphasis on lower-resource settings.

The site is a static page. There is no server, no database and no login. A
resource is a small JSON file in `data/`, and changing one is a pull request.

## How it works

    data/resources/<id>.json   one file per resource — the source of truth
    data/order.json            display order (the site renders in array order)
    data/metadata.json         version and validation metadata
    data/resource.schema.json  generated from the taxonomy; drives editor autocomplete
    public/taxonomy.js         every controlled vocabulary, in one place
    public/resources-data.js   BUILD ARTIFACT — never edit by hand

`scripts/build-data.mjs` compiles `data/` into `public/resources-data.js`.
Everything is zero-dependency: the build, the schema generator and the
validator all run on plain `node`, with no install step.

## Curating

See **[CONTRIBUTING.md](CONTRIBUTING.md)** — how to add and edit a resource,
what each facet means, and the tagging discipline that keeps filtering useful.

    npm run new -- some-resource-id   scaffold a record
    npm run validate                  drift checks + full validation

Open a record in an editor that understands JSON Schema and every vocabulary
field autocompletes, with invalid values underlined as you type.

No Git? Open an issue with the **Suggest a resource** template instead.

## Publishing

See **[DEPLOY.md](DEPLOY.md)**. Short version: merging a pull request to `main`
publishes the site. Every pull request is checked automatically for data-file
drift, schema drift, and taxonomy validity, and `main` is protected so nothing
reaches the site without passing.

The admin panel and Cloud Functions that predated this were removed — the panel
wrote the generated file directly and would have had its work silently
overwritten by the next build.

## Automation

| Workflow | What it does |
| :--- | :--- |
| `validate.yml` | Three gates on every pull request |
| `deploy.yml` | Publishes to GitHub Pages on merge |
| `link-check.yml` | Weekly sweep of every resource URL; opens one issue with what broke |
| `ai-draft.yml` | Drafts a record from a URL and opens a pull request for review |

`ai-draft.yml` needs an `OPENAI_API_KEY` repository secret. Values the model
invents are filtered against the real vocabulary before anything is written.

## Data quality

`npm run validate` must pass before a change can merge. It checks that the
committed data file matches its source, that the schema matches the taxonomy,
and that every record's facet values exist in the vocabulary.

Warnings that do not block, but are worth heeding: a resource carrying more
tags than the facet's recommended cap. A tag on most of the collection filters
nothing — see the tagging section of CONTRIBUTING.md for why that matters here.
