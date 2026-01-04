# Training Dashboard Enhancement Plan
## Transform into World-Class Training Platform

**Goal**: Create an impressive, production-ready cycling analytics platform that serves personal training needs while showcasing professional development capabilities.

**Priority Focus Areas**:
1. Workout Planning & Calendar (foundational differentiator)
2. Advanced Analytics & ML (portfolio showcase)
3. Maps & GPS Features (visual engagement)

---

## Phase 1: Foundation & Workout Planning (HIGH PRIORITY)
**Timeline**: 2-3 weeks | **Portfolio Value**: ⭐⭐⭐⭐⭐ | **Personal Utility**: ⭐⭐⭐⭐⭐

### 1.1 Workout Builder & Calendar System
**Why This First**: This is THE killer feature missing from your app. Premium platforms (TrainingPeaks, Intervals.icu) charge $10-20/month primarily for workout planning.

**Features to Build**:
- **Workout Builder Interface**
  - Create structured workouts with power/HR zones
  - Interval designer (warmup → intervals → cooldown)
  - Visual workout preview (blocks showing duration & intensity)
  - TSS auto-calculation based on intervals

- **Workout Library**
  - Pre-built templates (Sweet Spot, VO2max, Threshold, Recovery)
  - Save custom workouts
  - Categorize by type, duration, TSS

- **Training Calendar**
  - Weekly/monthly grid view
  - Drag-and-drop workout scheduling
  - Planned vs Completed TSS tracking
  - Color-coded by workout type

- **Training Plan Templates**
  - 8-week base building plan
  - 12-week century prep plan
  - FTP builder (3-week blocks)
  - Rest week templates

**Technical Implementation**:

**Backend** (`backend/app/`):
- **New Models** in `database/models.py`:
  ```python
  class Workout(Base):
      # id, user_id, name, description, workout_type
      # total_duration, estimated_tss, intervals (JSON)

  class WorkoutInterval(Base):
      # id, workout_id, order, duration, target_power_low,
      # target_power_high, target_hr, interval_type

  class PlannedWorkout(Base):
      # id, user_id, workout_id, scheduled_date, completed_activity_id
      # notes, completed, skipped

  class TrainingPlan(Base):
      # id, user_id, name, description, start_date,
      # end_date, plan_type, phase
  ```

- **New Routes** in `api/routes/`:
  - `workouts.py`: CRUD for workouts, TSS calculation endpoint
  - `calendar.py`: Get/update planned workouts, weekly view
  - `training_plans.py`: Plan templates, plan generation

- **New Services** in `services/`:
  - `workout_service.py`: TSS calculation from intervals
  - `training_plan_service.py`: Generate periodized plans

**Frontend** (`frontend/`):
- **New Pages** in `static/js/pages/`:
  - `calendar/`: Training calendar view (week/month grid)
  - `workout-builder/`: Interval designer interface
  - `workout-library/`: Browse/search workouts
  - `training-plans/`: Plan templates and builder

- **New Components**:
  - `WorkoutCard`: Display workout summary
  - `IntervalEditor`: Add/edit intervals with drag handles
  - `CalendarGrid`: Monthly/weekly calendar component
  - `WorkoutPreview`: Visual workout chart

- **Library Additions**:
  - **FullCalendar.js** or build custom calendar with CSS Grid
  - Drag-and-drop library (Sortable.js or native HTML5)

**Database Migration**:
```bash
# Add migration script in backend/migrations/
# Create workout-related tables
```

**Portfolio Showcase Value**:
- Complex state management (calendar, drag-and-drop)
- Multi-step form (workout builder)
- Real-time TSS calculations
- CRUD operations with relationships
- Clean UI/UX design

---

### 1.2 Activity Tagging & Enhanced Filtering
**Why This**: Organizational features improve daily usability and are quick wins.

