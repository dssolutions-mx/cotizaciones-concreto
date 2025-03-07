# Development Workflow for Beginners

This guide explains the development workflow for the Concrete Quotation System project, designed specifically for team members who are new to professional software development.

## Overview

A development workflow is a structured approach to writing, testing, and deploying code. Having a good workflow helps:

- Prevent code conflicts when multiple people work together
- Ensure code quality
- Make deployment safer and more predictable
- Provide a history of all changes

## Basic Git Concepts

Git is a version control system that helps track changes to code. Here are the core concepts:

### Repository (Repo)

A repository is like a project folder that Git tracks. Our main repository is on GitHub at `dssolutions-mx/cotizaciones-concreto`.

### Branch

A branch is like a separate version of the code. The main branch (called `main`) always contains the production code that is deployed to users.

### Commit

A commit is a saved set of changes. Think of it like a checkpoint in a video game - you can always go back to it.

### Push & Pull

- **Push**: Send your commits to the remote repository (GitHub)
- **Pull**: Get the latest changes from the remote repository to your local machine

## Our Development Workflow

### Step 1: Set Up Your Local Environment

1. Clone the repository (only needed once):
   ```bash
   git clone https://github.com/dssolutions-mx/cotizaciones-concreto.git
   cd cotizaciones-concreto
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your `.env.local` file with the correct environment variables.

### Step 2: Create a Branch for Your Work

Before making any changes, create a new branch:

```bash
# Get the latest changes from main
git pull origin main

# Create a new branch with a descriptive name
# Format: type/short-description
# Examples: feature/add-price-filter, fix/login-error
git checkout -b feature/your-feature-name
```

Types of branches:
- `feature/` - For new features
- `fix/` - For bug fixes
- `docs/` - For documentation changes
- `refactor/` - For code improvements without changing functionality

### Step 3: Make Your Changes

1. Work on your code changes.
2. Test your changes locally:
   ```bash
   npm run dev
   ```

3. Regularly commit your changes with clear messages:
   ```bash
   # Add specific files
   git add filename.tsx

   # Or add all changed files
   git add .

   # Commit with a descriptive message
   git commit -m "Add price filtering feature to dashboard"
   ```

   Good commit messages:
   - Start with a verb (Add, Fix, Update, Refactor)
   - Be specific about what changed
   - Keep under 50 characters if possible

### Step 4: Push Your Changes

When you're ready to share your work:

```bash
# Push your branch to GitHub
git push origin feature/your-feature-name
```

### Step 5: Create a Pull Request (PR)

A Pull Request is a request to merge your changes into the main branch.

1. Go to the GitHub repository
2. Click on "Pull Requests" → "New Pull Request"
3. Select your branch as the "compare" branch
4. Fill out the PR template with details about your changes
5. Request reviews from team members

### Step 6: Review and Merge

1. Address any feedback from reviewers
2. Once approved, your PR can be merged into main
3. After merging, your changes will be automatically deployed by Vercel

## Best Practices for Beginners

### Always Pull Before Starting Work

```bash
git checkout main
git pull origin main
git checkout -b your-new-branch
```

This ensures you're starting with the latest code.

### Commit Often

Make small, focused commits rather than one big commit with many changes.

### Keep Your Branch Updated

If the main branch has been updated while you're working:

```bash
# Save your current changes
git add .
git commit -m "Work in progress"

# Get the latest from main
git checkout main
git pull origin main

# Go back to your branch and update it with main's changes
git checkout your-branch
git merge main

# Resolve any conflicts that might occur
```

### Ask for Help

If you're stuck or unsure:
- Ask team members for help
- Use the GitHub Discussions feature
- Document what you learn for future reference

## Visual Reference

Here's a visual representation of our Git workflow:

```
main branch: A---B---C---D---E---F---G
                     \         /
feature branch:       X---Y---Z
```

- A-G: Commits on the main branch
- X-Z: Your feature development
- The arrow back to main: Your pull request being merged

## Common Git Commands Reference

```bash
# Check the status of your files
git status

# See your commit history
git log

# Discard changes to a file
git checkout -- filename

# Create a new branch and switch to it
git checkout -b branch-name

# Switch to an existing branch
git checkout branch-name

# List all branches
git branch

# Merge another branch into your current branch
git merge branch-name

# Delete a branch locally
git branch -d branch-name
```

## Next Steps for Learning

As you get more comfortable with this basic workflow, you can learn about:

1. Interactive rebasing
2. Squashing commits
3. Cherry-picking
4. Git hooks
5. Advanced branch strategies

Remember, everyone makes mistakes with Git. Don't be afraid to ask for help if you get stuck!

---

## FAQ for Beginners

### What if I made changes to the wrong branch?

Use `git stash` to save your changes, switch to the correct branch, then `git stash apply`.

### I've made a mess and want to start over. What do I do?

If you haven't committed yet, you can reset your changes:
```bash
git checkout -- .
```

If you have committed but not pushed:
```bash
# Go back to a specific commit
git reset --hard COMMIT_HASH

# Or go back to match the remote branch
git reset --hard origin/branch-name
```

### How do I resolve merge conflicts?

When Git says there's a conflict:
1. Open the conflicted files (they'll have special markers)
2. Edit the files to resolve the conflicts
3. Remove the conflict markers
4. Save the files
5. Add and commit the resolved files

### How can I see what changes I've made?

```bash
# See all uncommitted changes
git diff

# See changes that are staged for commit
git diff --staged
``` 