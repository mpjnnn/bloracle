# Bloracle - BTC Pool Block Prediction Dashboard

A statistical analysis dashboard that predicts the next BTC block for mining pools using Poisson probability calculations.

## Features

- **Probability Graphs**: Visual representation of block prediction probabilities over time
- **Block Timeline**: Interactive timeline showing recent blocks and predictions
- **Stats Panel**: Real-time statistics and metrics for mining pools
- **Historical Analysis**: Historical data analysis and trends

## Tech Stack

- **React** - UI framework
- **Vite** - Build tool and development server
- **Tailwind CSS** - Utility-first CSS framework
- **Recharts** - Charting library for data visualization

## Installation

```bash
npm install
```

## Development

Run the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

Deploy to GitHub Pages:

```bash
npm run deploy
```

## Data Sources

The dashboard fetches data from mempool.space API endpoints for real-time Bitcoin mining pool information. See [`/docs/API_CONTEXT.md`](docs/API_CONTEXT.md) for detailed API documentation and formulas.

## Architecture Overview

- **Data Flow:** API → Services → Context → Hooks → Components
- **State Management:** React Context API (PoolDataContext) for global state
- **Calculations:** Pure functions in [`/src/utils/poissonCalculations.js`](src/utils/poissonCalculations.js) for statistical analysis
- **Styling:** Tailwind CSS with custom theme (navy/orange) defined in [`tailwind.config.js`](tailwind.config.js)
- **Error Handling:** ErrorBoundary component catches React errors, ApiError class for API failures

Component structure is documented in [`/src/components/README.md`](src/components/README.md).

## Performance Optimization

The dashboard includes several performance optimizations:

- **React.memo:** All major components (Dashboard, ProbabilityGraph, StatsPanel, BlockTimeline, BlockTable) are memoized to prevent unnecessary re-renders
- **Virtualization:** BlockTable uses `react-window` to efficiently render large lists - only visible rows are in the DOM, dramatically improving performance with 100+ blocks
- **Auto-polling:** Data refreshes every 60 seconds automatically, with pause when browser tab is hidden (using `document.visibilityState` API) to save resources and API calls
- **Caching:** API responses are cached in localStorage (see [`/src/services/mempoolApi.js`](src/services/mempoolApi.js)) with TTLs to minimize API calls
- **Rate limiting:** Built-in rate limiter ensures compliance with mempool.space API limits (10 req/sec)

## Deployment Testing Checklist

Before deploying to GitHub Pages, verify the following:

### Pre-deployment Checks

- [ ] Verify `base: '/bloracle/'` is set in [`vite.config.js`](vite.config.js)
- [ ] Ensure `package.json` has correct repository URL
- [ ] Check that `.github/workflows/deploy.yml` is configured correctly
- [ ] Run `npm run build` locally to verify build succeeds
- [ ] Test production build locally with `npm run preview` and visit `http://localhost:4173/bloracle/`

### GitHub Repository Settings

- [ ] Navigate to repository Settings → Pages
- [ ] Verify Source is set to "GitHub Actions"
- [ ] Check that custom domain is not set (unless intentional)
- [ ] Ensure repository is public (or GitHub Pro for private repos)

### Post-deployment Verification

- [ ] Check Actions tab for successful workflow run
- [ ] Visit `https://mpjnnn.github.io/bloracle/` to verify deployment
- [ ] Test all features:
  - [ ] Probability graph renders correctly
  - [ ] Stats panel shows live data
  - [ ] Block timeline is interactive
  - [ ] Block table loads and is sortable/filterable
  - [ ] Auto-refresh works (check after 60 seconds)
- [ ] Verify API calls work (check browser DevTools Network tab)
- [ ] Test on mobile devices and different browsers
- [ ] Check console for errors or warnings

### Common Issues and Fixes

- **Blank page:** Check browser console for errors, verify base path in `vite.config.js` matches repository name
- **404 errors for assets:** Ensure base path includes trailing slash `/bloracle/`
- **API CORS errors:** mempool.space API should allow cross-origin requests; check network tab for actual error
- **Workflow fails:** Check Actions logs, verify Node.js version compatibility, ensure all dependencies are in package.json
- **Stale cache:** Hard refresh browser (Ctrl+Shift+R or Cmd+Shift+R) or clear cache

For detailed deployment instructions and troubleshooting, see [`/docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Development Tips

- Use `npm run dev` for hot-reload development server
- Run `npm run test` to execute unit tests for statistical calculations
- Check [`/docs/API_CONTEXT.md`](docs/API_CONTEXT.md) for API documentation and formulas
- Component structure documented in [`/src/components/README.md`](src/components/README.md)
- Use browser DevTools React extension to inspect component re-renders and props

## License

MIT

## Live Demo

[View on GitHub Pages](https://mpjnnn.github.io/bloracle/)


