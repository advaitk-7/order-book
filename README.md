# 📋 Liberty Uniform — Order Book Management System

> A full-stack, production-grade business management web application built for a school uniform tailoring business. Manages the complete lifecycle of custom orders — from customer intake and tailor production tracking to supplier procurement, bulk corporate orders, and financial reporting.

**Live Demo:** [order-book on Render](https://order-book-2ku0.onrender.com) &nbsp;|&nbsp; **Stack:** React · Node.js · Express · MongoDB

---

## 📌 Overview

Liberty Uniform Order Book is a real-world, deployed management tool used daily by a tailoring business. It replaces manual paper ledgers with a digital system that tracks every custom order from creation to delivery, manages the production pipeline, coordinates with fabric suppliers, handles stock waitlists, and produces professional exports.

The application is **fully responsive**, supports **dark and light themes**, and is deployed on **Render** with **MongoDB Atlas** as the cloud database.

---

## ✨ Key Features

### 🛍️ Orders Management
- Create, edit, and delete custom tailor orders
- Per-order customer details: name, contact, school, grade, gender
- Multi-item support per order — each item has its own type, quantity, size farma, and full measurement profile
- **Item types supported:** Shirt, Kurta, Top, Blazer, Pant, Shorts, Pajama, Pina, Skirt, Frock
- Measurement fields auto-adapt per item type (e.g. Shirt → Length, Chest, Shoulder, Sleeve, Neck)
- Custom sleeve-tag detection (Half Sleeve / Full Sleeve) shown as contextual badges
- Order status tracking: `Pending → Ready → Delivered`
- Payment status tracking: `Unpaid / Paid`
- Contact status tracking: `Not contacted / Contacted / Unable to contact`
- Inline notes per order; smart order numbering with cycle management

### 🔍 Search & Filtering
- Real-time fuzzy search using Levenshtein distance across order number, customer name, and phone number
- Filter by delivery date range, school, production status, payment status, item type
- Sort by any column; sticky filters per section

### 🧵 Production Queue (Tailor's View)
- Dedicated tailor-facing view for in-production orders
- Filter and sort by item type, delivery urgency, and production category
- Per-item production category assignment with rate tracking
- One-click status updates per item

### 📊 Dashboard
- Live summary stats: Total orders, Pending, Ready, Delivered, Pending Payments
- Recent order activity feed

### 📦 Stock Waitlist
- Maintain a waitlist of customers waiting for specific items
- Track request status: `Pending / Fulfilled`
- School-based filtering; manage a school list for waitlist entries

### 🏬 Supplier Restock & Purchase Orders
- Create and track supplier Purchase Orders (POs) with full product breakdowns
- Size-wise quantity breakdown per product
- PO status: `Pending / Partially Received / Completed`
- Stock receiving workflow with installment-based delivery tracking
- Supplier (party) profile management
- Auto-deletion of old completed POs after a configurable number of days

### 🏢 Bulk / Corporate Orders
- Manage large-volume orders from institutions (schools, corporates)
- Client profile management; per-product size breakdown with pricing
- Dispatch tracking with payment and quantity per dispatch

### 📤 Export & Reporting
- **PDF export:** Production queue as A4/A3 landscape PDF with print-optimised layout
- **Excel/CSV export:** Full order data with all measurement columns
- **WhatsApp integration:** One-tap pre-filled WhatsApp message to customer

### ⚙️ Settings & Security
- JWT-based authentication with bcrypt password hashing
- OTP-based password reset via email
- Session management: view all active logins with device/IP, remotely revoke any session
- Admin credential update from settings panel
- Dark / Light theme toggle with persistence

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Vite, Vanilla CSS |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB with Mongoose ODM |
| **Auth** | JWT (jsonwebtoken), bcryptjs |
| **Deployment** | Render (full-stack), MongoDB Atlas |
| **PDF Export** | Browser print with CSS print media queries |
| **Emoji Support** | Custom canvas-based detection with per-device fallbacks |

---

## 🏗️ Architecture

```
Order_Book/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── App.jsx          # ~12,500 lines — entire SPA component tree
│       ├── App.css          # ~66KB custom CSS with dark/light theming
│       ├── emojiUtils.js    # Canvas-based emoji support detection
│       └── main.jsx         # React entry point
│
└── server/
    └── server.js            # ~2,900 lines — Express API + Mongoose models
```

### Frontend
- Single-page application with no external UI library (pure custom CSS)
- Client-side routing via state — no React Router needed
- `useMemo` / `useDeferredValue` for performant filtering and search
- Form state persistence: new order drafts survive section navigation

### Backend
- RESTful API with 50+ endpoints across 7 resource domains
- Mongoose schemas with embedded sub-documents (items, measurements, dispatches, installments)
- Custom Levenshtein distance fuzzy search (server-side, no search index needed)
- Session model tracks all active logins with device fingerprinting via User-Agent parsing
- Background cleanup auto-purges oldest delivered orders at a configurable threshold

---

## 🔌 API Summary

| Resource | Endpoints |
|---|---|
| **Auth** | Login, Forgot Password, OTP Verify, Reset Password, Sessions CRUD |
| **Orders** | CRUD, bulk delete, status patch, item-category patch, cleanup preview |
| **Waitlist** | CRUD, bulk delete, school list CRUD |
| **Supplier Restock (POs)** | CRUD, installments CRUD, PO renumber |
| **Parties (Suppliers)** | CRUD |
| **Bulk Orders (COs)** | CRUD, dispatches CRUD |
| **Clients** | CRUD |
| **Production Categories** | CRUD with default rate management |

---

## 🚀 Local Setup

```bash
# Clone the repository
git clone https://github.com/advaitk-7/order-book.git
cd order-book

# Install all dependencies (client + server)
npm run install-all

# Create server/.env:
# MONGO_URI=<your MongoDB connection string>
# JWT_SECRET=<your secret>
# ADMIN_USERNAME=<username>
# ADMIN_PASSWORD=<password>

# Start the backend
npm start

# In a new terminal — start the frontend
cd client && npm run dev
```

Frontend: `http://localhost:5173` · Backend: `http://localhost:5001`

---

## 🌐 Deployment

Deployed as a **single service on Render**:
- React app is built to `client/dist/` and served as static files by Express
- MongoDB Atlas as cloud database
- Auto-deploys on every push to `main`

---

## 💡 Notable Engineering Decisions

| Decision | Reason |
|---|---|
| No UI library (pure CSS) | Full design control, no dependency bloat |
| Server-side Levenshtein search | No Elasticsearch or search index needed — keeps infra simple |
| Non-blocking order cleanup check | Save is instant; threshold check fires in background to avoid UX delay |
| Targeted emoji detection | Canvas detection runs only for known-problematic variation-selector emoji — never false-replaces supported ones |
| Form state persistence | Order drafts survive section navigation, only cleared on Cancel or successful save |

---

## 📸 Sections At a Glance

| Section | Description |
|---|---|
| **Dashboard** | Stats overview + recent activity |
| **New Order** | Full customer + measurement intake form |
| **Orders** | Searchable, filterable, sortable order ledger |
| **Production Queue** | Tailor's work view with delivery urgency sorting |
| **Stock Waitlist** | Customer waiting list with school filters |
| **Restock & Bulk Orders** | PO tracking + corporate CO management |
| **Settings** | Sessions, credentials, theme |

---

## 👤 Author

Built and maintained by **Advait K** — passionate about building practical tools that solve real business problems.

- GitHub: [@advaitk-7](https://github.com/advaitk-7)
