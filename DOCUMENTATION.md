# Concrete Quotation System Documentation

## Overview
This project is a web-based application for managing concrete quotations. It allows users to create, track, and manage price histories and quotations for concrete products based on various specifications and client requirements.

## Table of Contents
1. [Getting Started](#getting-started)
2. [Project Structure](#project-structure)
3. [System Architecture](#system-architecture)
4. [Key Features](#key-features)
5. [Database Schema](#database-schema)
6. [Authentication and Authorization](#authentication-and-authorization)
7. [Deployment Process](#deployment-process)
8. [Environment Variables](#environment-variables)
9. [Common Issues and Solutions](#common-issues-and-solutions)
10. [Development Workflow](#development-workflow)

## Detailed Documentation

For more detailed documentation, see the following files:

- [Development Environment Setup](./docs/DEV_ENVIRONMENT_SETUP.md) - How to set up your development environment
- [Development Workflow Guide](./docs/DEVELOPMENT_WORKFLOW.md) - How to work with Git and our development process
- [Deployment Guide](./docs/DEPLOYMENT.md) - How to deploy the application
- [CI/CD Setup](./docs/CI_CD_SETUP.md) - How to set up and use Continuous Integration/Deployment

---

## Getting Started

### Prerequisites
- Node.js (v18 or later)
- npm or yarn
- Git
- A Supabase account

### Local Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/dssolutions-mx/cotizaciones-concreto.git
   cd cotizaciones-concreto
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file based on the `.env.example`:
   ```bash
   cp .env.example .env.local
   ```

4. Update the environment variables in `.env.local` with your Supabase credentials.

5. Start the development server:
   ```bash
   npm run dev
   ```

---

## Project Structure
The project follows a Next.js application structure:

- `/src/app`: Contains the main application pages and layouts
- `/src/components`: Reusable UI components
- `/src/lib`: Utility functions and service integrations
- `/src/services`: Data services for API interactions
- `/src/types`: TypeScript type definitions
- `/src/contexts`: React contexts for state management
- `/public`: Static assets
- `/docs`: Project documentation

Key files:
- `next.config.ts`: Next.js configuration
- `middleware.ts`: Authentication middleware
- `tailwind.config.js`: Tailwind CSS configuration

---

## System Architecture
[Detailed explanation of the system architecture will be added here]

---

## Key Features
[Detailed explanation of key features will be added here]

---

## Database Schema
[Detailed explanation of the database schema will be added here]

---

## Authentication and Authorization
[Detailed explanation of auth system will be added here]

---

## Deployment Process

See [Deployment Guide](./docs/DEPLOYMENT.md) for a comprehensive guide to deploying the application.

---

## Environment Variables

The application requires the following environment variables:

```
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Site Configuration
NEXT_PUBLIC_SITE_URL=your_site_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

---

## Common Issues and Solutions
[List of common issues and their solutions]

---

## Development Workflow

See [Development Workflow Guide](./docs/DEVELOPMENT_WORKFLOW.md) for a comprehensive guide to our development process. 