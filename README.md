# HACK_USU_26 - Hypothesis Generation App

A React Native/Expo mobile application that helps users define and refine working hypotheses about how daily activities affect wellness outcomes using AI.

## Setup

### Prerequisites
- Node.js (v18+)
- npm
- Expo CLI

### Installation

1. Clone and install:
```bash
git clone https://github.com/jefferson-lund/HACK_USU_26.git
cd HACK_USU_26
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
cp server/.env.example server/.env
```

3. Add your API keys to `.env` and `server/.env`:
   - OpenAI: https://platform.openai.com/api-keys
   - Gemini: https://aistudio.google.com/app/apikey
   - WHOOP: https://developer.whoop.com/

### Running

```bash
npm run server    # Start backend (port 4000)
npm run web       # Run on web
npm run android   # Run on Android
npm run ios       # Run on iOS
```

## Tech Stack
- Expo 54.0 + React Native 0.81.5
- TypeScript 5.9.2
- Express 5.0.1
- OpenAI GPT-4o-mini
- Google Gemini API

## Security
- Never commit `.env` files
- API keys are gitignored
- Backend proxies API calls to protect keys
