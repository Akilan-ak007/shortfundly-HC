# Email Automation Platform Documentation

Welcome to the **Email Automation Platform** documentation. This full-stack, enterprise-ready platform is designed for HR automation tasks, including parsing employee/recipient spreadsheet datasets, generating high-quality PDFs (such as certificates, offer letters, relieving letters, and experience letters), dynamically replacing values in templates, and sending emails asynchronously using multiple providers (SMTP, Gmail, SendGrid, Amazon SES, or Mailgun).

The project consists of three main sub-systems:
1. **Backend API**: Node.js & Express.js, TypeScript, Prisma ORM, BullMQ (Redis) or In-memory Queue fallback, PDFKit & `pdf-lib` for document generation, and Gemini/Ollama AI integrations.
2. **Frontend Console**: A responsive, dark-themed Single Page Application (SPA) built with React (Vite), TypeScript, Tailwind CSS, and React Router.
3. **Next.js Supabase Login Gate**: A standalone Next.js App Router application providing a glassmorphic login gate integrated with Supabase Authentication.

---

## Table of Contents
1. [Architecture & System Flow](#1-architecture--system-flow)
2. [Database Schema](#2-database-schema)
3. [Backend API Reference](#3-backend-api-reference)
4. [Queue Management & Resilience](#4-queue-management--resilience)
5. [PDF Generation Engine](#5-pdf-generation-engine)
6. [AI Copilot & Data Heuristics](#6-ai-copilot--data-heuristics)
7. [Next.js Supabase Auth Application](#7-nextjs-supabase-auth-application)
8. [Local Development & Setup](#8-local-development--setup)

---

## 1. Architecture & System Flow

The platform utilizes a modern service-oriented MVC architecture. 

```mermaid
graph TD
    Client[React Frontend / Next.js Auth] -->|HTTP REST| API[Express API Gateway]
    API -->|Prisma ORM| DB[(PostgreSQL Database)]
    API -->|Enqueue Jobs| Queue[Queue Manager]
    Queue -->|BullMQ Broker| Redis[(Redis Server)]
    Queue -->|Fallback Loop| Memory[In-Memory Queue]
    
    subgraph Job Execution
        QueueEngine[Queue / Memory Worker]
        QueueEngine -->|Read Templates| DB
        QueueEngine -->|Generate PDF| PDFEngine[PDF Service: PDFKit & pdf-lib]
        QueueEngine -->|Dispatch Email| EmailEngine[Email Service: Nodemailer]
    end
    
    Queue --> QueueEngine
    Memory --> QueueEngine
    
    PDFEngine -->|Write to Disk| Storage[(Local Storage)]
    EmailEngine -->|SMTP Relay / API| SMTP[Mailing Providers: SendGrid, SES, Mailgun, SMTP]
```

### Components
*   **API Gateway (`backend/src/app.ts`)**: Serves endpoint routes, handles CORS, processes file uploads using `multer`, and enforces authentication middleware.
*   **Authentication Middleware (`backend/src/middleware/auth.ts`)**: Decodes JWT tokens to populate user info and validates user roles (`ADMIN` vs `HR_STAFF`).
*   **Queue Worker (`backend/src/queues/queueManager.ts`)**: Processes queued dispatches. If Redis is unavailable, it gracefully defaults to an in-memory execution loop.
*   **PDF Generation (`backend/src/services/pdfService.ts`)**: Generates documents with standard vector borders, embeds secure verification QR codes, and overlays content onto custom background templates.
*   **AI Integration (`backend/src/services/aiService.ts`)**: Leverages Google Gemini Flash API (or local Ollama model fallback) for template copy, sending time predictions, anomaly checks, and final summaries.

---

## 2. Database Schema

The database uses PostgreSQL, managed via **Prisma ORM**. The schemas are defined in `backend/prisma/schema.prisma`.

### Entity Relationship Model

```mermaid
erDiagram
    Company ||--o{ User : employs
    Company ||--o{ Recipient : manages
    User ||--o{ AuditLog : performs
    Recipient ||--o{ GeneratedDocument : "owns (1:N)"
    Recipient ||--o{ EmailLog : "records (1:N)"
    
    User {
        string id PK
        string email UK
        string passwordHash
        string name
        Role role
        string companyId FK
    }
    Company {
        string id PK
        string name
    }
    Recipient {
        string id PK
        string name
        string email
        string position
        string department
        DateTime joiningDate
        DocType documentType
        string attachmentFileName
        RecipientStatus status
        string errorMsg
        int retryCount
        string companyId FK
    }
    Template {
        string id PK
        string name
        DocType type
        string content
        Json designMetadata
    }
    EmailTemplate {
        string id PK
        string name UK
        string subject
        string body
        string signature
    }
    GeneratedDocument {
        string id PK
        string recipientId FK
        DocType documentType
        string fileUrl
    }
    EmailLog {
        string id PK
        string recipientId FK
        RecipientStatus status
        string provider
        string errorMessage
        int retryCount
        DateTime sentAt
    }
    Settings {
        string id PK
        string provider
        string smtpHost
        int smtpPort
        string smtpUser
        string smtpPass
        Json apiKeys
        string defaultFrom
    }
    AuditLog {
        string id PK
        string userId FK
        string action
        string details
        string ipAddress
    }
```

### Enumerated Types (Enums)
*   **`Role`**: `ADMIN`, `HR_STAFF`
*   **`DocType`**: `OFFER_LETTER`, `CERTIFICATE`, `APPOINTMENT_LETTER`, `INTERNSHIP_LETTER`, `RELIEVING_LETTER`, `EXPERIENCE_LETTER`
*   **`RecipientStatus`**: `QUEUED`, `SENDING`, `SENT`, `FAILED`, `BOUNCED`

---

## 3. Backend API Reference

All backend API routes are prefix-managed under `/api` and defined in [`backend/src/routes/index.ts`](file:///Users/akilank/Documents/shortfundly-HC/backend/src/routes/index.ts).

### Authentication Endpoints
| Endpoint | Method | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `/auth/login` | `POST` | None | Authenticates user credentials. Returns JWT Token, Role, and User profile. |
| `/auth/forgot-password` | `POST` | None | Triggers recovery instructions workflow. |
| `/auth/me` | `GET` | JWT | Returns current authenticated user metadata. |
| `/auth/change-password` | `POST` | JWT | Updates user credentials. |

### Spreadsheet Upload & Recipient Endpoints
| Endpoint | Method | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `/upload` | `POST` | JWT | Accepts multipart spreadsheet upload (`file`). Parses and registers recipients. |
| `/recipients` | `GET` | JWT | Lists recipients with search, pagination, and filter queries (`status`, `department`, etc.). |
| `/recipients` | `POST` | JWT | Creates new recipients. Supports comma/newline separated bulk emails in the `email` field. |
| `/recipients/:id` | `PUT` | JWT | Edits a recipient's details (resets error metrics if status is marked `QUEUED`). |
| `/recipients/:id` | `DELETE` | JWT | Removes a recipient record. |
| `/recipients/clear` | `DELETE` | JWT | Empties the recipient dataset for the active tenant. |
| `/recipients/bulk` | `POST` | JWT | Accepts a JSON array of `ids` and triggers `delete` or `retry` actions. |

### Templates Endpoints
| Endpoint | Method | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `/templates/doc` | `GET` | JWT | Retrieves all document layouts. |
| `/templates/doc` | `POST` | JWT | Saves a new PDF rich template configuration. |
| `/templates/doc/:id` | `PUT` | JWT | Edits document template content and visual metadata. |
| `/templates/doc/:id` | `DELETE` | JWT | Deletes a document layout. |
| `/templates/upload-bg` | `POST` | JWT | Uploads template background borders/assets (image or PDF). |
| `/templates/email` | `GET` | JWT | Retrieves email subject and body configurations. |
| `/templates/email` | `POST` | JWT | Creates a new email copy template. |
| `/templates/email/:id` | `PUT` | JWT | Edits email templates. |
| `/templates/email/:id` | `DELETE` | JWT | Removes email templates. |

### AI Helper Endpoints
| Endpoint | Method | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `/templates/ai/generate-email` | `POST` | JWT | Compiles customized welcome copy based on guidelines and role context. |
| `/templates/ai/suggest-subject` | `POST` | JWT | Recommends 3 subject lines tailored to specific roles and company brands. |
| `/templates/ai/detect-anomalies` | `GET` | JWT | Audits queued datasets for format violations or mismatched metadata. |
| `/templates/ai/sending-time` | `GET` | JWT | Recommends high-engagement email delivery windows. |

### Automation Endpoints
| Endpoint | Method | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `/automation/start` | `POST` | JWT | Enqueues jobs for pending (`QUEUED`/`FAILED`) recipients in the active tenant. |
| `/automation/progress` | `GET` | JWT | Monitors processing percentages, counts, and compiles an AI summary upon completion. |

### Dashboard & Reporting Endpoints
| Endpoint | Method | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `/dashboard/stats` | `GET` | JWT | Returns KPIs (Success Rate, Sent/Failed/Queued counts) and chart arrays. |
| `/dashboard/recent-activity` | `GET` | JWT | Lists the last 10 logs recorded in the tenant audit trail. |
| `/reports/download` | `GET` | JWT | Generates and downloads a delivery report. Supports `csv`, `xlsx`, and `pdf`. |

### System Settings Endpoints
| Endpoint | Method | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `/settings` | `GET` | JWT | Returns the active email provider configuration. |
| `/settings` | `POST` | JWT + Admin | Updates email credentials (SMTP, SendGrid, Amazon SES, Mailgun, Gmail). |
| `/settings/test` | `POST` | JWT + Admin | Verifies SMTP handshake and authentication against the active provider. |
| `/settings/company` | `GET` | JWT | Returns company settings and metadata. |
| `/settings/company` | `PUT` | JWT + Admin | Edits company settings (e.g. corporate name and logos). |

---

## 4. Queue Management & Resilience

The platform implements a dual-mode queue processing architecture.

### BullMQ Mode (Redis Enabled)
*   **Stack**: Uses `bullmq` alongside `ioredis` to manage jobs asynchronously.
*   **Job Broker**: Jobs are saved to Redis, surviving server restarts.
*   **Retry Policy**: Configured to attempt processing up to **3 times** with an **exponential backoff** delay of 5 seconds.
*   **Worker**: Spawns a background processor thread utilizing isolated Redis connections.

### In-Memory Fallback Mode (Redis Offline)
*   **Handshake Checks**: During startup, [`QueueManager.initialize()`](file:///Users/akilank/Documents/shortfundly-HC/backend/src/queues/queueManager.ts#L30-L94) sends a `PING` command to the Redis server. If it fails or times out (2.5-second threshold), the system automatically defaults to in-memory processing.
*   **Execution Loop**: An internal memory array (`memoryQueue`) gathers jobs. A recursive runner iterates through entries sequentially.
*   **Failure Log**: If an in-memory job fails, the failure is written to the database logs immediately.

---

## 5. PDF Generation Engine

The [`PDFService`](file:///Users/akilank/Documents/shortfundly-HC/backend/src/services/pdfService.ts) handles compiling structured HR letters and certificate layouts.

```mermaid
flowchart TD
    Start[Compile PDF Request] --> Placeholders[Substitute `{{Variables}}` in Template]
    Placeholders --> QR[Generate Verification QR Code PNG Buffer]
    QR --> OrientationCheck{Is Certificate?}
    
    OrientationCheck -->|Yes| Certificate[Layout: Landscape A4]
    OrientationCheck -->|No| Letter[Layout: Portrait A4]
    
    Certificate --> BorderCheck{Has Custom BG?}
    Letter --> BorderCheck
    
    BorderCheck -->|Yes| DrawBG[Overlay Custom Image/PDF Background]
    BorderCheck -->|No| DrawDefault[Draw Gold/Blue Vectors & Letterhead]
    
    DrawBG --> RenderText[Render Substituted Text Content]
    DrawDefault --> RenderText
    
    RenderText --> EmbedQR[Embed Verification QR Code at Bottom]
    EmbedQR --> Save[Write file to storage]
    Save --> End[Return PDF path]
```

### Overlay Mechanics (`pdf-lib` Integration)
When users upload custom corporate template backdrops (e.g., certificate margins or letterheads in PDF format), the generation engine:
1. Draws text elements and QR codes onto a clean vector page using `pdfkit`.
2. Loads the custom background PDF using `pdf-lib`.
3. Merges the two documents page-by-page by copying the background layout and drawing the generated `pdfkit` layout directly on top of it.
4. Saves the resulting overlay to disk, ensuring high-fidelity layouts without visual layout shifts.

---

## 6. AI Copilot & Data Heuristics

The [`AIService`](file:///Users/akilank/Documents/shortfundly-HC/backend/src/services/aiService.ts) provides several AI-powered features. It connects to the **Google Gemini 1.5 Flash API** or falls back to a locally hosted **Ollama (Gemma:2b)** instance if the API key is not configured.

### Heuristic Anomalies Scanner
Before initiating bulk dispatches, users can run the anomaly checker. This scanner audits the queued database records using a set of rules:
1.  **Capitalization Audit**: Detects if names are in `ALL CAPS` (indicating accidental caps lock) or `all lowercase`.
2.  **Field Integrity**: Checks if department strings are accidentally swapped with position titles (e.g., matching common department terms in the job title field).
3.  **Identity Matching**: Extracts username substrings from emails and compares them with the employee name to identify potential mapping shifts.

### Automatic Copywriting
*   **Email Copy**: Generates customized welcome bodies based on user-provided guidelines, mapping specific placeholders (`{{Name}}`, `{{Position}}`, `{{Company}}`) so they can be substituted dynamically during mailing.
*   **Subject Recommendations**: Suggests 3 subject lines tailored to specific positions and company names.
*   **Peak Delivery Recommendations**: Suggests optimal sending windows based on common engagement rate metrics.
*   **Executive Batch Summary**: Generates a rich summary paragraph outlining the batch run results once completed.

---

## 7. Next.js Supabase Auth Application

The folder [`next-login/`](file:///Users/akilank/Documents/shortfundly-HC/next-login) houses a standalone Next.js App Router application that acts as a secure login gateway.

### Setup Details
*   **Design**: Features a glassmorphic dark-mode UI styled with Tailwind CSS, utilizing `lucide-react` icons.
*   **Supabase Integration**:
    *   **Client Component Auth**: Page components handle registration and login forms via client actions in [`login/page.tsx`](file:///Users/akilank/Documents/shortfundly-HC/next-login/src/app/login/page.tsx) using the Supabase Browser client.
    *   **Server Component Validation**: Server actions validate active sessions in the root view ([`page.tsx`](file:///Users/akilank/Documents/shortfundly-HC/next-login/src/app/page.tsx)) using cookie-based server client utilities. If unauthenticated, the user is redirected to `/login`.
*   **Callback Handler**: Captures validation hashes from email verification redirect URLs under `/auth/callback` to verify new user registrations.

---

## 8. Local Development & Setup

### Prerequisites
*   Node.js (v20+ or v22+)
*   Docker & Docker Compose (optional, for containerized environments)
*   PostgreSQL & Redis database servers (can run natively or via Docker)

### Native Setup (Local Machine)

#### 1. Backend Setup
```bash
cd backend
npm install
```
Configure your `.env` variables:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:password@localhost:5432/email_automation?schema=public"
REDIS_URL="redis://127.0.0.1:6379"
STORAGE_DIR="./storage"
JWT_SECRET="your-secure-jwt-key"
```
Apply migrations and seed the database:
```bash
npx prisma migrate dev
npm run seed
npm run dev
```

#### 2. Frontend Setup
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to access the console.

#### 3. Standalone Next.js Auth Setup
In a new terminal window:
```bash
cd next-login
npm install
```
Configure your `.env.local` variables:
```env
NEXT_PUBLIC_SUPABASE_URL="https://your-supabase-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
```
Start the Next.js dev server:
```bash
npm run dev
```
Open `http://localhost:3001/login` to view the Supabase login interface.
