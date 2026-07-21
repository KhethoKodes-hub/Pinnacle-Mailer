# Backend Deployment on Render

This backend is a long-running NestJS service, so Render is a good fit.

## 1) Create service from blueprint

- In Render, choose **New +** -> **Blueprint**.
- Connect this repository.
- Render will load `render.yaml`.
- Create the service.

## 2) Set required environment variables

Set these in Render (Production):

- `JWT_SECRET` (required, strong random string)
- `JWT_REFRESH_SECRET` (required, strong random string)
- `AUTH_URL` (required, your frontend public URL, e.g. `https://your-frontend.vercel.app`)

Already set by blueprint:

- `DATABASE_URL=file:/var/data/pinnacle-mailer.db`
- `NODE_ENV=production`
- `LOG_LEVEL=info`

## 3) First deploy behavior

Build command runs:

1. `npm ci`
2. `prisma generate`
3. `nx build backend`
4. `prisma migrate deploy`

Start command runs:

- `node dist/apps/backend/main.js`

## 4) Wire frontend (Vercel) to backend

Set in Vercel for the frontend project:

- `BACKEND_API_BASE_URL=https://<your-render-service>.onrender.com`
- `AUTH_URL=https://<your-frontend-domain>`
- `AUTH_SECRET=<strong-random-string>`

Then redeploy frontend.

## 5) Verify

- Backend health: `https://<your-render-service>.onrender.com/api/health`
- API docs: `https://<your-render-service>.onrender.com/api/docs`
- Frontend login calls should hit Render backend successfully.

## Notes

- This keeps your current SQLite setup by attaching a Render persistent disk.
- For scale/high availability, migrate Prisma from SQLite to managed Postgres later.
