# Deployment guide

> Vercel Serverless API + React SPA + Google OAuth/OIDC

## Architecture

Agent Blueprint deploys `api/auth/*` and `api/blueprint/*` as Vercel Functions and serves the built React SPA from the same project. Project data stays in each authenticated user's browser IndexedDB. See the [architecture specification](../product/06-architecture.md).

## Initial deployment

```bash
npm install -g vercel
vercel
```

Follow the Vercel prompts to select the appropriate account/team scope, link or create the project, and use the repository root as the project directory. `npm run build` builds the SPA; files in `api/` deploy as serverless functions.

## Production deployment

```bash
vercel --prod
```

## Environment variables

Configure secrets in Vercel Project Settings or with `vercel env add`. Never commit secret values or expose them in client bundles.

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Identify the Google OAuth client |
| `GOOGLE_CLIENT_SECRET` | Server-side authorization code exchange |
| `GOOGLE_REDIRECT_URI` | Exact callback URL for this environment |
| `APP_SESSION_SECRET` | Sign or encrypt the Blueprint session |
| `APP_BASE_URL` | Validate the app origin and safe redirects |
| `OPENAI_API_KEY` | Call the OpenAI Responses API |
| `AI_MODEL_LIGHT`, `AI_MODEL_DEFAULT`, `AI_MODEL_FINAL` | Map logical model profiles to model IDs |

Before implementing sign-in, create the Google Cloud consent screen and web OAuth client and register the exact callback URL for each environment. Request only the OIDC scopes required by the auth design; do not request Gmail API access. Follow [Google OAuth authentication design](../product/11-google-oauth-authentication.md).

For local development, keep values in an ignored `.env.local` file and run `npm run dev`.

## Pre-deployment checklist

- `.env.local` is excluded by `.gitignore`.
- API keys and OAuth/session secrets are absent from source and commit history.
- `npm run build` succeeds locally.
- `/login`, `/`, `/blueprints/new`, and `/blueprints/:projectId` behave correctly in the deployed environment.
- Desktop and mobile layouts are checked.
- HTTPS is active.

## Connect a domain

1. Open the project **Settings → Domains** in Vercel.
2. Add the domain and configure the DNS records shown by Vercel.
3. Add the resulting exact callback URL to the Google OAuth client configuration.
