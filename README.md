# Bhagavatam PPT Generator

A Next.js web app that turns Bhagavatam verse content into a downloadable PPTX deck.

## What it does

- Accepts separate inputs for:
  - verse
  - synonyms
  - translation
  - purport
- Automatically formats the content into a PowerPoint deck
- Splits long text into additional slides when needed
- Returns a `.pptx` file that can be opened in PowerPoint or imported into Google Slides

## Stack

- Next.js App Router
- TypeScript
- `pptxgenjs` for slide generation
- Vercel-ready deployment

## Local development

```bash
npm install
npm run dev
```

Then open the app in your browser and submit the form.

## Output flow

1. Fill the form on the home page.
2. Submit the form.
3. The server route generates the PPTX.
4. The browser downloads the deck automatically.

## Deployment notes

- Deploy the repository as a standard Next.js project on Vercel.
- No special backend is required beyond the `/api/generate-pptx` route.
- The generated file can be uploaded to Google Slides later if you want to edit it there.
