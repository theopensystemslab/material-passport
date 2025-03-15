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


## Notes

- I had an issue which took several days to fix, to do with `pdfkit` trying to access files it needs to initiate (e.g. the `Helvetica.afm` font), but which Next was not bundling. This meant attempts to generate pdfs would fail. I first fixed this on local with the code in `src/lib/hacks.ts`, then with a more elegant solution involving custom Webpack config, but neither of these solutions translated to the production/Vercel build. _Finally_, I stumbled on the `serverExternalPackages` config option, which solves it everywhere in one line!
