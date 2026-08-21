# 📋 Liberty Uniform — Order Book & ERP Management System

<div align="center">

![React](https://img.shields.io/badge/React-18.x-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-4.x-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/Auth-JWT%20%26%20Bcrypt-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)
![Render](https://img.shields.io/badge/Deployed-Render-46E3B7?style=for-the-badge&logo=render&logoColor=black)

**A full-stack, enterprise-grade business management and order lifecycle platform built for a commercial tailoring business.**  
*Features 1-click sandboxed recruiter demo mode, real-time tailor production queues, supplier procurement, multi-device session security, and automated Telegram cloud backups.*

[⚡ Launch Live App & Sandbox Demo](https://order-book-2ku0.onrender.com) · [Report Bug](https://github.com/advaitk-7/order-book/issues)

</div>

---

## 📌 Executive Overview

**Liberty Uniform Order Book** is a production-deployed, end-to-end ERP and order management platform used daily in business operations. It digitizes custom tailoring intake, sleeve/garment size breakdowns, tailor queue assignment, supplier procurement (POs), commercial corporate dispatches (COs), customer waitlists, and financial tracking.

### 🌟 Key Highlights for Recruiters
- **⚡ Zero-Friction 1-Click Guest Demo Mode**: Recruiters can test the full platform instantly without signing up or creating credentials.
- **🛡️ Sandboxed Multi-Tenancy Architecture**: Built using Node.js `AsyncLocalStorage` and Mongoose model proxies for 100% database isolation (`order_book_demo` vs `order_book`).
- **📱 Real-Time Device Session Tracking**: JWT-based session security with User-Agent parsing and hardware touch-point detection (iPadOS Safari Desktop mode vs MacBook/Mobile).
- **💾 Automated Telegram Cloud Backups**: Nightly 11:59 PM IST Gzip-compressed database backups (`.json.gz`) automatically dispatched to a private Telegram Bot.
- **🧵 Tailor Queue & Production Master**: Category-wise rate management, sleeve classification, and urgent delivery pipeline tracking.

---

## ✨ Core Features & Functional Architecture

### 1. 🛍️ Customer Intake & Order Lifecycle
- **Multi-Item Order Intake**: Capture customer contact info, school name, grade, and gender alongside unlimited garment items per order.
- **Adaptive Measurements**: Dynamic form fields tailored per garment type (*Shirt, Kurta, Top, Blazer, Pant, Shorts, Pajama, Pina, Skirt, Frock*).
- **Auto Sleeve Classification**: Intelligent parsing for Half Sleeve / Full Sleeve tags with visual indicators.
- **Status Lifecycle Pipeline**:
  - Production Status: `Pending ➔ Ready ➔ Delivered`
  - Payment Status: `Unpaid ➔ Paid`
  - Contact Status: `Not Contacted ➔ Contacted ➔ Unable to Contact`
- **Smart Order Renumbering**: Cycle management with non-blocking background cleanup.

### 2. ⚡ Sandboxed Recruiter Demo Mode
- **Instant Access**: One-tap guest login bypasses password prompts.
- **Database Isolation**: Requests execute in an isolated sandbox (`order_book_demo`), ensuring zero leakage into live customer data.
- **Automated Seeding & Cleanup**: Instant sandbox database reset for fresh testing.
- **Isolated Backups**: Demo backups remain strictly within `/backups_demo/` and bypass Telegram dispatches.

### 3. 🧵 Tailor Production Queue & Rate Master
- **Tailor-Facing Workstation**: Aggregates in-production items filtered by garment type, delivery urgency, and category.
- **Category & Pricing Settings**: Manage custom production categories (*e.g., H.S. Shirt, Coaty AT*) with baseline rate tracking.
- **One-Click Item Progress**: Update individual item statuses directly from the tailor view.

### 4. 📦 Stock Waitlist & School Directory
- Customer waitlist tracking for out-of-stock garment sizes (`Pending ➔ Fulfilled`).
- Integrated school directory for rapid filter assignment.

### 5. 🏬 Supplier Procurement (Purchase Orders - POs)
- **Supplier Directory**: Manage vendor/party profiles and contact records.
- **Product Size Breakdowns**: Size-wise item matrix per supplier PO.
- **Installment Receiving**: Multi-stage delivery logging (`Pending ➔ Partially Received ➔ Completed`).
- **Automated PO Maintenance**: Background purge for completed purchase orders.

### 6. 🏢 Commercial & Corporate Orders (COs)
- Enterprise B2B contract tracking for institutional clients (schools, corporations).
- Partial dispatch logging with date, quantity, and payment milestone tracking.

### 7. 🔒 Security, Session Management & Telegram Bot
- **JWT & Bcrypt**: Hashed password storage with 24-hour JWT session tokens.
- **Active Logged-In Devices**: Real-time session monitoring displaying IP address, location, and hardware device name (*Apple iPad, Apple iPhone, MacBook, Samsung Galaxy, Windows PC*). Remote 1-click session revocation.
- **Telegram Bot Integration**:
  - OTP password reset delivered directly to Telegram.
  - Automatic nightly Gzip backups (`.json.gz`) uploaded directly to Telegram.
  - Manual backup generation & point-in-time database restoration.

### 8. 📊 Analytics, Reports & WhatsApp Dispatches
- **Live Business Dashboard**: Real-time stats on pending revenue, ready deliveries, and order velocity.
- **Print-Optimized PDF Export**: High-fidelity A4/A3 landscape rendering with custom margin and font scaling.
- **Excel/CSV Export**: Complete measurement matrices for offline accounting.
- **WhatsApp Integration**: One-click pre-filled customer readiness notifications.

---

## 🛠️ Tech Stack & Dependencies

| Layer | Technology | Key Packages / APIs |
|---|---|---|
| **Frontend** | React 18 (Vite) | Custom Vanilla CSS, Canvas Emoji Engine |
| **Backend** | Node.js (v20+) | Express.js, `AsyncLocalStorage`, `zlib` |
| **Database** | MongoDB | Mongoose ODM, MongoDB Atlas Cloud |
| **Authentication** | JWT & Bcrypt | `jsonwebtoken`, `bcryptjs` |
| **Automations** | Telegram Bot API | `FormData`, Gzip Compression, Telegram Docs API |
| **Deployment** | Render | Continuous Integration / Continuous Deployment (CI/CD) |

---

## 🏗️ System Architecture & Data Flow

```
                              ┌──────────────────────────────────────┐
                              │            React 18 SPA              │
                              │   (Vite + Custom CSS + Context)      │
                              └──────────────────┬───────────────────┘
                                                 │ HTTPS / REST
                                                 ▼
                              ┌──────────────────────────────────────┐
                              │       Express.js API Server          │
                              │      (JWT Auth + User-Agent)         │
                              └──────────────────┬───────────────────┘
                                                 │
                        ┌────────────────────────┴────────────────────────┐
                        │ AsyncLocalStorage Context (IsDemo Flag Routing) │
                        └──────────┬────────────────────────────┬─────────┘
                                   │                            │
                     IsDemo = false│                            │IsDemo = true
                                   ▼                            ▼
                      ┌────────────────────────┐    ┌────────────────────────┐
                      │ Production Database    │    │ Sandbox Demo Database  │
                      │ (`order_book`)         │    │ (`order_book_demo`)    │
                      └────────────┬───────────┘    └────────────────────────┘
                                   │
                                   ▼ (Nightly 11:59 PM IST)
                      ┌────────────────────────┐
                      │  Telegram Cloud Bot    │
                      │  (Gzip Backup Storage) │
                      └────────────┬───────────┘
```

---

## 🔌 Core API Endpoints

| Module | Method | Endpoint | Description |
|---|---|---|---|
| **Auth** | `POST` | `/api/auth/login` | Authenticates admin & generates 24h JWT |
| | `POST` | `/api/login/demo` | Generates sandboxed guest demo session |
| | `GET` | `/api/auth/sessions` | Lists active device sessions |
| | `DELETE` | `/api/auth/sessions/:id` | Revokes specific logged-in device |
| **Orders** | `GET` | `/api/orders` | Search, filter, and page order ledger |
| | `POST` | `/api/orders` | Creates new order with embedded measurements |
| | `PATCH` | `/api/orders/:id` | Updates order details or lifecycle status |
| **Procurement**| `GET` | `/api/vendor-orders` | Lists supplier purchase orders (POs) |
| | `POST` | `/api/vendor-orders` | Creates PO with size breakdown |
| **Commercial** | `GET` | `/api/bulk-orders` | Lists corporate contracts (COs) |
| **Backups** | `POST` | `/api/backups/create` | Triggers manual database backup |
| | `POST` | `/api/backups/restore` | Restores database from uploaded `.json.gz` |

---

## 🚀 Local Development Setup

### Prerequisites
- **Node.js**: v18.x or higher
- **MongoDB**: Local MongoDB instance or MongoDB Atlas URI

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/advaitk-7/order-book.git
   cd order-book
   ```

2. **Install dependencies**:
   ```bash
   npm run install-all
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the `server/` directory:
   ```env
   PORT=5001
   MONGO_URI=mongodb://127.0.0.1:27017/order_book
   JWT_SECRET=your_jwt_secret_key_here
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=adminpassword
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token (optional)
   TELEGRAM_CHAT_ID=your_telegram_chat_id (optional)
   ```

4. **Start the Application**:
   ```bash
   # In terminal 1 (Backend Server):
   npm start

   # In terminal 2 (Frontend React App):
   cd client && npm run dev
   ```

5. Access the app locally at `http://localhost:5173`.

---

## 📸 Section Preview

| Section | Key Functionality |
|---|---|
| **Dashboard** | Revenue analytics, ready order alerts, recent activity feed |
| **New Order Intake** | Dynamic measurement form per garment type & sleeve detection |
| **Orders Ledger** | Levenshtein fuzzy search, multi-filter date/school sorting |
| **Production Queue** | Tailor workstation with urgent delivery sorting & rate tracking |
| **Supplier Procurement** | Vendor PO creation, partial delivery logs, stock receiving |
| **Device Security** | Real-time session monitoring & remote hardware logout |

---

## 👤 Author & Maintainer

**Advait Karia**  
- GitHub: [@advaitk-7](https://github.com/advaitk-7)  
- LinkedIn: [Advait Karia](https://www.linkedin.com/in/advait-karia-884a872a1/)
