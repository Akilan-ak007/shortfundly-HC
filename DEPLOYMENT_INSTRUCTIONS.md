# Deployment Guide: Email Automation Platform

This guide provides step-by-step instructions to deploy the components of the Email Automation Platform:
1. **Next.js Login Gateway** (`next-login/`) -> Deploy to **Vercel**
2. **React + Vite Frontend** (`frontend/`) -> Deploy to **Vercel**
3. **Node.js REST API & Queue Worker** (`backend/`) -> Deploy to **Railway, Render, or fly.io** (Vercel is serverless and does not host long-running servers or BullMQ/Redis tasks)

---

## Step 1: Push Changes to GitHub/GitLab
Ensure all your local changes (including the fixes to clear the build/lint errors) are committed and pushed to your remote Git repository:

```bash
git add .
git commit -m "chore: resolve deployment build & lint errors"
git push origin main
```

---

## Step 2: Deploy Next.js Login Gate (`next-login`) to Vercel

1. **Log in** to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New** > **Project**.
3. Import your Git repository.
4. In the configuration settings, set the following:
   * **Project Name**: `shortfundly-login` (or any preferred name)
   * **Framework Preset**: `Next.js`
   * **Root Directory**: `next-login` *(Make sure to edit and point this to `next-login`!)*
5. **Environment Variables**: Add the following keys from your `.env.local`:
   * `NEXT_PUBLIC_SUPABASE_URL` = `https://leicfejbmygyoiqzydfm.supabase.co`
   * `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your_anon_key_here`
6. Click **Deploy**. Vercel will build and deploy the app successfully.

---

## Step 3: Deploy the Backend (`backend`)
Since the backend uses a database and queues, it is typically hosted on Railway or Render. However, the backend has been re-architected with a synchronous serverless fallback and self-healing PDF regeneration, allowing it to be deployed entirely on Vercel as well.

### Option A: Railway (Persistent Server Setup)
1. Log in to [Railway](https://railway.app).
2. Click **New Project** > **Provision PostgreSQL** and **Provision Redis**.
3. Click **New Project** > **Github Repo** and select the repository.
4. In the settings, change the **Root Directory** to `backend`.
5. In **Variables**, add:
   * `PORT` = `5000`
   * `DATABASE_URL` = (Reference the PostgreSQL connection string provided by Railway under Database variables)
   * `REDIS_URL` = (Reference the Redis connection string provided by Railway under Redis variables)
   * `STORAGE_DIR` = `/tmp/storage` (or configure a persistent volume mount)
   * `JWT_SECRET` = `any-strong-secret-key`
6. Deploy the project. Note your public backend URL (e.g., `https://your-backend-api.up.railway.app`).
7. Run migrations and seed data on Railway (under the backend project terminal or run command):
   ```bash
   npx prisma migrate deploy
   npm run seed
   ```

### Option B: Vercel Serverless (Stateless / Database-only Setup)
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New** > **Project** and select your GitHub repository.
3. In the configuration settings:
   * **Project Name**: `shortfundly-backend`
   * **Framework Preset**: `Other`
   * **Root Directory**: `backend` *(Make sure to edit and point this to `backend`!)*
4. **Environment Variables**: Add the following keys:
   * `DATABASE_URL` = (Your hosted PostgreSQL URL, e.g. from Neon, Supabase or Railway)
   * `JWT_SECRET` = `any-strong-secret-key`
   * `PROCESS_MODE` = `serverless` (Instructs the server to execute automation tasks synchronously in parallel without background worker queues)
   * *Optionally (if using Gemini AI)*: `GEMINI_API_KEY` = `your-google-gemini-key`
5. Click **Deploy**. Vercel will automatically build the backend API, trigger Prisma client generation, and deploy the serverless functions.
6. To run database migrations and seed data, execute the commands from a local terminal pointed to your remote database:
   ```bash
   DATABASE_URL="your-hosted-database-url" npx prisma migrate deploy
   DATABASE_URL="your-hosted-database-url" npm run seed
   ```

---

## Step 4: Deploy the React + Vite Frontend (`frontend`) to Vercel

The React frontend requests endpoints using relative paths (`/api/...` and `/storage/...`). We can use a `vercel.json` configuration file in the `frontend` folder to proxy those requests to your deployed backend.

### 1. Create a `vercel.json` file in the `frontend` folder
You can create a `vercel.json` file inside `frontend/` containing the following configuration (replace `https://your-backend-api.up.railway.app` with your actual deployed backend URL):

```json
{
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "https://your-backend-api.up.railway.app/api/:path*"
    },
    {
      "source": "/storage/:path*",
      "destination": "https://your-backend-api.up.railway.app/storage/:path*"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 2. Deploy to Vercel
1. Go back to your [Vercel Dashboard](https://vercel.com).
2. Click **Add New** > **Project** and select your repository again.
3. In the configuration settings:
   * **Project Name**: `shortfundly-frontend`
   * **Framework Preset**: `Vite`
   * **Root Directory**: `frontend` *(Point this to `frontend`!)*
4. Click **Deploy**. Vercel will automatically build the React Vite bundle, compile typescript, and handle requests to `/api` using the `vercel.json` rewrites.

---

## Summary of URL References
* **Frontend Web App URL**: Deployed from `frontend/`
* **Next.js Login Gate URL**: Deployed from `next-login/`
* **Backend API Base URL**: Deployed from `backend/`
