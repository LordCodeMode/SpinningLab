# Training Dashboard - Project Structure

## 📁 Root Directory
```
training-dashboard/
├── backend/           # Python/FastAPI backend
├── frontend/          # JavaScript/Vite frontend  
├── docs/             # Documentation and design files
├── README.md         # Project overview
└── VITE_SETUP_SUMMARY.md  # Vite migration guide
```

## 🔧 Backend Structure
```
backend/
├── app/              # Main application code
│   ├── api/         # API routes and endpoints
│   ├── core/        # Core functionality (config, auth, logging)
│   ├── database/    # Database models and connections
│   └── services/    # Business logic services
├── scripts/          # Utility scripts (maintenance, diagnostics)
│   ├── check_database.py
│   ├── cleanup_debug_statements.py
│   ├── diagnose_training_load.py
│   ├── fix_cache_builder.py
│   ├── init_db.py
│   └── rebuild_cache_for_user.py
├── tests/           # Test suite
│   ├── unit/        # Unit tests
│   └── integration/ # Integration tests
├── data/            # User data storage
│   └── fit_files/   # FIT files organized by user
├── alembic/         # Database migrations
├── logs/            # Application logs
├── shared/          # Shared constants and models
├── venv/            # Python virtual environment
├── .env             # Environment variables (not in git)
├── alembic.ini      # Alembic configuration
├── pytest.ini       # Pytest configuration
└── requirements.txt # Python dependencies
```

## 🎨 Frontend Structure
```
frontend/
├── src/                        # Entry point files
│   ├── main.js                 # Auth page entry point
│   └── dashboard-main.js       # Dashboard entry point
├── public/                     # Static assets served as-is
│   └── favicon.ico             # Site favicon
├── static/
│   ├── css/                    # Stylesheets (356 KB)
│   │   ├── design-system/      # Design tokens, reset, utilities
│   │   │   ├── reset.css       # CSS reset
│   │   │   ├── tokens.css      # Design tokens (colors, spacing, etc)
│   │   │   └── utilities.css   # Utility classes
│   │   ├── components/         # Component styles
│   │   │   ├── badge.css
│   │   │   ├── button.css
│   │   │   ├── card.css
│   │   │   ├── chart.css
│   │   │   ├── form.css
│   │   │   ├── insight.css
│   │   │   ├── skeleton.css
│   │   │   └── table.css
│   │   ├── pages/              # Page-specific styles
│   │   │   ├── overview.css
│   │   │   ├── power-curve.css
│   │   │   ├── zones.css
│   │   │   ├── settings.css
│   │   │   ├── best-powers.css
│   │   │   ├── efficiency.css
│   │   │   ├── hr-zones.css
│   │   │   ├── critical-power.css
│   │   │   ├── upload.css
│   │   │   ├── activities.css
│   │   │   ├── activity.css
│   │   │   ├── vo2max.css
│   │   │   └── training-load.css
│   │   ├── auth.css            # Authentication page styles
│   │   ├── dashboard.css       # Dashboard layout styles
│   │   ├── main.css            # Global styles
│   │   └── global-color-overrides.css
│   ├── js/                     # JavaScript modules (832 KB)
│   │   ├── core/               # Core modules
│   │   │   ├── api.js          # API client & endpoints
│   │   │   ├── auth.js         # Authentication logic
│   │   │   ├── charts.js       # Chart utilities
│   │   │   ├── config.js       # App configuration
│   │   │   ├── dashboard.js    # Dashboard controller
│   │   │   ├── eventBus.js     # Event system
│   │   │   ├── router.js       # Client-side routing
│   │   │   ├── state.js        # State management
│   │   │   ├── upload.js       # File upload handler
│   │   │   ├── utils.js        # Core utilities
│   │   │   └── chartColors.js  # Chart color schemes
│   │   ├── pages/              # Page controllers (13 pages)
│   │   │   ├── activities/     # Activities list page
│   │   │   ├── activity/       # Single activity detail
│   │   │   ├── best-powers/    # Best power values
│   │   │   ├── critical-power/ # Critical power analysis
│   │   │   ├── efficiency/     # Efficiency trends
│   │   │   ├── hr-zones/       # Heart rate zones
│   │   │   ├── overview/       # Overview dashboard
│   │   │   ├── power-curve/    # Power curve analysis
│   │   │   ├── settings/       # User settings
│   │   │   ├── training-load/  # Training load (CTL/ATL/TSB)
│   │   │   ├── upload/         # File upload
│   │   │   ├── vo2max/         # VO2 Max estimation
│   │   │   └── zones/          # Power zones
│   │   ├── components/         # Reusable UI components
│   │   │   ├── charts/         # Chart components
│   │   │   ├── insights/       # Insight cards & badges
│   │   │   └── ui/             # Generic UI components
│   │   ├── services/           # Business logic services
│   │   │   └── DataService.js  # Data fetching & caching
│   │   └── utils/              # Utility functions
│   │       ├── constants.js    # App constants
│   │       ├── formatters.js   # Data formatting
│   │       ├── notifications.js # Toast notifications
│   │       └── validators.js   # Input validation
│   └── images/                 # Static images (1.8 MB)
│       └── mountain_background.jpg
├── index.html          # Login/Register page (entry point)
├── dashboard.html      # Main dashboard page (SPA)
├── package.json        # Node dependencies & scripts
├── package-lock.json   # Locked dependency versions
├── vite.config.js      # Vite build configuration
├── README.md           # Frontend documentation
├── .gitignore          # Git ignore rules
└── node_modules/       # Dependencies (23 MB, not in git)
```

