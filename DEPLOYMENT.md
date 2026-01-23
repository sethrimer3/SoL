# GitHub Pages Deployment Guide

This document explains how to deploy SoL to GitHub Pages.

## Automatic Deployment

The game is automatically deployed to GitHub Pages from the `dist` folder.

### Setup Steps

1. **Enable GitHub Pages in Repository Settings:**
   - Go to Settings → Pages
   - Source: Deploy from a branch
   - Branch: Select your main/master branch
   - Folder: Select `/dist`
   - Click Save

2. **The game will be available at:**
   ```
   https://sethrimer3.github.io/SoL/
   ```

## Manual Deployment

If you prefer to deploy manually:

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Commit the dist folder:**
   ```bash
   git add dist/
   git commit -m "Build for deployment"
   git push
   ```

3. **GitHub Pages will automatically serve from the dist folder.**

## Custom Domain (Optional)

To use a custom domain:

1. Add a `CNAME` file to the `src/` folder with your domain name
2. Update `webpack.config.js` to copy the CNAME file to dist
3. Configure your domain's DNS settings to point to GitHub Pages

## Build Configuration

The build process:
- Compiles TypeScript to JavaScript
- Bundles all code using Webpack
- Minifies for production
- Outputs to `dist/` folder

## Troubleshooting

- **404 Error:** Make sure the dist folder is committed and pushed
- **Blank Page:** Check browser console for errors
- **Assets Not Loading:** Verify the base path in webpack config
