# Material Passport

Track your WikiHouse blocks all the way home!


## Setup

First, clone the repo and run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.


## Deployment

...


## Structure

- Components which are used in one place only are co-located with the relevant `layout` or `page`. Components which are re-used multiple times / are more generic are in `src/components`. Shadcn library components (which are mostly untouched since installation) are in `src/components/ui`.


## Notes and design decisions

- I had an issue which took several days to fix, to do with `pdfkit` trying to access files it needs to initiate (e.g. the `Helvetica.afm` font), but which Next was not bundling. This meant attempts to generate pdfs would fail. I first fixed this on local with the code in `src/lib/hacks.ts`, then with a more elegant solution involving custom Webpack config, but neither of these solutions translated to the production/Vercel build. _Finally_, I stumbled on the `serverExternalPackages` config option, which solves it everywhere in one line!
- Component UIDs have a 6 digit counter, so won't overflow until 100,000 exist, while the history UIDs have a 7 digit counter, which allows for 1mn records - i.e. 10 records per component - before we'd need to adapt them.
