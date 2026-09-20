# Seed content

`content.json` is a dump of the content built on the development instance, and
`uploads/` holds the original files it points at. Together they are the
starting point production is filled with.

The dump leaves out everything visitors write: contact, registration, partner
and volunteer submissions, and the sheet sync log. Production starts with an
empty inbox.

## Refreshing the dump

```bash
npm run export:content        # docker exec strapi_app node scripts/export-content.js
```

Writes `content.json` and copies the referenced originals into `uploads/`.
Derived image sizes (`thumbnail_`, `small_`, `medium_`, `large_`) are left out;
Strapi regenerates them on upload. Commit both the json and the files.

## Loading it

```bash
npm run seed:from-export      # docker exec strapi_app node scripts/seed-from-export.js
```

On the production host, run the same script inside the running container:

```bash
docker exec strapi_app node scripts/seed-from-export.js
```

It is safe to re-run. Nothing is deleted, and nothing already there is
replaced:

- collection documents are matched on their natural key fields (slug, name,
  title, date) and skipped when a match exists;
- a collection whose documents share natural keys, such as three calendar
  entries all titled "Vacanta scolara", is seeded only while it is still empty;
- single types are filled only when missing. Add `--overwrite-singles` to
  replace the ones that already hold content, which is a destructive action:
  it discards whatever an editor typed on the target;
- media is matched on file name and reused rather than uploaded twice;
- relations are written in a second pass, so the order in the dump is free.

## What was in the dump last time it was taken

87 documents and 12 files: 43 articles, 11 calendar entries, 9 athletes, 4
history milestones, 2 team members, 2 sheet links, 1 discipline, 1 blackout,
and the 14 single types that hold the page content.
