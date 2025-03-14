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


## Important notes

- If trying to run the pdf generation logic on local (e.g. hitting `generate-pdf`), make sure to use webpack instead of turbopack (`pnpm devv`), else you will run into an issue with the bundler being unable to locate the pdfkit assets, which we copy across via a webpack plugin. The alternative is just to build the full application (`pnpm build`, `pnpm start`), which also works. 
- 