### Frontend Organization Highlights:
- **src/** - Entry point JavaScript files (Vite imports)
- **public/** - Static assets served as-is (favicon, etc)
- **static/** - Source code organized by type (css, js, images)
- **HTML files** - At root for Vite multi-page app configuration
- **Config files** - At root (package.json, vite.config.js, etc)
```

## 📚 Documentation
```
docs/
└── design-samples/  # UI/UX design prototypes
    ├── 2.html
    ├── 3.html
    ├── 4.html
    └── html.html
```

## 🗄️ Data Organization
```
backend/data/fit_files/
├── 2/              # User ID 2 FIT files (8.6 MB)
└── streams/        # Cached activity streams (167 MB)
```

## 🚀 Key Configuration Files

### Backend
- `.env` - Environment variables (API keys, database URL)
- `.env.example` - Template for environment variables
- `alembic.ini` - Database migration settings
- `pytest.ini` - Test configuration
- `requirements.txt` - Python package dependencies

### Frontend
- `package.json` - Node package dependencies and scripts
- `vite.config.js` - Vite build configuration
- `.gitignore` - Files to exclude from git

## 📝 Important Notes

### What to Keep
- ✅ `backend/data/fit_files/2/` - Your actual training data
- ✅ `backend/data/fit_files/streams/` - Can rebuild if needed
- ✅ `backend/venv/` - Virtual environment (can recreate)
- ✅ `frontend/node_modules/` - Dependencies (can reinstall)

### What Gets Ignored by Git
- Python cache (`__pycache__/`, `*.pyc`)
- Node modules (`node_modules/`)
- Build artifacts (`dist/`, `htmlcov/`)
- Environment files (`.env`)
- Logs (`*.log`, `logs/`)
- System files (`.DS_Store`)
- Backup files (`*.bak`)

### Scripts Directory
Utility scripts for maintenance tasks:
- `check_database.py` - Verify database integrity
- `cleanup_debug_statements.py` - Remove debug code
- `diagnose_training_load.py` - Debug training load calculations
- `fix_cache_builder.py` - Repair cache issues
- `init_db.py` - Initialize database
- `rebuild_cache_for_user.py` - Rebuild user cache

## 🔍 Quick Reference

### Start Development
```bash
# Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload

# Frontend
cd frontend
npm run dev
```

### Run Tests
```bash
cd backend
source venv/bin/activate
pytest
```

### Build for Production
```bash
cd frontend
npm run build
```
