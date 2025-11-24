# GitHub Pages Deployment Guide

This guide provides step-by-step instructions for deploying the Bloracle dashboard to GitHub Pages and troubleshooting common issues.

## Prerequisites

- GitHub account with repository access
- Node.js 18+ installed locally
- Git configured with repository remote

## Initial Setup

### Repository Configuration

1. **Ensure repository name matches base path in `vite.config.js`** (currently `bloracle`)
   - The base path must match your repository name with slashes: `/bloracle/`
   - Repository must be public or have GitHub Pro for private repo Pages
   - Enable GitHub Actions in repository settings

2. **Verify `vite.config.js` configuration:**
   ```js
   base: '/bloracle/',  // Must match repo name with slashes
   ```

### Local Build Test

Before deploying, test the production build locally:

```bash
npm install
npm run build
npm run preview
```

- Visit `http://localhost:4173/bloracle/` to test production build
- Verify all features work correctly
- Check browser console for errors
- Test all interactive features (graph, timeline, table sorting/filtering)

### GitHub Actions Workflow

- Workflow file located at `.github/workflows/deploy.yml`
- Triggers on push to `main` branch
- Builds project and deploys to `gh-pages` branch automatically
- No manual intervention required after initial setup

## Deployment Process

### Commit and Push Changes

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

### Monitor Deployment

1. Go to repository → **Actions** tab
2. Watch the "Deploy to GitHub Pages" workflow run
3. Typical deployment time: 2-3 minutes
4. Green checkmark indicates success

### Verify Deployment

1. Visit `https://mpjnnn.github.io/bloracle/`
2. Test all features:
   - Probability graph renders correctly
   - Stats panel shows live data
   - Block timeline is interactive
   - Block table loads and is sortable/filterable
   - Auto-refresh works (check after 60 seconds)
3. Test on multiple devices and browsers
4. Check browser DevTools Network tab for API calls
5. Verify no console errors

## Troubleshooting

### Blank Page After Deployment

**Symptoms:** Page loads but shows blank white screen

**Solutions:**

1. **Check browser console (F12) for errors**
   - Look for JavaScript errors or import failures
   - Check for CORS or network errors

2. **Verify base path in `vite.config.js` matches repository name:**
   ```js
   base: '/bloracle/',  // Must match repo name with slashes
   ```

3. **Ensure all imports use relative paths** (no absolute paths)
   - All imports should be relative to the file location
   - Example: `import { Component } from './components/Component.jsx'`

4. **Hard refresh browser:**
   - Windows/Linux: `Ctrl+Shift+R`
   - Mac: `Cmd+Shift+R`

5. **Clear browser cache completely**
   - Use incognito/private browsing mode to test
   - Clear site data from DevTools Application tab

### 404 Errors for Assets

**Symptoms:** CSS, JS, or image files return 404

**Solutions:**

1. **Verify base path includes trailing slash:** `/bloracle/`
   - Missing trailing slash can cause asset path resolution issues

2. **Check that `dist` folder is being uploaded in workflow**
   - Verify `.github/workflows/deploy.yml` uploads `dist` folder
   - Check Actions logs for upload confirmation

3. **Ensure `outDir: 'dist'` is set in `vite.config.js`**

4. **Clear GitHub Pages cache** by making a dummy commit:
   ```bash
   git commit --allow-empty -m "Clear cache"
   git push origin main
   ```

5. **Check asset paths in built files:**
   - Inspect `dist/index.html` to verify asset paths include base path
   - All asset URLs should start with `/bloracle/`

### Workflow Fails to Deploy

**Symptoms:** Red X in Actions tab, deployment fails

**Solutions:**

1. **Check Actions logs for specific error messages**
   - Click on failed workflow run
   - Expand error sections to see detailed logs

2. **Verify Node.js version in workflow** (currently 20) matches local version
   - Update workflow file if needed:
     ```yaml
     - uses: actions/setup-node@v3
       with:
         node-version: '20'
     ```

3. **Ensure all dependencies are in `package.json`** (not just devDependencies)
   - Production dependencies must be in `dependencies` section
   - Dev dependencies should be in `devDependencies`

4. **Check for TypeScript or linting errors** that prevent build
   - Run `npm run build` locally to catch build errors
   - Fix any TypeScript, ESLint, or build errors

5. **Verify GitHub Pages is enabled** in repository settings:
   - Repository → Settings → Pages
   - Source should be set to "GitHub Actions"

6. **Check repository permissions:**
   - Settings → Actions → General → Workflow permissions
   - Should be set to "Read and write"

7. **Verify repository secrets and variables** (if using any)
   - Check Settings → Secrets and variables → Actions

### API Calls Fail (CORS or Network Errors)

**Symptoms:** Data doesn't load, network errors in console

**Solutions:**

1. **Verify mempool.space API is accessible:**
   - Test endpoint: `https://mempool.space/api/v1/mining/pool/innopolistech`
   - Should return JSON data without authentication

2. **Check browser DevTools Network tab** for actual error response:
   - Look for failed requests (red status codes)
   - Check response headers for CORS errors
   - Verify request URLs are correct

3. **Ensure rate limiting is working** (see [`/src/services/mempoolApi.js`](src/services/mempoolApi.js))
   - Rate limiter should prevent exceeding 10 req/sec
   - Check console for rate limit warnings

