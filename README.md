# Training Dashboard Pro

A comprehensive training analytics dashboard for cyclists and endurance athletes. Track your power metrics, training load, critical power, VO2max estimates, and more.

## Features

- **Power Analysis**: Power curves, critical power modeling, peak power tracking
- **Training Load Management**: CTL/ATL/TSB tracking, fitness/fatigue/form analysis
- **Heart Rate Analytics**: HR zones, efficiency metrics, VO2max estimation
- **FIT File Import**: Automatic processing of Garmin .fit files
- **Smart Caching**: Automatic cache rebuilding after data imports
- **Comprehensive Security**: Rate limiting, password complexity, security headers

## Tech Stack

**Backend:**
- FastAPI (Python web framework)
- SQLAlchemy (ORM)
- SQLite (Database)
- Alembic (Database migrations)
- JWT Authentication
- bcrypt (Password hashing)

**Frontend:**
- Vanilla JavaScript (ES6+)
- Chart.js (Visualizations)
- Custom CSS with design tokens
- Hash-based routing

## Quick Start

### Prerequisites

- Python 3.10 or higher
- pip (Python package manager)
- OpenSSL (for generating secret keys)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd training-dashboard
   ```

2. **Set up the backend**
   ```bash
   cd backend

   # Install dependencies
   pip install -r requirements.txt

   # Copy environment template
   cp .env.example .env

   # Generate a secure secret key
   openssl rand -hex 32

   # Edit .env and paste the generated key as SECRET_KEY
   nano .env  # or use your preferred editor
   ```

3. **Initialize the database**
   ```bash
   # Create database and run migrations
   python init_db.py

   # (Optional) Create a demo user for testing
   python init_db.py --demo-user
   ```

   If you created the demo user:
   - Username: `demo`
   - Password: `Demo123!`

4. **Start the backend server**
   ```bash
   python -m uvicorn app.main:app --reload
   ```

   The API will be available at `http://localhost:8000`

5. **Open the frontend**

   Open `frontend/index.html` in your browser, or use a local server:

   ```bash
   # Using Python's built-in server
   cd ../frontend
   python -m http.server 8080
   ```

   Then navigate to `http://localhost:8080`

## Project Structure

```
training-dashboard/
├── backend/
│   ├── alembic/              # Database migrations
│   ├── app/
│   │   ├── api/              # API routes
│   │   │   └── routes/       # Route handlers
│   │   ├── core/             # Core config, security
│   │   ├── database/         # Database models
│   │   └── services/         # Business logic
│   │       ├── analysis/     # Analysis services
│   │       ├── cache/        # Caching system
│   │       └── fit_processing/ # FIT file processing
│   ├── data/                 # Data directory (not in git)
│   │   ├── database/         # SQLite database
│   │   ├── fit_files/        # Uploaded FIT files
│   │   └── cache/            # Cache files
│   ├── .env                  # Environment variables (not in git)
│   ├── .env.example          # Environment template
│   ├── init_db.py            # Database initialization script
│   └── requirements.txt      # Python dependencies
└── frontend/
    ├── static/
    │   ├── css/              # Stylesheets
    │   ├── js/               # JavaScript modules
    │   │   ├── core/         # Core functionality
    │   │   ├── pages/        # Page modules
    │   │   ├── services/     # Frontend services
    │   │   └── components/   # UI components
    │   └── assets/           # Images, icons
    ├── dashboard.html        # Main dashboard
    └── index.html            # Login page
```

## Database Management

### Creating Migrations

When you modify the database models, create a new migration:

```bash
cd backend
alembic revision --autogenerate -m "Description of changes"
alembic upgrade head
```

### Resetting the Database

If you need to start fresh:

```bash
cd backend
rm -rf data/database/trainings.db
python init_db.py
```

### Backup the Database

```bash
cd backend
cp data/database/trainings.db data/database/trainings_backup_$(date +%Y%m%d).db
```

## API Documentation

Once the server is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Key Endpoints

**Authentication:**
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info

**Activities:**
- `GET /api/activities` - List all activities
- `GET /api/activities/{id}` - Get activity details
- `DELETE /api/activities/{id}` - Delete activity

**Analysis:**
- `GET /api/analysis/training-load` - Get training load data
- `GET /api/analysis/power-curve` - Get power curve
- `GET /api/analysis/critical-power` - Get critical power model
- `GET /api/analysis/vo2max` - Get VO2max estimates
- `GET /api/analysis/efficiency` - Get efficiency metrics

**Import:**
- `POST /api/import/fit-files` - Upload FIT files
- `POST /api/import/rebuild-cache` - Manually rebuild cache
- `GET /api/import/cache-status` - Get cache status

**Settings:**
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings (FTP, weight, HR zones)

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with strong hashing
- **Password Requirements**:
  - Minimum 8 characters
  - Must include uppercase, lowercase, number, and special character
- **Rate Limiting**:
  - Login: 10 attempts per minute
  - Registration: 5 per hour
- **Security Headers**: CSP, X-Frame-Options, HSTS-ready
- **File Upload Validation**: Size limits, type checking
- **Request Size Limits**: Prevent DoS attacks

## Development

### Running Tests

(Tests will be added in Phase 2)

```bash
cd backend
pytest
```

### Code Style

The project follows:
- PEP 8 for Python
- ESLint (Standard) for JavaScript

### Adding New Features

1. Create feature branch: `git checkout -b feature/your-feature`
2. Make changes
3. Update tests
4. Create pull request

## Troubleshooting

### "SECRET_KEY must be set" error

Make sure you've:
1. Copied `.env.example` to `.env`
2. Generated a secure key with `openssl rand -hex 32`
3. Pasted the key into `.env`

### "no such column" database errors

Run migrations to update the database schema:
```bash
cd backend
alembic upgrade head
```

### CORS errors in frontend

Make sure the backend is running and the CORS origins in `.env` match your frontend URL.

### Cache issues

Manually rebuild the cache:
```bash
curl -X POST http://localhost:8000/api/import/rebuild-cache \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

[Your License Here]

## Acknowledgments

- FIT file parsing powered by [fitparse](https://github.com/dtcooper/python-fitparse)
- Charts powered by [Chart.js](https://www.chartjs.org/)
- Icons from [Feather Icons](https://feathericons.com/)
