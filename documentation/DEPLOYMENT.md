# GitHub Pages Deployment Guide

This document explains how to deploy SoL to GitHub Pages.

## Automatic Deployment

The game is automatically deployed to GitHub Pages via GitHub Actions whenever changes are pushed to the `main` branch.

### How It Works

1. **GitHub Actions Workflow** (`.github/workflows/build-and-deploy.yml`):
   - Automatically triggers on every push to `main`
   - Installs dependencies with `npm ci`
   - Builds the project with `npm run build` (includes Supabase secrets if configured)
   - Uploads the built `dist/` folder as a GitHub Pages artifact
   - Deploys the artifact to GitHub Pages

2. **No Manual Steps Required**:
   - The `dist/` folder is **not committed** to the repository
   - GitHub Actions builds and deploys it automatically
   - The workflow uses the official `actions/upload-pages-artifact@v3` and `actions/deploy-pages@v4` actions

### Setup Steps

1. **Enable GitHub Pages in Repository Settings:**
   - Go to Settings → Pages
   - Source: Select "GitHub Actions" (not "Deploy from a branch")
   - The workflow will handle the rest automatically

2. **Configure Secrets (Optional - for Multiplayer):**
   - Go to Settings → Secrets and variables → Actions
   - Add repository secrets:
     - `SUPABASE_URL`: Your Supabase project URL
     - `SUPABASE_ANON_KEY`: Your Supabase anonymous key
   - These are injected during the build process

3. **The game will be available at:**
   ```
   https://sethrimer3.github.io/SoL/
   ```

## Manual Local Build

To build and test locally before pushing:

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Serve locally for testing:**
   ```bash
   cd dist
   python3 -m http.server 8080
   # Or use any other static file server
   ```

3. **Push to trigger deployment:**
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin main
   ```
   The GitHub Actions workflow will automatically build and deploy.

## Development Workflow

For local development with hot-reload:
```bash
npm run dev
```

Then open `index.html` in your browser or use a local development server.

## Troubleshooting

### Deployment Failures
- Check the Actions tab in GitHub to see workflow run logs
- Ensure GitHub Pages is configured to use "GitHub Actions" as the source
- Verify that secrets are properly configured if using multiplayer features

### 404 Error
- Verify GitHub Pages is enabled in repository settings
- Check that the workflow completed successfully in the Actions tab
- The site may take 1-2 minutes to update after deployment

### Blank Page or Console Errors
- Check browser console for JavaScript errors
- Verify that the build completed without errors in the Actions logs
- Test the build locally first with `npm run build && cd dist && python3 -m http.server`

### Assets Not Loading
- Ensure webpack config has correct output settings
- Verify all required files are in the dist folder after build
- Check browser network tab for 404s

## Custom Domain (Optional)

To use a custom domain:

1. Add a `CNAME` file to the `src/` folder with your domain name
2. Update `webpack.config.js` to copy the CNAME file to dist:
   ```javascript
   const CopyPlugin = require('copy-webpack-plugin');
   plugins: [
     new CopyPlugin({
       patterns: [{ from: 'src/CNAME', to: 'CNAME' }]
     })
   ]
   ```
3. Configure your domain's DNS settings to point to GitHub Pages
4. Update the custom domain in repository Settings → Pages

## Build Configuration

The build process:
- Compiles TypeScript to JavaScript
- Bundles all code using Webpack
- Injects environment variables (Supabase credentials)
- Minifies for production
- Outputs to `dist/` folder (excluded from git, deployed by Actions)