4. **Try different pool slug** if current one is invalid:
   - Update pool slug in `PoolDataContext.jsx`
   - Valid pool slugs can be found on mempool.space

5. **Check if API endpoint has changed** (refer to [`/docs/API_CONTEXT.md`](docs/API_CONTEXT.md))
   - API documentation may have updated endpoints
   - Verify API version compatibility

### Stale Content After Update

**Symptoms:** Changes don't appear after deployment

**Solutions:**

1. **Hard refresh browser** to clear cache:
   - Windows/Linux: `Ctrl+Shift+R`
   - Mac: `Cmd+Shift+R`

2. **Check Actions tab** to confirm latest workflow completed successfully:
   - Verify commit SHA in deployment matches latest commit
   - Ensure workflow shows green checkmark

3. **Clear browser cache completely:**
   - Use DevTools Application tab → Clear storage
   - Or use incognito/private browsing mode

4. **Verify commit was pushed to correct branch:**
   - Default branch should be `main` (or `master`)
   - Check that workflow triggers on correct branch

5. **Check if service worker is caching old content:**
   - Currently not applicable for this project
   - If service workers are added later, unregister them

6. **Wait a few minutes:**
   - GitHub Pages CDN may take 1-5 minutes to update
   - Try accessing site from different network

## Manual Deployment (Alternative)

If GitHub Actions is not available or preferred:

```bash
npm run build
npm run deploy
```

This uses `gh-pages` package to deploy `dist` folder to `gh-pages` branch manually.

**Note:** Manual deployment requires `gh-pages` package installed:
```bash
npm install --save-dev gh-pages
```

## Custom Domain Setup (Optional)

To use a custom domain instead of `github.io`:

1. **Add CNAME file to `public` folder** with your domain:
   ```
   example.com
   ```

2. **Configure DNS records** with your domain provider:
   - **A records** pointing to GitHub Pages IPs:
     - `185.199.108.153`
     - `185.199.109.153`
     - `185.199.110.153`
     - `185.199.111.153`
   - **Or CNAME record** pointing to `mpjnnn.github.io`

3. **Update `base` in `vite.config.js`** to `'/'` for root domain:
   ```js
   base: '/',  // Root domain
   ```

4. **Enable HTTPS** in repository settings → Pages
   - GitHub Pages automatically provisions SSL certificates
   - May take a few hours to activate

5. **Wait for DNS propagation** (can take up to 48 hours)

## Performance Monitoring

After deployment, monitor the following:

- **Page load time:** Should be <3s on good connection
- **API response times:** mempool.space typically <500ms
- **Browser console:** Check for warnings or errors
- **Memory usage:** Check DevTools Performance tab
- **Network requests:** Should see caching working after first load
- **Lighthouse scores:** Run Lighthouse audit for performance metrics

### Recommended Monitoring Tools

- Browser DevTools Performance tab
- Lighthouse (built into Chrome DevTools)
- Google PageSpeed Insights
- Browser Network tab for API call monitoring

## Rollback Procedure

If deployment introduces critical bugs:

### Option 1: Revert Commit

```bash
git revert HEAD
git push origin main
```

GitHub Actions will automatically deploy the reverted version.

### Option 2: Manual Rollback to Previous Version

```bash
# Find previous commit SHA from git log
git log --oneline

# Checkout previous version
git checkout <previous-commit-sha>
npm run build
npm run deploy
git checkout main
```

### Option 3: Restore Previous Workflow Run

1. Go to Actions tab
2. Find last successful workflow run
3. Click "Re-run jobs" (if available)
4. Or manually deploy using previous commit

## Security Considerations

- **No sensitive data:** All data from public API, no authentication required
- **No API keys needed:** mempool.space API is public and doesn't require keys
- **Rate limiting:** Built-in rate limiter prevents abuse
- **HTTPS enforced:** GitHub Pages automatically enforces HTTPS
- **No user data collection:** No cookies, tracking, or user data storage
- **XSS protection:** React automatically escapes content
- **CSP headers:** Consider adding Content Security Policy headers if needed

## Support and Resources

### Documentation

- **GitHub Pages Documentation:** https://docs.github.com/en/pages
- **Vite Deployment Guide:** https://vitejs.dev/guide/static-deploy.html
- **Mempool.space API Docs:** https://mempool.space/docs/api

### Project Resources

- **Project Issues:** https://github.com/mpjnnn/bloracle/issues
- **API Context:** [`/docs/API_CONTEXT.md`](API_CONTEXT.md)
- **Component Documentation:** [`/src/components/README.md`](../src/components/README.md)

### Getting Help

If you encounter issues not covered in this guide:

1. Check the [troubleshooting section](#troubleshooting) above
2. Review Actions logs for error details
3. Test build locally with `npm run build` and `npm run preview`
4. Open an issue on GitHub with:
   - Error messages from console
   - Actions workflow logs
   - Steps to reproduce
   - Browser and OS information

## Best Practices

1. **Always test locally** before pushing to main branch
2. **Check Actions tab** after each deployment
3. **Monitor performance** after major changes
4. **Keep dependencies updated** regularly
5. **Document any custom configurations** in this file
6. **Use descriptive commit messages** for easier rollback
7. **Test on multiple browsers** before considering deployment successful

