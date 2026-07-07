# Emomapp

Next.js 14 (App Router) app with EN/RU i18n via [next-intl](https://next-intl.dev), and Firebase (Firestore + Anonymous Auth).

## Getting started

1. Copy `.env.local.example` to `.env.local` and fill in your Firebase project's web config:

   ```bash
   cp .env.local.example .env.local
   ```

2. Install dependencies and run the dev server:

   ```bash
   npm install
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to `/en` (or `/ru` based on browser locale).

## Project structure

- `src/app/[locale]/` — localized routes (App Router), root layout wraps pages in `NextIntlClientProvider`
- `src/i18n/routing.ts` — supported locales (`en`, `ru`) and default locale
- `src/i18n/navigation.ts` — locale-aware `Link`, `useRouter`, `usePathname`
- `src/i18n/request.ts` — loads messages for the active locale
- `src/middleware.ts` — next-intl middleware for locale detection/routing
- `messages/en.json`, `messages/ru.json` — translation strings
- `src/lib/firebase.ts` — Firebase app/Firestore/Auth initialization
- `src/lib/use-anonymous-auth.ts` — hook that signs the user in anonymously and exposes the current user
- `firestore.rules` / `firebase.json` / `firestore.indexes.json` — Firestore config (not deployed yet)

## Firebase setup

This project is **not deployed** yet. To connect it to a real Firebase project:

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable **Firestore** and the **Anonymous** sign-in provider under Authentication.
3. Register a Web App and copy the config values into `.env.local`.
4. When ready to deploy rules: `firebase deploy --only firestore:rules` (requires the Firebase CLI and `firebase login`).

## Learn more

- [Next.js Documentation](https://nextjs.org/docs)
- [next-intl Documentation](https://next-intl.dev)
- [Firebase Documentation](https://firebase.google.com/docs)
