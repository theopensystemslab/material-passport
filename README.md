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

- If trying to run the `sync-orders` script on local, make sure to use webpack instead of turbopack (`pnpm devv`), else you will run into an issue with the bundler being able to locate the pdfkit assets, which we copy across at runtime (not the ideal solution). The alternative is just to build the full application (`pnpm build`, `pnpm start`), which works fine. 
- 
