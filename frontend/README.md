# Training Dashboard Frontend

Modern, fast, and optimized frontend built with Vanilla JavaScript and Vite.

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm or yarn

### Installation

```bash
# Install dependencies
npm install
```

### Development

```bash
# Start development server with hot reload
npm run dev
```

The dev server will start at `http://localhost:8080` with:
- ⚡ Lightning-fast Hot Module Replacement (HMR)
- 🔧 Automatic proxy to backend API (`/api` → `http://localhost:8000`)
- 🎨 CSS hot reload
- 📦 On-demand module loading

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

Production build features:
- 📦 Code splitting for optimal loading
- 🗜️ Minification and tree-shaking
- 🎯 Asset optimization
- 📊 Build analysis and size reporting

## 📁 Project Structure

```
frontend/
├── index.html              # Auth page (login/register)
├── dashboard.html          # Main app page
├── main.js                 # Entry point for auth page
├── dashboard-main.js       # Entry point for dashboard
├── vite.config.js          # Vite configuration
├── package.json            # Dependencies and scripts
│
├── static/
│   ├── css/
│   │   ├── design-system/  # Design tokens, reset, utilities
│   │   ├── components/     # Reusable component styles
│   │   └── pages/          # Page-specific styles
│   │
│   └── js/
│       ├── core/           # Core modules (API, auth, router, state)
│       ├── pages/          # Page controllers
│       ├── components/     # Reusable UI components
│       ├── services/       # Business logic services
│       └── utils/          # Helper utilities
│
└── dist/                   # Production build output (generated)
```

## 🛠️ Development Workflow

### Running with Backend

1. **Start Backend** (Terminal 1):
   ```bash
   cd backend
   source venv/bin/activate  # or venv\Scripts\activate on Windows
   uvicorn app.main:app --reload --port 8000
   ```

2. **Start Frontend** (Terminal 2):
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access App**:
   - Frontend: `http://localhost:8080`
   - Backend API: `http://localhost:8000`
   - API Docs: `http://localhost:8000/docs`

### Key Features

#### API Proxy
Vite automatically proxies `/api/*` requests to the backend:
```javascript
// In your code, just use relative paths:
fetch('/api/activities')  // → http://localhost:8000/api/activities
```

#### Hot Module Replacement
Changes to JS/CSS are instantly reflected without full page reload:
- CSS: Instant updates
- JavaScript: Fast module replacement
- State preservation during development

#### Code Splitting
Production builds automatically split code into optimized chunks:
- `core.js` - Core utilities (API, auth, state, router)
- `charts.js` - Chart.js and visualization code
- `services.js` - Business logic services
- Page-specific chunks loaded on-demand

## 📦 Build Output

Production build creates optimized assets in `dist/`:

```
dist/
├── index.html                    # Auth page (optimized)
├── dashboard.html                # Dashboard (optimized)
└── assets/
    ├── css/
    │   ├── main-[hash].css      # Auth page styles
    │   └── dashboard-[hash].css # Dashboard styles
    ├── js/
    │   ├── main-[hash].js       # Auth page entry
    │   ├── dashboard-[hash].js  # Dashboard entry
    │   ├── core-[hash].js       # Shared core utilities
    │   ├── charts-[hash].js     # Chart components
    │   └── services-[hash].js   # Business logic
    └── images/
        └── [optimized images]
```

## 🎨 CSS Architecture

### Design System
```css
/* CSS Variables (Design Tokens) */
static/css/design-system/tokens.css      /* Colors, typography, spacing */
static/css/design-system/reset.css       /* Normalized base styles */
static/css/design-system/utilities.css   /* Utility classes */
```

### Component Styles
```css
static/css/components/
├── badge.css      /* Status badges */
├── button.css     /* Button variants */
├── card.css       /* Card containers */
├── chart.css      /* Chart styling */
├── form.css       /* Form elements */
├── insight.css    /* Insight cards */
├── nav.css        /* Navigation */
└── table.css      /* Data tables */
```

### Page Styles
```css
static/css/pages/
├── overview.css           /* Dashboard overview */
├── activities.css         /* Activity list */
├── activity-detail.css    /* Single activity view */
├── power-curve.css        /* Power curve analysis */
├── training-load.css      /* CTL/ATL/TSB */
├── vo2max.css            /* VO2max estimates */
└── settings.css           /* User settings */
```

## 🔧 Configuration

### Vite Config (`vite.config.js`)

Key configuration options:

```javascript
{
  server: {
    port: 8080,           // Dev server port
    proxy: {              // API proxy configuration
      '/api': 'http://localhost:8000'
    }
  },
  build: {
    outDir: 'dist',       // Build output directory
    sourcemap: true,      // Generate source maps
    minify: 'terser',     // Minification
    chunkSizeWarningLimit: 500  // Warn for chunks > 500kb
  }
}
```

### Environment Variables

Create `.env` for environment-specific configuration:

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:8000

# Feature Flags
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_DEBUG=false
```

Access in code:
```javascript
const apiUrl = import.meta.env.VITE_API_BASE_URL;
const isProd = import.meta.env.PROD;
const isDev = import.meta.env.DEV;
```

## 🚢 Deployment

### Production Build

```bash
npm run build
```

### Serve Static Files

Deploy the `dist/` directory to any static hosting:

**Option 1: Simple HTTP Server**
```bash
npm run preview
```

**Option 2: Serve with Backend**
Configure your backend to serve the `dist/` directory as static files.

**Option 3: CDN/Static Hosting**
Upload `dist/` to:
- Netlify
- Vercel
- GitHub Pages
- AWS S3 + CloudFront
- Any static file hosting

### Backend Integration

If serving from the same domain as backend, update FastAPI to serve static files:

```python
# backend/app/main.py
from fastapi.staticfiles import StaticFiles

app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
```

## 📊 Performance

### Development
- ⚡ Cold start: ~200ms
- 🔄 HMR: <50ms
- 📦 On-demand compilation

### Production
- 📦 Total bundle size: ~150-200KB (gzipped)
- 🎯 Core chunk: ~50KB
- 📊 Charts chunk: ~80KB
- 🔀 Code splitting: 3-5 chunks
- 🗜️ Compression: Brotli + Gzip

## 🐛 Troubleshooting

### Port already in use
```bash
# Kill process on port 8080
lsof -ti:8080 | xargs kill -9

# Or use different port
npm run dev -- --port 3000
```

### Module not found errors
```bash
# Clear cache and reinstall
rm -rf node_modules dist
npm install
```

### Build errors
```bash
# Check for syntax errors
npm run build

# Clear Vite cache
rm -rf node_modules/.vite
```

## 📚 Additional Resources

- [Vite Documentation](https://vitejs.dev/)
- [ES Modules Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [Chart.js Documentation](https://www.chartjs.org/)

## 🎯 Next Steps

- [ ] Add TypeScript for better type safety
- [ ] Implement service worker for offline support
- [ ] Add E2E tests with Playwright
- [ ] Set up CI/CD pipeline
- [ ] Add performance monitoring
- [ ] Implement progressive web app (PWA) features