**Features**:
- Tag activities (#interval #race #recovery #commute)
- Add notes/comments to activities
- RPE (Rate of Perceived Exertion) rating
- Advanced filtering (by tags, TSS range, power range, date)
- Saved filter presets

**Technical**:
- New model: `ActivityTag` (many-to-many relationship)
- Update `Activity` model: add `notes`, `rpe` fields
- Enhance activities API endpoint with filter parameters
- Add tag management UI in activities page

**Files to Modify**:
- `backend/app/database/models.py`
- `backend/app/api/routes/activities.py`
- `frontend/static/js/pages/activities/index.js`

---

### 1.3 Dashboard Customization
**Why This**: Personalization improves UX and shows frontend skills.

**Features**:
- Drag-and-drop widget rearrangement
- Show/hide widgets
- Save layout preferences to localStorage
- Multiple layout presets (Athlete, Coach, Data Geek)

**Technical**:
- CSS Grid with drag-and-drop
- LocalStorage for user preferences
- Widget registry system

**Files to Modify**:
- `frontend/static/js/pages/overview/index.js`
- New: `frontend/static/js/services/preferences-service.js`

---

## Phase 2: Advanced Analytics & ML (PORTFOLIO SHOWCASE)
**Timeline**: 3-4 weeks | **Portfolio Value**: ⭐⭐⭐⭐⭐ | **Personal Utility**: ⭐⭐⭐⭐

### 2.1 Machine Learning - FTP Prediction Model
**Why This**: ML/AI is highly valued by employers. Shows data science skills.

**Features**:
- Predict FTP based on recent best efforts
- Model training pipeline using historical power data
- Confidence intervals on predictions
- "Your estimated FTP has increased to 285W" notifications

**Technical Implementation**:

**Backend**:
- **New Service**: `services/ml/ftp_predictor.py`
  - Feature engineering: extract 5min, 8min, 12min, 20min power
  - Train model: scikit-learn RandomForestRegressor or XGBoost
  - Model persistence: joblib pickle

- **New Endpoint**: `POST /api/analysis/predict-ftp`
  - Returns: predicted FTP, confidence, date

**Data Pipeline**:
```python
# Features: recent best powers (5min, 20min), CTL, recent TSS
# Target: user's actual FTP (from settings history)
# Model: Ensemble (Random Forest + Linear Regression)
```

**Model Training Script**:
```bash
# backend/scripts/train_ftp_model.py
# Train on all users' historical data
# Save model to backend/ml_models/ftp_predictor.pkl
```

**Portfolio Value**: Machine learning, data science, model deployment

---

### 2.2 Automated Insights & Coaching Recommendations
**Why This**: AI-powered insights are impressive and useful.

**Features**:
- Weekly training summary (auto-generated)
- Anomaly detection (unusual fatigue, breakthrough performances)
- Smart recovery recommendations
- Overtraining risk alerts
- Pattern recognition ("you always perform best on Tuesdays")

**Technical**:
- **Background Jobs**: Use APScheduler or Celery
- **Insight Generation Service**: Rule-based expert system
  - If TSB < -30: "High fatigue - recommend recovery"
  - If CTL increasing >5/week: "Aggressive ramp - watch for overtraining"
  - If new power PR: "Breakthrough detected! New 5-min power of 320W"

- **Email Service** (optional): SendGrid integration for weekly summaries

**Files to Create**:
- `backend/app/services/insights/insight_generator.py`
- `backend/app/services/insights/coaching_advisor.py`
- `backend/app/tasks/weekly_summary.py`

---

### 2.3 Advanced Performance Metrics
**Why This**: Shows deep domain knowledge and analytical skills.

**Features to Add**:
- **Fatigue Resistance**: Power decay analysis (compare first vs last 20min)
- **W' Balance**: Anaerobic capacity tracking (W-prime model)
- **Variability Index**: VI = Normalized Power / Average Power
- **Decoupling**: Power vs HR correlation over time
- **Polarized Distribution**: % time in Zone 1-2 vs Zone 5+

**Technical**:
- New analysis endpoints for each metric
- Statistical calculations (linear regression for decoupling)
- W' balance differential equation solver

**Files**:
- `backend/app/services/analysis/fatigue_resistance.py`
- `backend/app/services/analysis/w_prime_balance.py`
- `backend/app/services/analysis/decoupling.py`
- New API routes in `backend/app/api/routes/analysis/`

---

### 2.4 Comparative & Historical Analytics
**Why This**: Great for visualizing progress, motivating continued training.

**Features**:
- Year-over-year power curve comparison (2024 vs 2023)
- Period-over-period analysis (this month vs last month)
- Personal records timeline
- Historical FTP progression chart
- Training volume trends by season

**Technical**:
- Time-series aggregation queries
- Multi-period chart overlays in Chart.js
- PR detection algorithm

**Files**:
- New page: `frontend/static/js/pages/comparisons/`
- Backend: `backend/app/api/routes/analysis/comparisons.py`

---

## Phase 3: Maps & GPS Features (VISUAL IMPACT)
**Timeline**: 2-3 weeks | **Portfolio Value**: ⭐⭐⭐⭐ | **Personal Utility**: ⭐⭐⭐⭐

### 3.1 Route Map Visualization
**Why This**: Highly visual, impressive in portfolio demos.

**Features**:
- Interactive route maps (Leaflet.js or Mapbox)
- Elevation profile with power overlay
- Click on elevation profile → highlight map location
- Heatmap of all training locations
- Route library & favorites

**Technical Implementation**:

**Library Choice**:
- **Leaflet.js** (free, open-source) OR
- **Mapbox GL JS** (more features, requires API key but generous free tier)

**Data Extraction**:
- Parse GPS coordinates from FIT files
- Store as JSON in database or separate files
- Extract elevation data

**Backend**:
- Enhance FIT processing to extract GPS records
- New field in Activity model: `gps_data_path` (points to JSON file)
- New endpoint: `GET /api/activities/{id}/gps`

**Frontend**:
- New component: `RouteMap` using Leaflet
- Elevation chart with synchronized tooltip
- Heat map aggregation of all routes

**Files**:
- `backend/app/services/fit_processing/gps_extraction.py`
- `frontend/static/js/components/RouteMap.js`
- Update activity detail page with map

---

### 3.2 Segment Analysis
**Why This**: Competitive feature, useful for tracking progress on favorite climbs.

**Features**:
- Create custom segments (local climbs/sprints)
- Segment leaderboard (personal bests)
- Segment detection in activities
- Strava segment sync (import Strava segments)
- Effort comparison across attempts

**Technical**:
- GPS matching algorithm (detect when route passes through segment)
- Segment model with start/end coordinates
- Leaderboard queries

**Complexity**: High - GPS matching is algorithmically challenging

---

### 3.3 Weather Integration
**Why This**: Contextualizes performance (harder workout in heat/wind).

**Features**:
- Historical weather overlay on activities
- Training condition analysis
- Heat/cold adaptation tracking

**Technical**:
- OpenWeatherMap API (free tier: 1000 calls/day)
- Store weather data with activities
- Condition analysis in training load service

---

## Phase 4: Technical Modernization (INFRASTRUCTURE)
**Timeline**: 1-2 weeks | **Portfolio Value**: ⭐⭐⭐⭐⭐ | **Personal Utility**: ⭐⭐⭐

### 4.1 Database Upgrade: SQLite → PostgreSQL
**Why**: SQLite doesn't scale well. PostgreSQL is production-standard.

**Benefits**:
- Better performance for complex queries
- Full-text search capabilities
- JSON field support (for GPS data, workout intervals)
- Concurrent write performance
- Proper indexing

**Migration Steps**:
1. Install PostgreSQL locally
2. Update `backend/app/core/config.py` for PostgreSQL connection
3. Export SQLite data, import to PostgreSQL
4. Test all queries
5. Update documentation

---

### 4.2 Caching with Redis
**Why**: Dramatically improves performance, shows distributed systems knowledge.

**Benefits**:
- Cache expensive analysis calculations (power curves, training load)
- Session management
- Rate limiting
- Real-time features (leaderboards)

**Implementation**:
- Install Redis
- Replace file-based caching with Redis
- Use `redis-py` library
- Cache keys: `user:{id}:power_curve:{params}`

**Files to Modify**:
- `backend/app/services/cache/cache_manager.py`
- Update to use Redis instead of file system

---

### 4.3 Frontend Framework Upgrade (Optional)
**Why**: Modern frameworks improve developer experience, show current skills.

**Options**:
- **React** (most popular, best job market)
- **Vue 3** (simpler learning curve, great DX)
- **Svelte** (emerging, impressive performance)

**Recommendation**: **React with Vite** (or stick with vanilla JS)
- React is industry standard
- Huge ecosystem
- Shows you can work with modern tools

**Migration Strategy**:
- Incremental: Convert one page at a time
- Start with calendar page (most complex state)
- Keep existing vanilla JS pages running

**Effort**: High (2-3 weeks for full conversion)

---

### 4.4 API Documentation & Testing
**Why**: Professional polish, essential for portfolio.

**Features**:
- Swagger/OpenAPI documentation (FastAPI auto-generates)
- API versioning (`/api/v1/...`)
- Comprehensive tests (pytest)
- E2E tests (Playwright)

**Implementation**:
- FastAPI already has Swagger UI at `/docs`
- Add descriptions to all endpoints
- Write test suite in `backend/tests/`
- CI/CD with GitHub Actions

---

## Phase 5: Social & Gamification (ENGAGEMENT)
**Timeline**: 2-3 weeks | **Portfolio Value**: ⭐⭐⭐ | **Personal Utility**: ⭐⭐⭐

### 5.1 Achievement System
**Features**:
- Badges for milestones (power, distance, consistency)
- Level progression (Beginner → Cat 5 → Cat 4 → Cat 3...)
- Achievement notifications
- Achievement showcase on profile

**Technical**:
- `Achievement` model with unlock criteria
- Background job checks for achievements
- Badge SVG graphics

---

### 5.2 Goals & Progress Tracking
**Features**:
- Set monthly/yearly goals (TSS, distance, hours)
- FTP improvement targets
- Progress bars and visualization
- Goal deadline reminders

**Technical**:
- `Goal` model with target value and deadline
- Progress calculation service
- Goal widget on dashboard

---

### 5.3 Challenges
**Features**:
- Monthly distance challenges
- Consistency streaks (7-day, 30-day, 100-day)
- Elevation climbed challenges
- Social sharing (og:image for achievements)

---

## Phase 6: Platform Integrations (EXPANSION)
**Timeline**: 1-2 weeks per integration | **Portfolio Value**: ⭐⭐⭐⭐

### 6.1 Garmin Connect Integration
**Why**: Garmin is the most popular cycling computer brand.

**Features**:
- OAuth connection to Garmin
- Auto-sync activities
- Download FIT files from Garmin

**Technical**:
- Garmin OAuth API
- Similar pattern to existing Strava integration

---

### 6.2 Wahoo Integration
**Features**:
- Connect to Wahoo account
- Sync workouts to Wahoo head unit
- Import Wahoo activities

---

### 6.3 TrainingPeaks Export
**Features**:
- Export workouts in TrainingPeaks format
- Allows coaches to integrate your workouts

---

## Phase 7: Mobile & PWA (ACCESSIBILITY)
**Timeline**: 2-3 weeks | **Portfolio Value**: ⭐⭐⭐⭐

### 7.1 Progressive Web App (PWA)
**Features**:
- Install to home screen
- Offline mode
- Push notifications
- Fast loading with service worker

**Technical**:
- Service worker for caching
- PWA manifest file
- Push notification API

---

### 7.2 Mobile-First Redesign
**Features**:
- Touch-optimized controls
- Swipe gestures
- Bottom navigation
- Responsive charts
- Mobile-specific layouts

---

## Technical Stack Recommendations

### Backend Modernization
- ✅ Keep: **FastAPI** (excellent choice, modern, fast)
- ⬆️ Upgrade: **SQLite → PostgreSQL** (scalability, features)
- ➕ Add: **Redis** (caching, sessions)
- ➕ Add: **Celery** or **APScheduler** (background jobs)
- ➕ Add: **scikit-learn** or **XGBoost** (ML models)
- ✅ Keep: **SQLAlchemy** (industry standard ORM)

### Frontend Options
**Option A: Modernize with React** ⭐ Recommended for portfolio
- React 18 + Vite
- TanStack Query (data fetching)
- Zustand or Jotai (state management)
- React Router (routing)
- Chart.js or Recharts (visualization)
- Tailwind CSS or shadcn/ui (styling)
- Leaflet React (maps)

**Option B: Enhance Vanilla JS** ⭐ If you prefer current approach
- Keep current vanilla JS
- Add TypeScript (type safety)
- Add build-time optimizations
- Enhance component system

**Recommendation**: **React** - Better for job market, shows modern skills

### DevOps & Deployment
- **Docker** + **Docker Compose** (containerization)
- **GitHub Actions** (CI/CD)
- **Pytest** (backend testing)
- **Playwright** or **Cypress** (E2E testing)
- **Sentry** (error tracking)
- **Vercel/Railway/Fly.io** (deployment options)

---

## Implementation Priority (Your Focus)

### Sprint 1: Quick Wins (1 week)
Focus on getting workout planning foundation in place:
1. Database models for workouts and calendar
2. Basic workout builder backend (CRUD endpoints)
3. Simple calendar UI (week view)
4. Pre-built workout templates

### Sprint 2: Calendar Polish (1 week)
Make the calendar feature-complete:
1. Drag-and-drop scheduling
2. Workout library UI
3. TSS calculation for planned workouts
4. Planned vs completed tracking

### Sprint 3: ML Foundation (1 week)
Start with data collection for ML:
1. FTP history tracking (log FTP changes over time)
2. Automated insights service (rule-based)
3. Simple anomaly detection
4. Weekly summary generation

### Sprint 4: Maps & Visualization (1 week)
Add visual impact:
1. GPS data extraction from FIT files
2. Route map on activity detail page
3. Elevation profile chart
4. Simple heatmap

### Sprint 5: Polish & Portfolio Prep
1. Add API documentation
2. Write tests for critical paths
3. Create demo video
4. Write README with screenshots
5. Deploy to cloud

---

## Critical Files Reference

### Backend Files
- `backend/app/database/models.py` - Add workout/calendar models
- `backend/app/api/routes/workouts.py` - NEW: Workout CRUD
- `backend/app/api/routes/calendar.py` - NEW: Calendar endpoints
- `backend/app/services/workout_service.py` - NEW: TSS calculation
- `backend/app/services/ml/ftp_predictor.py` - NEW: ML model
- `backend/app/services/fit_processing/gps_extraction.py` - NEW: GPS parsing
- `backend/app/core/config.py` - Database configuration

### Frontend Files
- `frontend/static/js/pages/calendar/` - NEW: Calendar page
- `frontend/static/js/pages/workout-builder/` - NEW: Workout builder
- `frontend/static/js/components/WorkoutCard.js` - NEW: Workout component
- `frontend/static/js/components/CalendarGrid.js` - NEW: Calendar component
- `frontend/static/js/components/RouteMap.js` - NEW: Map component
- `frontend/static/js/services/workout-service.js` - NEW: Workout API client

### Configuration Files
- `backend/requirements.txt` - Add: scikit-learn, redis, APScheduler
- `frontend/package.json` - Add: Leaflet, date manipulation library
- `backend/alembic/` - Database migrations

---

## Portfolio Presentation Tips

### README.md Structure
```markdown
# Training Dashboard Pro
> AI-powered cycling performance analytics platform

## Features
- 📊 Advanced power analytics (FTP, TSS, CTL/ATL)
- 🗓️ Workout planning & training calendar
- 🤖 ML-powered FTP predictions
- 🗺️ GPS route visualization & heatmaps
- 📈 Strava & Garmin integration

## Tech Stack
**Backend**: FastAPI, PostgreSQL, Redis, scikit-learn
**Frontend**: React 18, Chart.js, Leaflet
**DevOps**: Docker, GitHub Actions, Pytest

## Highlights
- Built complex calendar with drag-and-drop scheduling
- Implemented machine learning for FTP prediction
- Processed 500+ FIT files with power/HR analysis
- Created 15+ interactive data visualizations
```

### Demo Video Script (3 minutes)
1. **Overview** (30s): Show dashboard, explain purpose
2. **Analytics** (45s): Navigate power curve, training load, zones
3. **Workout Planning** (60s): Create workout, schedule on calendar
4. **ML Feature** (30s): Show FTP prediction, insights
5. **Maps** (15s): Show route visualization

### GitHub Repository Setup
- Clean commit history
- Comprehensive README with screenshots
- API documentation link
- Live demo link
- Architecture diagram

---

## Success Metrics

### Personal Training Goals
- ✅ Plan 4-6 weeks of structured training
- ✅ Track FTP progression over time
- ✅ Analyze training load and recovery
- ✅ Visualize favorite routes and segments

### Portfolio Goals
- ✅ Demonstrate full-stack development
- ✅ Show modern tech stack (React, PostgreSQL, ML)
- ✅ Complex features (calendar, ML, maps)
- ✅ Clean code architecture
- ✅ Production-ready deployment

### Technical Goals
- ✅ Build scalable backend API
- ✅ Implement ML pipeline
- ✅ Create responsive, modern UI
- ✅ Write comprehensive tests
- ✅ Set up CI/CD pipeline

---

## Next Steps

1. **Review this plan** - Does this align with your vision?
2. **Prioritize features** - Which sprint/phase do you want to tackle first?
3. **Set up development environment** - Install PostgreSQL, Redis (if upgrading)
4. **Start with Sprint 1** - Begin with workout planning foundation
5. **Iterate and refine** - Build incrementally, test frequently

**Recommendation**: Start with Sprint 1 (workout planning) - it's the highest value feature that will immediately make your app more useful and impressive.
