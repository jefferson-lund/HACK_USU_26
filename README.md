# AI-Powered Scientific Wellness Tracking

> *"What if you could scientifically test how your daily habits affect your wellbeing?"*

A cross-platform mobile application that transforms wellness tracking from passive data collection into active experimentation. Built for Hack USU 2026.

## The Problem

Wellness apps collect data, but they don't help you understand *why* you feel the way you do. Users are left drowning in metrics without actionable insights about what actually moves the needle on their health.

## The Solution

**Hypothesis** helps users become scientists of their own lives by:
1. **Defining clear outcomes** - What do you want to improve? (energy, sleep, focus)
2. **Identifying activities** - What daily habits might influence this? (exercise, caffeine, screen time)
3. **Generating testable hypotheses** - AI creates clear, neutral hypotheses connecting your activities to outcomes
4. **Tracking experiments** - Monitor your hypothesis over time with integrated wellness data

## Key Features

### AI-Powered Hypothesis Generation
- Uses OpenAI GPT-4o-mini and Google Gemini to generate scientifically-structured hypotheses
- Transforms vague wellness goals into testable predictions
- Neutral, unbiased language encourages objective self-experimentation

### WHOOP Integration
- Connects with WHOOP fitness tracker for objective wellness metrics
- Tracks sleep quality, recovery, strain, and heart rate variability
- Correlates subjective activities with objective physiological data

### Cross-Platform Design
- Built with React Native and Expo for iOS, Android, and Web
- Responsive UI with dark/light theme support
- Consistent experience across all devices

### Privacy-First Architecture
- Backend proxy pattern keeps API keys secure
- No user data stored on external servers
- Local-first data storage

## Technical Architecture

### Frontend Stack
- **Expo 54.0** - Cross-platform development framework
- **React Native 0.81.5** - Native mobile components
- **TypeScript 5.9.2** - Type-safe development
- **Expo Router 6.0** - File-based navigation system
- **React Native Reanimated** - Smooth animations

### Backend Stack
- **Express 5.0.1** - Lightweight Node.js server
- **OpenAI API** - GPT-4o-mini for hypothesis generation
- **Google Gemini API** - Alternative AI model for redundancy
- **CORS-enabled** - Secure cross-origin requests

### Security Design
- Environment variables for all sensitive credentials
- Backend acts as API proxy to prevent client-side key exposure
- Gitignored `.env` files with example templates
- Clean git history with no exposed secrets

## User Flow

1. **Setup Screen** - User enters desired wellness outcome
2. **Activity Input** - Add daily activities that might influence the outcome
3. **AI Generation** - System generates a clear, testable hypothesis
4. **Tracking Dashboard** - Monitor hypothesis over time with integrated data
5. **Analysis** - Review correlations between activities and outcomes

## Project Structure

```
app/
├── (tabs)/
│   ├── index.tsx          # Main hypothesis setup screen
│   └── two.tsx            # Tracking dashboard
├── _layout.tsx            # Root layout with theme provider
└── modal.tsx              # Modal screens

components/
├── Themed.tsx             # Theme-aware UI components
└── useColorScheme.ts      # Dark/light mode detection

lib/
├── llm.ts                 # AI integration and API communication
├── whoop.ts               # WHOOP API integration
└── analysis.ts            # Data analysis utilities

server/
└── index.js               # Express backend with API proxying
```

## Getting Started

### Prerequisites
- Node.js v18+
- npm or yarn
- Expo CLI
- API keys (OpenAI, Gemini, WHOOP)

### Installation

```bash
# Clone repository
git clone https://github.com/jefferson-lund/HACK_USU_26.git
cd HACK_USU_26

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
cp server/.env.example server/.env

# Add your API keys to both .env files
```

### Get API Keys
- **OpenAI**: https://platform.openai.com/api-keys
- **Gemini**: https://aistudio.google.com/app/apikey
- **WHOOP**: https://developer.whoop.com/

### Run the App

```bash
# Terminal 1: Start backend server
npm run server

# Terminal 2: Start Expo app
npm run web      # Web browser
npm run android  # Android device/emulator
npm run ios      # iOS device/simulator
```

## Design Decisions

### Why Expo?
- Rapid cross-platform development
- Hot reload for fast iteration
- Built-in routing and navigation
- Easy deployment to app stores

### Why Backend Proxy?
- Prevents API key exposure in client code
- Enables rate limiting and request monitoring
- Allows for future server-side data processing
- Maintains security even if app is decompiled

### Why Multiple AI Models?
- Redundancy if one service is down
- Cost optimization (Gemini is cheaper for some use cases)
- Quality comparison between models
- Flexibility for future model upgrades

## Future Enhancements

- [ ] User authentication and cloud sync
- [ ] Data visualization with charts and trends
- [ ] Social features for sharing hypotheses
- [ ] Integration with more wearables (Apple Health, Fitbit, Oura)
- [ ] Statistical significance testing
- [ ] Hypothesis templates library
- [ ] Export data to CSV/PDF
- [ ] Push notifications for tracking reminders

## Contributing

This project was built for Hack USU 2026. Contributions welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)

## License

Built by Jefferson, Cooper, and Cader for Hack USU 2026

---
