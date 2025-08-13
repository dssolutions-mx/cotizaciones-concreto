# Setting Up Continuous Integration/Continuous Deployment (CI/CD)

This guide explains how to set up a basic CI/CD workflow for the Concrete Quotation System project using GitHub Actions and Vercel.

## What is CI/CD?

**Continuous Integration (CI)** means automatically testing your code every time you push changes.

**Continuous Deployment (CD)** means automatically deploying your code when it passes tests.

Benefits:
- Catches errors early
- Ensures code quality
- Makes deployments faster and more reliable
- Reduces manual tasks

## Prerequisites

- GitHub repository for your project
- Vercel account connected to GitHub
- Basic understanding of YAML syntax

## Setting Up GitHub Actions for CI

GitHub Actions is a feature that helps you automate tasks within your software development workflow.

### Step 1: Create a Workflow File FFF

1. Create a directory in your project:
   ```bash
   mkdir -p .github/workflows
   ```

2. Create a YAML file for your workflow:
   ```bash
   touch .github/workflows/ci.yml
   ```

### Step 2: Define Your CI Workflow

Open the `ci.yml` file and add the following content:

```yaml
name: CI

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v2
    
    - name: Set up Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Lint the code
      run: npm run lint
      
    - name: Build
      run: npm run build
      env:
        NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

### Step 3: Add Secrets to GitHub

For the CI workflow to run successfully, add your environment secrets:

1. Go to your GitHub repository
2. Click on "Settings" -> "Secrets and variables" -> "Actions"
3. Click "New repository secret"
4. Add each of your environment variables:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY

## Setting Up Vercel for CD

Vercel already has built-in CD capabilities that work with GitHub, but let's configure it optimally.

### Step 1: Configure Vercel Project Settings

1. Go to your Vercel dashboard
2. Select your project
3. Click on "Settings" -> "Git"
4. Ensure these settings are configured:
   - Production Branch: `main`
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Install Command: `npm ci` (more reliable than npm install)

### Step 2: Configure Preview Deployments

Preview deployments are temporary deployments that are created for Pull Requests.

In the same Git settings:
1. Make sure "Preview Deployment" is enabled
2. Configure any additional build settings

## Setting Up Branch Protection Rules

Branch protection ensures code quality by requiring certain conditions before merging code.

1. Go to your GitHub repository
2. Click on "Settings" -> "Branches"
3. Click "Add rule" next to "Branch protection rules"
4. In "Branch name pattern" enter `main`
5. Enable the following options:
   - "Require pull request reviews before merging"
   - "Require status checks to pass before merging"
   - Select your CI workflow as a required status check
   - "Include administrators" (optional, but recommended)
6. Click "Create"

## Advanced CI/CD Setup (Optional)

As your project grows, consider adding these advanced features:

### Add Automated Testing

Modify your CI workflow to run tests:

```yaml
- name: Run tests
  run: npm test
```

### Add Code Coverage Reporting

```yaml
- name: Generate code coverage
  run: npm test -- --coverage
  
- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v1
```

### Add Storybook Deployment

If you use Storybook for component documentation:

```yaml
- name: Build Storybook
  run: npm run build-storybook
  
- name: Deploy to Chromatic
  uses: chromaui/action@v1
  with:
    projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
```

## Understanding the Workflow

Here's how the full CI/CD workflow operates:

1. You push code to a feature branch
2. GitHub Actions runs the CI workflow to check your code
3. You create a Pull Request to merge into main
4. Vercel creates a preview deployment
5. Team members review your code
6. When approved and CI passes, the PR can be merged
7. When merged to main, Vercel automatically deploys to production

## Troubleshooting CI/CD

### CI Build Failures

If your GitHub Actions workflow fails:
1. Click on the failing workflow in the GitHub Actions tab
2. Read the logs to identify the specific error
3. Fix the issue locally, commit, and push again

### Vercel Deployment Failures

If your Vercel deployment fails:
1. Check the Vercel deployment logs
2. Common issues include:
   - Missing environment variables
   - Build errors
   - Incompatible dependencies

## Conclusion

Setting up CI/CD may seem complicated at first, but it saves a tremendous amount of time and prevents many errors in the long run. Start with a simple setup, and add more advanced features as your team and project grow.

Remember, the goal of CI/CD is to make development more efficient and reliable, not to add complexity. If something isn't working well, simplify it until it does. 