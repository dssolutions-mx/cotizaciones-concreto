# Development Environment Setup Guide

This guide will help you set up a productive development environment for working on the Concrete Quotation System project.

## Required Software

### Core Requirements

1. **Node.js and npm**
   - Download and install from [nodejs.org](https://nodejs.org/)
   - Recommended version: 18.x LTS or newer
   - Verify installation:
     ```bash
     node --version
     npm --version
     ```

2. **Git**
   - Download and install from [git-scm.com](https://git-scm.com/)
   - Verify installation:
     ```bash
     git --version
     ```

3. **Code Editor**
   - We recommend [Visual Studio Code](https://code.visualstudio.com/) (VS Code)
   - Other good options include WebStorm, Sublime Text, or Atom

### Additional Tools

1. **GitHub Desktop** (optional, but recommended for beginners)
   - Download from [desktop.github.com](https://desktop.github.com/)
   - Provides a user-friendly interface for Git operations

2. **Supabase CLI** (optional, for database work)
   - Install via npm:
     ```bash
     npm install -g supabase
     ```

## Setting Up VS Code (Recommended)

If you're using VS Code, here are recommended extensions and settings:

### Essential Extensions

Install these extensions to improve your development experience:

1. **ESLint** - For code linting
2. **Prettier** - For code formatting
3. **GitLens** - For enhanced Git functionality
4. **Tailwind CSS IntelliSense** - For Tailwind CSS support
5. **TypeScript Vue Plugin (Volar)** - For TypeScript support
6. **Error Lens** - For better error highlighting

To install an extension:
1. Click on the Extensions icon in the sidebar
2. Search for the extension name
3. Click "Install"

### Recommended Settings

Create a `.vscode/settings.json` file in your project root with these settings:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "typescript",
    "javascriptreact",
    "typescriptreact"
  ],
  "files.eol": "\n",
  "files.insertFinalNewline": true,
  "files.trimTrailingWhitespace": true,
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

## Project Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/dssolutions-mx/cotizaciones-concreto.git
   cd cotizaciones-concreto
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   - Copy `.env.example` to `.env.local`:
     ```bash
     cp .env.example .env.local
     ```
   - Edit `.env.local` and add your Supabase credentials

4. **Start the development server**:
   ```bash
   npm run dev
   ```
   - The application should now be running at [http://localhost:3000](http://localhost:3000)

## Setting Up for Database Work

If you'll be working with the Supabase database:

1. **Create a Supabase account** at [supabase.com](https://supabase.com/)

2. **Request access** to the project's Supabase instance from your team lead

3. **Optional: Set up local database** for development:
   ```bash
   supabase init
   supabase start
   ```

## Setting Up Git

Configure Git with your identity:

```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

For better Git experience, consider these additional configurations:

```bash
# Set default branch to main
git config --global init.defaultBranch main

# Setup a helpful git log format
git config --global alias.lg "log --color --graph --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' --abbrev-commit"
```

## Common Development Tasks

### Starting Development

```bash
# Get latest changes
git pull origin main

# Create a new branch
git checkout -b feature/your-feature-name

# Start the dev server
npm run dev
```

### Building for Production

```bash
npm run build
npm start
```

### Running Linting

```bash
npm run lint
```

## Troubleshooting Common Issues

### Node.js Version Issues

If you encounter errors related to Node.js version:
1. Install [nvm (Node Version Manager)](https://github.com/nvm-sh/nvm)
2. Use nvm to install and use the correct Node.js version:
   ```bash
   nvm install 18
   nvm use 18
   ```

### Package Installation Errors

If you encounter errors when installing packages:
1. Delete the `node_modules` directory and `package-lock.json` file
2. Run `npm install` again

### Git Authentication Issues

If you have trouble authenticating with GitHub:
1. Consider using [GitHub CLI](https://cli.github.com/) for easier authentication
2. Or set up SSH keys following [GitHub's guide](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)

## Getting Help

If you encounter any issues setting up your development environment:

1. Check existing documentation in the `/docs` directory
2. Ask a team member for help
3. Search for solutions online
4. Document the solution for future reference

Remember, setting up a development environment can sometimes be challenging, but it's a one-time process that will make your ongoing development work much smoother. 