# Components Directory

This directory contains all React UI components for the BTC Pool Block Prediction Dashboard.

## Component Hierarchy

- **App.jsx** (root): Wraps Dashboard with PoolDataProvider
- **Dashboard.jsx**: Main layout component
  - **ProbabilityGraph.jsx**: Recharts-based probability curve visualization
  - **StatsPanel.jsx**: Real-time metrics display
  - **BlockTimeline.jsx**: Interactive block timeline with heatmap
  - **BlockTable.jsx**: Sortable/filterable block data table
- **Utility Components**:
  - **LoadingSpinner.jsx**: Loading state indicator
  - **ErrorDisplay.jsx**: Error state display with retry

## Data Flow

1. PoolDataProvider (context) fetches data from API services
2. Components access data via usePoolData hook
3. Statistical calculations performed using poissonCalculations utilities
4. UI updates reactively when data changes

## Styling

All components use Tailwind CSS with custom theme:
- Background: navy (#0a1929), navy-light (#1a2332)
- Accent: accent-orange (#ff8c42)
- Borders: black
- Text: white

## State Management

Shared state managed via PoolDataContext:
- Pool blocks and info
- Analysis results
- Selected blocks
- Loading/error states

See `/src/contexts/PoolDataContext.jsx` and `/src/hooks/usePoolData.js` for details.



