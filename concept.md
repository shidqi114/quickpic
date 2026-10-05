# QuickPic — The Grand Concept & Architecture

## 1. Executive Summary & Grand Vision
**QuickPic** is an intelligent, multi-tenant automated photobooth ecosystem built for photo entertainment vendors, event agencies, and permanent venues who manage **fleets of physical photobooths**. 

Combining reliable dedicated hardware (Canon DSLR cameras, DNP dye-sublimation photo printers) with modern web and cloud technologies (Next.js App Router, Tailwind CSS, Electron, Cloudinary, and relational cloud data with PostgreSQL/Supabase), QuickPic empowers a single **Owner (Vendor)** to configure, monitor, monetize, and remotely supervise multiple **Photobooth stations** across various venues from a unified dashboard.

Every subagent working on this codebase must align strictly with the principles and architectural boundaries established in this document.

---

## 2. Multi-Tenant Ecosystem Hierarchy

The architecture is modeled around a hierarchical, multi-tenant structure:

```mermaid
erDiagram
    OWNER ||--o{ PHOTOBOOTH : "owns and operates"
    PHOTOBOOTH ||--o{ SESSION : "records guest sessions"
    PHOTOBOOTH ||--o{ TELEMETRY : "pings health heartbeats"
    PHOTOBOOTH ||--o{ BOOTH_SETTING : "configures branding & themes"
    OWNER ||--o{ VOUCHER : "issues promo codes"
    OWNER ||--o{ POS_ITEM : "manages inventory"

    OWNER {
        string id PK "Vendor UUID / auth.uid"
        string business_name "e.g. SnapStudio Inc"
        string email "Owner login email"
        string plan_tier "free | pro | enterprise"
        timestamp created_at
    }

    PHOTOBOOTH {
        string id PK "e.g. booth-jkt-01"
        string owner_id FK "References OWNER(id)"
        string name "e.g. Grand Indonesia Booth A"
        string location "Venue or Event Name"
        string device_token "Cryptographic secret for kiosk API auth"
        string pairing_code "Short PIN to pair kiosk desktop"
        string status "online | offline | maintenance"
        timestamp last_heartbeat_at
    }

    SESSION {
        string id PK "Session UUID / nanoId"
        string booth_id FK "References PHOTOBOOTH(id)"
        string package_id "strip | 4r | vip"
        json raw_photos "Array of photo URLs"
        string composite_url "Final render URL"
        json live_photos "Boomerang GIF/video URLs"
        json payment "Simulated QRIS / Cash details"
        string guest_download_url
        timestamp created_at
    }

    TELEMETRY {
        string id PK
        string booth_id FK "References PHOTOBOOTH(id)"
        int ribbon_remaining "DNP cuts remaining (0-700)"
        float cpu_pct "PC CPU usage"
        float ram_pct "PC RAM usage"
        boolean camera_connected "Canon DSLR USB status"
        boolean printer_connected "DNP printer status"
        timestamp pinged_at
    }
```

---

## 3. LumaBooth-Style Operator Setup & Kiosk Experience

```mermaid
flowchart TD
    subgraph SetupWizard ["1. Operator Setup Wizard (LumaBooth Style)"]
        M1["Mode Selector: Event (No Paywall) vs Regular (Paywall)"]
        M2["Capture Modes: Photo | GIF | Boomerang | Video"]
        M3["Print Layout Canvas Builder\n(Draggable Slots, Edge & Center Snapping, Dotted Guides)"]
        M4["Capture Settings (Timers, Countdowns, Review Duration)"]
        M1 --> M2 --> M3 --> M4
    end

    subgraph GuestFlow ["2. Customer Kiosk Experience"]
        W["Welcome Screen"]
        PAY{"Mode === 'Regular'?"}
        PAY_MODAL["Payment Modal (Simulated QRIS / PIN)"]
        CAP["Camera Session\n(Countdown -> Audible Beep -> Shutter)"]
        RETAKE["Tap 'X' on Photo Slot -> Reset Timer & Auto-Start Shutter Countdown"]
        POST1["Step 1: Pick Photos for Strip Slots"]
        POST2["Step 2: Uneven Split-Screen Editor\nLeft (35%): Strip Highlight\nRight (65%): Enlarged Editor + Filters + Free Stickers"]
        RES["Instant DNP Print & Cloud QR Share (Cloudinary CDN URL)"]

        W --> PAY
        PAY -- Yes --> PAY_MODAL --> CAP
        PAY -- No (Event) --> CAP
        CAP -.-> RETAKE -.-> CAP
        CAP --> POST1 --> POST2 --> RES
    end

    M4 --> W
```

