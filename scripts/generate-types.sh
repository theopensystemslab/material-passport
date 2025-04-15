#!/usr/bin/env sh
# run to update schema.ts file with upstream Airtable changes, then do `git app -p` and keep desirable edits

pnpm dlx airtable-ts-codegen
cp "$AIRTABLE_BASE_ID.ts" src/lib/schema.ts
rm "$AIRTABLE_BASE_ID.ts"
