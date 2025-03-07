# Deployment Guide

This document outlines the process for deploying the Concrete Quotation System to production using Vercel and GitHub.

## Prerequisites

- A GitHub account
- A Vercel account (connected to your GitHub account)
- Access to your Supabase project

## Deployment Steps

### 1. Prepare Your Code

Before deploying, ensure your code is ready for production:

1. Run linting and fix any errors:
   ```bash
   npm run lint
   ```

2. Test your application locally:
   ```bash
   npm run build
   npm run start
   ```

3. Make sure all environment variables are correctly set up in your `.env.example` file (without real values).

### 2. Push to GitHub

1. Commit your changes:
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   ```

2. Push to your main branch:
   ```bash
   git push origin main
   ```

### 3. Deploy to Vercel

#### First-Time Deployment

1. Log in to [Vercel](https://vercel.com) using your GitHub account.

2. Click on "Add New..." → "Project" button.

3. Find and select your GitHub repository (`cotizaciones-concreto`).

4. Configure project settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: /
   - **Build Command**: `npm run build`
   - **Output Directory**: .next

5. Set up environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Your Supabase anonymous key
   - `NEXT_PUBLIC_SITE_URL`: Your Vercel deployment URL (or custom domain)
   - `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key

6. Click "Deploy" button.

#### Subsequent Deployments

For subsequent deployments, simply push changes to the `main` branch, and Vercel will automatically deploy your updates.

### 4. Custom Domain Setup (Optional)

To configure a custom domain:

1. Go to your project in the Vercel dashboard.
2. Navigate to "Settings" → "Domains".
3. Add your custom domain.
4. Follow Vercel's instructions to configure DNS settings with your domain provider.

### 5. Post-Deployment Verification

After deployment, verify:

1. Your application is accessible at the Vercel URL or custom domain.
2. Authentication works properly.
3. All features function as expected.
4. Database connections are working.

### 6. Rollbacks

If you need to roll back to a previous version:

1. Go to your project in the Vercel dashboard.
2. Navigate to "Deployments" tab.
3. Find the previous working deployment.
4. Click the three dots menu (⋮) and select "Promote to Production".

## Troubleshooting

### Common Deployment Issues

1. **Build Failures**:
   - Check Vercel build logs for specific errors.
   - Ensure your Next.js configuration is compatible with Vercel.
   - Verify all dependencies are correctly installed.

2. **Environment Variables Issues**:
   - Double-check that all required environment variables are set in Vercel.
   - Make sure the variable names match what's used in the code.

3. **Database Connection Problems**:
   - Verify your Supabase security rules allow connections from your Vercel deployment.
   - Check if your Supabase project has any restrictions on API requests.

4. **Authentication Not Working**:
   - Ensure the site URL in Supabase matches your deployment URL.
   - Verify your authentication middleware is correctly configured.

## Deployment Checklist

- [ ] All code changes are committed and pushed to GitHub
- [ ] Environment variables are configured in Vercel
- [ ] Build completes successfully
- [ ] Site is accessible at deployment URL
- [ ] Authentication works correctly
- [ ] Database connections are functioning
- [ ] All major features work as expected
- [ ] Security headers and settings are properly configured 