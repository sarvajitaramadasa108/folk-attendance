# Folk Attendance

Location-aware attendance kiosk and admin dashboard for the Folk attendance system.

## Routes

- `/mvp` public attendance page
- `/mvp/admin` admin dashboard
- `/anits` public attendance page
- `/anits/admin` admin dashboard

## Stack

- Next.js App Router
- MongoDB
- Vercel-ready deployment

## Setup

1. Copy `.env.example` to `.env.local`
2. Fill `MONGODB_URI`, `MONGODB_DB`, and `ADMIN_ACCESS_CODE`
3. Install dependencies and run the app

```bash
npm install
npm run dev
```

## Import existing workbook data

The repository includes an importer that maps the workbook structure into MongoDB.

```bash
npm run import:workbook -- "C:/Users/ASUS/Downloads/FOLK MVP.xlsx" mvp
```

## Vercel deploy notes

- Set `MONGODB_URI`
- Set `MONGODB_DB`
- Set `ADMIN_ACCESS_CODE`
- Deploy the repository as a Next.js app

