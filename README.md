# Email Automation Platform

A production-ready full-stack HR automation platform to parse spreadsheets, generate customized PDFs (certificates, offer letters, relieves, etc.), dynamically substitute values into email templates, and asynchronously send out emails via SMTP, Gmail, SendGrid, Amazon SES, or Mailgun.

Features a beautiful, responsive dark-mode SaaS layout, an AI Copywriter assistant, QR-code document authentication, and a high-performance background queue worker with in-memory fallback.

---

## Technical Stack

*   **Frontend**: React (Vite), TypeScript, Tailwind CSS v3, React Router v6, React Query, Recharts, Canvas Confetti.
*   **Backend**: Node.js, Express.js (MVC architecture), Prisma ORM, Nodemailer, BullMQ (Redis job queue), PDFKit, SheetJS.
*   **Database**: PostgreSQL.
*   **Message Broker**: Redis (used by BullMQ).
*   **Deployment**: Docker, Docker Compose, Nginx (reverse proxy).

---

## Quick Start (Docker Compose)

The easiest way to run the entire stack (PostgreSQL, Redis, Backend, Frontend, and Nginx proxy) is via Docker Compose:

1.  **Ensure Docker is running** on your system.
2.  **Build and launch the containers**:
    ```bash
    docker compose up --build
    ```
3.  **Access the application**:
    *   **Frontend Web App**: `http://localhost:3000`
    *   **Backend REST API**: `http://localhost:5000/api`
4.  **Log In Credentials (Pre-seeded)**:
    *   **Email**: `admin@acme.com`
    *   **Password**: `admin123`

---

## Local Development Installation

If you prefer to run the services natively:

### Prerequisites
*   Node.js (v20+ or v22+)
*   PostgreSQL running locally (or fallback to an active server)
*   Redis server (optional - if running, BullMQ is activated; if down, the app falls back to a custom in-memory queue processor loop)

### 1. Backend Setup
1.  Navigate to the backend directory:
    ```bash
    cd backend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Create your `.env` configuration file (copy from `.env.example` or write details):
    ```env
    PORT=5000
    DATABASE_URL="postgresql://postgres:password@localhost:5432/email_automation?schema=public"
    REDIS_URL="redis://127.0.0.1:6379"
    STORAGE_DIR="./storage"
    JWT_SECRET="super-secret-jwt-key"
    ```
4.  Run Prisma database migrations:
    ```bash
    npx prisma migrate dev
    ```
5.  Seed default templates and admin credentials:
    ```bash
    npm run seed
    ```
6.  Launch the development server:
    ```bash
    npm run dev
    ```

### 2. Frontend Setup
1.  Navigate to the frontend directory in a separate terminal:
    ```bash
    cd ../frontend
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Launch the Vite React client:
    ```bash
    npm run dev
    ```
4.  Open `http://localhost:3000` in your web browser. Requests to `/api` and `/storage` will be automatically proxied to the backend at port 5000.

---

## Project Architecture

```
shortfundly-hc/
├── backend/
│   ├── prisma/             # Schema definitions and database seed scripts
│   ├── src/
│   │   ├── controllers/    # API routes endpoint logic
│   │   ├── middleware/     # JWT authentication, role guards
│   │   ├── models/         # Prisma client instances
│   │   ├── queues/         # BullMQ wrappers and memory fallbacks
│   │   ├── routes/         # Router paths declarations
│   │   ├── services/       # PDF builders, Nodemailer factories, AI engines
│   │   ├── app.ts          # Express configurations and HTTP middlewares
│   │   └── index.ts        # Server entry bootstrap listener
├── frontend/
│   ├── src/
│   │   ├── components/     # Navigation layout, sidebar drawers, skeletons
│   │   ├── context/        # Auth states, Toast controllers, Dark/Light modes
│   │   ├── pages/          # Dashboard stats, database lists, wizard modules
│   │   ├── utils/          # API fetch helpers
│   │   ├── App.tsx         # Protecting gateways and routing links
│   │   └── main.tsx        # React client render point
├── docker-compose.yml      # Orchestrates all containers
└── README.md
```

---

## AI Features & Heuristics

1.  **AI Copywriter**: Write custom instructions in the template editor, and the AI compiles welcoming copy.
2.  **AI Subject Lines**: Recommends subject lines suited for the employee position.
3.  **Data Integrity Check**: Audits the queued lists for anomalies (Caps Lock names, mismatched emails, incorrect columns) before starting bulk dispatches.
4.  **AI Scheduler**: Recommends peak email engagement hours.
5.  **Executive summaries**: Generates summary paragraphs of the automation batch once completed.
