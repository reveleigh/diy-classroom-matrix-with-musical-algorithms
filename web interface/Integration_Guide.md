# Web Interface Integration Guide

This directory contains the Next.js frontend and API routes necessary to control your LED Matrix from the web. It has been built using [Next.js](https://nextjs.org/) (App Router) and [shadcn/ui](https://ui.shadcn.com/) components.

---

## 1. Merging with Your Next.js Project

The code inside the `app/` folder is designed to be dropped directly into an existing Next.js 13+ project using the App Router.

Simply copy the `app/led-matrix` and `app/api/matrix` folders into your project's `src/app/` (or `app/`) directory:
* **Dashboard URL:** Your dashboard will be accessible at `http://localhost:3000/led-matrix`.
* **API Endpoints:** Your Node-RED communication endpoints will live at `http://localhost:3000/api/matrix/...`.

## 2. Dependencies & UI Components

This dashboard relies heavily on [shadcn/ui](https://ui.shadcn.com/) components and [Lucide React](https://lucide.dev/) icons. 

Before running the dashboard, ensure you have installed the following in your Next.js project:

```bash
# Install Lucide Icons
npm install lucide-react

# Add the required Shadcn components (if using the Shadcn CLI)
npx shadcn-ui@latest add button card dialog switch tabs toast
```
*Note: If you are not using Shadcn, you may need to refactor the import paths (e.g., `import { Button } from "@/components/ui/button"`) to match your UI library.*

## 3. Environment Variables

To allow the Next.js API routes to securely communicate with your Node-RED proxy, add the following to your `.env.local` file at the root of your project:

```env
# The URL pointing to your Node-RED HTTP endpoint (e.g., if hosted on your local network or via a tunnel)
MATRIX_API_URL=https://your-node-red-instance.com/api/matrix-control

# An API key to authenticate requests against your Node-RED proxy (Optional, but highly recommended)
MATRIX_API_KEY=your_secret_key

# (Optional) If you are using the Navidrome music integration, configure these:
NAVIDROME_URL=http://your-navidrome-ip:4533
NAVIDROME_USER=your_username
NAVIDROME_PASS=your_password
```

## 4. Authentication (Optional)

In this public template, **server-side authentication has been removed** from `app/api/matrix/route.ts` to ensure it runs out-of-the-box. 

If you plan to expose this dashboard to the internet, it is strongly recommended that you re-implement authentication (such as Clerk, NextAuth, or simple password protection) inside the API routes to prevent unauthorized users from controlling your hardware.
