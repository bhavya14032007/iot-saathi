# 🗄️ IoT Saathi - Dedicated Database & Real-Time Sync Service

This directory contains the standalone, production-ready database service for **IoT Saathi**. It stores and manages all hardware components present in the website, provides authenticated admin CRUD endpoints, and broadcasts real-time Server-Sent Events (SSE) so that any item added, updated, or removed in the admin panel instantly reflects on the website without page refresh.

---

## 🚀 Key Features

1. **SQLAlchemy ORM with Dual Database Engine Support:**
   - **Render PostgreSQL:** Automatically connects to Render's managed PostgreSQL database using the standard `DATABASE_URL` environment variable.
   - **SQLite Fallback:** Uses local `sqlite:///./iot_saathi_store.db` for zero-configuration local development.
2. **Real-Time Live Updates (Server-Sent Events / SSE):**
   - Whenever an item is added, edited, toggled, or deleted via the Admin Panel, the database server instantly pushes a lightweight event to connected frontend clients (`store.html`, `admin.html`).
3. **Automated Seeding:**
   - On first boot, if the database is empty, it automatically seeds the initial 12 hardware components (ESP32 DevKit, Arduino Uno, DHT22, HC-SR04, Relays, OLEDs, etc.).
4. **FastAPI High Performance:**
   - Asynchronous request handling, Pydantic validation, CORS middleware enabled for seamless connection from Vercel, Render, GitHub Pages, or local environments.
5. **Ready for Render Deployment:**
   - Includes `render.yaml` Blueprint, `Procfile`, and `requirements.txt`.

---

## 📋 Database Schema (`components` Table)

| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR(64) | PRIMARY KEY, INDEX | Unique identifier (e.g., `comp-001`, `comp-a1b2c3d4`) |
| `name` | VARCHAR(150) | NOT NULL, INDEX | Component display name |
| `description` | TEXT | DEFAULT `""` | Detailed description and pinout specs |
| `price` | FLOAT | NOT NULL | Price in INR (₹) |
| `category` | VARCHAR(64) | INDEX | Category (Microcontrollers, Sensors, Actuators, Displays, Modules, etc.) |
| `image` | TEXT | DEFAULT `""` | Image URL or SVG data URI |
| `stock` | INTEGER | DEFAULT `0` | Available stock count |
| `active` | BOOLEAN | INDEX, DEFAULT `TRUE` | Store visibility status |
| `created_at` | DATETIME | DEFAULT `UTC_NOW` | Timestamp of creation |
| `updated_at` | DATETIME | DEFAULT `UTC_NOW` | Timestamp of last modification |

---

## 🔌 API Endpoints Reference

### Public Endpoints (Storefront)
- `GET /health` or `GET /api/health` — Database connection status, engine type (PostgreSQL / SQLite), total & active counts.
- `GET /api/components` — List all active components (supports `?category=Sensors`).
- `GET /api/components/{id}` — Get single active component details.
- `GET /api/config` — WhatsApp order contact configuration.
- `GET /api/events` — **Real-Time Server-Sent Events (SSE)** stream. Pushes live catalog events (`component_created`, `component_updated`, `component_deleted`, `component_toggled`).

### Admin Management Endpoints (Requires `X-Admin-Token` header)
- `POST /api/admin/login` — Login with admin password (`ADMIN_PASSWORD`), returns session token.
- `GET /api/admin/verify` — Check session token validity.
- `GET /api/admin/components` — List all components (including inactive items).
- `POST /api/admin/components` — Add new component to database (broadcasts `component_created`).
- `PUT /api/admin/components/{id}` — Update component fields (broadcasts `component_updated`).
- `DELETE /api/admin/components/{id}` — Permanently delete component (broadcasts `component_deleted`).
- `PATCH /api/admin/components/{id}/toggle` — Toggle visibility status (broadcasts `component_toggled`).

---

## 🌐 How to Deploy Separately to Render

You can deploy this database service to Render in less than 3 minutes using either method below:

### Option A: Render Web Service (Recommended)
1. Sign in to your **[Render Dashboard](https://dashboard.render.com/)**.
2. Click **New +** -> **Web Service**.
3. Connect your GitHub repository (`iot-saathi`).
4. Configure the Web Service settings:
   - **Name:** `iot-saathi-db` (or any name you choose)
   - **Root Directory:** `database`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free
5. Add Environment Variables in the **Environment** tab:
   - `ADMIN_PASSWORD` = `your_secure_password` (default: `iotsaathi_admin_2026`)
   - `WHATSAPP_NUMBER` = `919389860087`
   - `CORS_ORIGINS` = `*`
6. *(Optional)* To attach a Render PostgreSQL Database:
   - Click **New +** -> **PostgreSQL**.
   - Copy the **Internal Database URL** or **External Database URL**.
   - Add it as `DATABASE_URL` in your Web Service environment variables.
   *(If `DATABASE_URL` is omitted, the service will run using SQLite automatically!)*
7. Click **Create Web Service**.
8. Once deployed, Render will provide your live URL (e.g., `https://iot-saathi-db.onrender.com`).

### Option B: Deploy Using Render Blueprint (`render.yaml`)
1. In your Render Dashboard, click **New +** -> **Blueprint**.
2. Connect your repo and select `database/render.yaml`.
3. Render will automatically provision both the PostgreSQL database and the FastAPI Web Service together!

---

## 🔗 Connecting the Website Frontend to Your Render Database

1. Open your website's **Admin Panel** (`admin.html`).
2. Log in with your admin password.
3. Click the **"⚙️ Database Config"** button in the dashboard header.
4. Paste your Render service URL: `https://your-database-service.onrender.com`.
5. Click **"Test & Save"**. The indicator will turn **🟢 Database: Connected (Render)**.
6. Now, whenever an item is added, edited, or deleted in the admin panel, the change is saved directly into your Render database and immediately pushed in real time to all users browsing `store.html`!

---

## 💻 Local Testing & Development

Run locally on your machine:

```bash
cd database
pip install -r requirements.txt
python test_db.py
python main.py
```

The database server will be live at `http://127.0.0.1:8001`.
You can view the interactive OpenAPI documentation at `http://127.0.0.1:8001/docs`.