### Core Experience Guidelines:
1. **Operator Setup (LumaBooth Style)**:
   - **Mode Selection**: Operator chooses **Event Mode** (free guest experience, zero paywall gatekeeping) or **Regular Mode** (monetized with simulated QRIS / cash bypass).
   - **Capture Modes**: Toggle active capture capabilities (**Photo**, **GIF**, **Boomerang**, **Video**).
   - **Interactive Print Layout Builder**: Full drag-and-drop canvas allowing the operator to position photo slots on the paper canvas.
     - **Snapping**: Snaps to Top, Bottom, Left, Right of adjacent slots, and snaps to Horizontal / Vertical center of the canvas.
     - **Visual Guides**: Spaced dotted lines appear on the canvas to indicate alignment lines in real-time.
   - **Capture Settings**: Configurable countdown seconds (e.g. 3–10s), delay between shots, and post-capture review time.
2. **Retake Auto-Reset & Auto-Start**:
   - When a guest clicks the 'x' button on an image slot during capture, the slot is cleared, and the countdown timer immediately resets and **auto-starts** the countdown sequence for the earliest empty slot without requiring additional button presses.
3. **Streamlined Slot Assignment & Removal of Zoom**:
   - Zoom/face framing controls are decommissioned to prevent awkward cropping.
   - Guests first select and map raw shots to strip slots, then proceed to the customization phase.
4. **Uneven Split-Screen Photo & Sticker Editor**:
   - **Left Panel (~35% width)**: Complete composite strip preview with visual highlighting around the active editing slot.
   - **Right Panel (~65% width)**: Enlarged active photo workspace with top toolbars for Filter selection and Sticker library.
   - **Free-Transform Stickers**: Stickers support free repositioning, scaling, and $360^\circ$ rotation handles.
5. **Universal Cloud QR Code Resolution**:
   - High-resolution composite images and Live Photo loops uploaded to Cloudinary CDN generate an externally accessible public URL (`https://quickpic-olive.vercel.app/gallery/[id]` or direct Cloudinary secure URL) so any mobile phone scanning the screen immediately loads the photo gallery.

---

## 4. Technology Stack & Database Selection

### Core Stack:
- **Frontend / Kiosk Application**: Next.js 16 (App Router), React 19, Tailwind CSS. Packaged for desktop kiosk operation via Electron.
- **Hardware Daemon**: Local Python daemon (`hardware-daemon/app.py` on port 8000) communicating with Canon EDSDK for cameras and local DNP printer drivers.
- **Media CDN**: Cloudinary for high-speed cloud asset storage, auto-optimizations, and mobile guest delivery.
- **Payment Processing**: **Frozen in Simulation Mode** (Dynamic QRIS simulation + Staff PIN bypass `1144`).
- **Database & Auth**: Firebase (Firebase Auth, Cloud Firestore, Firebase Storage) for multi-tenant relational persistence with hierarchical schema (`users/{userId}/outlets/{outletId}/events/{eventId}`) and offline `LocalStorage` buffering for physical kiosks.
- **Knowledge Engine**: Graphify (`graphify-out/graph.json`) for structured codebase memory.

---

## 5. Multi-Agent Team Responsibilities & Alignment

| Role | Domain | Primary Focus in Multi-Booth Vendor System |
|---|---|---|
| **1. Lead Engineer** | System Oversight & Governance | Architecture compliance, multi-tenant schema design, subagent orchestration. |
| **2. UI Engineer** | Visual Polish & Design System | LumaBooth setup wizard UI, interactive canvas layout builder with snapping, uneven split-screen editor, free-transform sticker layer. |
| **3. UX Engineer** | User Journey & Layout | State machine flow (Setup $\to$ Welcome $\to$ Capture $\to$ Slot Pick $\to$ Split Editor $\to$ Result), retake auto-start, touch ergonomics. |
| **4. Back-End Engineer** | APIs & Cloudinary | Public Cloudinary QR resolution, session saving, device pairing, and telemetry routes. |
| **5. Data Security Engineer** | Multi-Tenancy & Device Security | Event mode bypass validation, PostgreSQL RLS policies, kiosk device token gatekeeping. |
| **6. QA Engineer** | Code Quality & Unit Tests | Snapping algorithm unit tests, sticker rotation math tests, and QR link validation. |
| **7. QC Engineer** | Dynamic E2E & Browser Testing | End-to-end simulation of LumaBooth wizard, retake auto-start, split-screen editing, and mobile QR link opening. |
| **8. Research Analyst** | Market & Technology Intel | LumaBooth, Touchpix, and dslrBooth benchmark comparisons. |
| **9. Marketing Specialist** | Pricing & Growth Strategy | Event vs Regular package templates and promotional voucher rules. |
| **10. Finance Specialist** | Cost Control & Unit Economics | Consumables tracking (DNP paper/ribbon), Cloudinary usage limits, and margin control. |
