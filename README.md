# Material Passport

Track your WikiHouse blocks all the way home!


## Setup

Clone the repo, install packages with `pnpm i`, and run the development server with `pnpm dev`.

Then navigate to [http://localhost:3000](http://localhost:3000) in your browser. Voilà!

Development was done with Node 22 LTS (`22.14.0` specifically) and latest pnpm (`10.6.3`), as per the `package.json`.


## Deployment

Vercel deploys every PR as a 'preview' environment, to addresses like `material-passport-xxx-open-systems-labs-projects.vercel.app`. These function as our development/test environments.

Similarly, `main` is deployed to [`material-passport.vercel.app`](https://material-passport.vercel.app/) - this is our 'staging' environment.

Finally, `production` deploys to the site proper, at [`wikihouse.materialpassport.info`](https://wikihouse.materialpassport.info/).

So to push latest changes from staging to prod, we can run something like this:

```bash
git checkout main
git pull
git branch -f production
git push origin production
```


## Maintaining the Airtable schema

The use of Airtable as a backend/db lends great flexibility but also brings possible instability - e.g. a column name change could crash the app. In order to make the app as robust as possible, we keep our own [schema](./src/lib/schema.ts) (in the form TypeScript interfaces etc) in the codebase. This allows us to query the airtable API using table, field and record IDs, which are invariable, rather than names.

However, this schema needs to be maintained against the state of the Airtable base. Especially after structural changes, we should run `./scripts/generate-types.ts` to renew the schema file, and then carefully pick the changes that make sense via `git add -p`.


## Notes on structure and design decisions

- Components which are used in one place only are co-located with the relevant `layout` or `page`. Components which are re-used multiple times / are more generic are in `src/components`. Shadcn library components (which are mostly untouched since installation) are in `src/components/ui`.

- I had an issue which took several days to fix, to do with `pdfkit` trying to access files it needs to initiate (e.g. the `Helvetica.afm` font), but which Next was not bundling. This meant attempts to generate pdfs would fail. I first fixed this on local with the code in `src/lib/hacks.ts`, then with a more elegant solution involving custom Webpack config, but neither of these solutions translated to the production/Vercel build. _Finally_, I stumbled on the `serverExternalPackages` config option, which solves it everywhere in one line!

- Component UIDs have a 6 digit serial number / counter, so won't overflow until 100,000 exist, while the history UIDs have 7 digits, which allows for 1mn records - i.e. 10 records per component - before we'd need to extend this system.

- Caching and revalidation! Explain!
