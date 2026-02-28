# Whoop Integration - Complete Implementation

## Features Implemented

### 1. Token Persistence
**Database Tables:**
- `whoop_token` - Stores access_token and refresh_token
- `whoop_data` - Stores all Whoop metrics by date

**Functions:**
- `saveWhoopToken(accessToken, refreshToken)` - Persists OAuth tokens
- `getWhoopToken()` - Retrieves saved token on app restart
- Works on both native (SQLite) and web (in-memory)

### 2. Data Storage
**Whoop Metrics Stored:**
- `strain` - Daily strain score
- `avg_heart_rate` - Average heart rate
- `recovery_score` - Recovery percentage (0-100)
- `hrv` - Heart rate variability (HRV RMSSD)
- `resting_hr` - Resting heart rate
- `sleep_performance` - Sleep quality percentage
- `sleep_duration` - Hours of sleep

**Functions:**
- `saveWhoopData(data)` - Saves/updates Whoop metrics
- `getWhoopData(startDate?, endDate?)` - Retrieves stored data with optional date filtering

### 3. Analysis Integration
**New Function:** `enrichDataWithWhoop(activityData, whoopData)`

Automatically adds Whoop metrics as binary activities for regression analysis:
- **High Recovery (>66%)** - Recovery score above 66%
- **Good Sleep (>85%)** - Sleep performance above 85%
- **High Strain (>15)** - Strain above 15

**Result:** Regression analysis now shows how Whoop metrics correlate with your outcome!

### 4. Complete Flow

```
1. User clicks "Connect Whoop"
   ↓
2. OAuth flow → receives access_token
   ↓
3. Token saved to database (persists across restarts)
   ↓
4. Automatically fetches 180 days of data
   ↓
5. Data saved to database
   ↓
6. When running analysis:
   - Loads activity logs
   - Loads Whoop data
   - Enriches activities with Whoop metrics
   - Runs regression with combined data
   ↓
7. Results show impact of both activities AND Whoop metrics
```

## Usage

### First Time Setup
1. Click "Connect Whoop" button
2. Authorize in browser
3. Data automatically fetched and saved
4. Token persisted for future use

### Subsequent Uses
- Token automatically restored on app launch
- Click "Fetch Whoop Data" to refresh (gets last 180 days)
- Run analysis to see correlations

### Analysis Output
Regression results will include entries like:
- "Meditation: +1.2 (moderate positive)"
- "High Recovery (>66%): +0.8 (moderate positive)"
- "Good Sleep (>85%): +1.5 (strong positive)"
- "Late Coffee: -0.9 (moderate negative)"

## Technical Details

### Database Schema (Native)
```sql
CREATE TABLE whoop_token (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE whoop_data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  strain REAL,
  avg_heart_rate REAL,
  recovery_score REAL,
  hrv REAL,
  resting_hr REAL,
  sleep_performance REAL,
  sleep_duration REAL
);
```

### Files Modified
1. `lib/database.native.ts` - Added Whoop tables and functions
2. `lib/database.web.ts` - Added Whoop in-memory storage
3. `lib/analysis.ts` - Added `enrichDataWithWhoop()` function
4. `app/(tabs)/two.tsx` - Integrated token persistence and data enrichment

## Future Enhancements
- [ ] Token refresh logic (when access_token expires)
- [ ] Continuous thresholds instead of binary (e.g., recovery as 0-100)
- [ ] More granular Whoop metrics (HRV trends, sleep stages)
- [ ] Automatic daily sync
- [ ] Whoop data visualization in UI
