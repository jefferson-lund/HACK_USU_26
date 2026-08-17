# HACK_USU_26 - Hypothesis Generation App

## Project Overview

This is a React Native/Expo mobile application that helps users define and refine working hypotheses about how daily activities affect wellness outcomes. The app uses AI (OpenAI GPT-4o-mini) to generate clear, neutral hypotheses based on user-provided outcomes and activities.

## Technology Stack

### Frontend
- **Expo 54.0** with React Native 0.81.5
- **React 19.1.0** with TypeScript 5.9.2
- **Expo Router 6.0.23** - File-based routing system
- **React Navigation 7.1.28** - Navigation library
- **React Native Reanimated 4.1.1** - Animations
- **React Native Web 0.21.0** - Web platform support

### Backend
- **Express 5.0.1** - Node.js server, local dev only (`server/index.js`)
- **Cloudflare Pages Functions** - Workers-runtime port of the same routes for production (`functions/`), see CLOUDFLARE.md
- **OpenAI API** - GPT-4o-mini model for hypothesis generation
- **CORS** - Cross-origin resource sharing

### Platforms
- iOS (with tablet support)
- Android (with adaptive icons)
- Web (Metro bundler, static output)

## Project Structure

```
app/                    # Expo Router app directory (file-based routing)
├── _layout.tsx        # Root layout with theme provider
├── (tabs)/            # Tab-based navigation group
│   ├── _layout.tsx    # Tab layout with bottom tab bar
│   ├── index.tsx      # Main "Today Setup" screen
│   └── track.tsx      # "Track" tab — the largest, most feature-dense
│                      # screen in the app: daily activity/outcome
│                      # tracking, WHOOP integration, regression-based
│                      # analytics, and the AI-generated weekly plan
├── modal.tsx          # Modal screen
└── +not-found.tsx     # 404 fallback

components/            # Reusable UI components
├── Themed.tsx         # Theme-aware components
├── useColorScheme.ts  # Dark/light mode detection
├── track/             # Subcomponents extracted from track.tsx
│   ├── WhoopPanel.tsx     # WHOOP token/OAuth controls + data table
│   ├── ScatterChart.tsx   # Predicted vs. actual outcomes scatter plot
│   ├── WeeklyPlanCard.tsx # Renders the generated 1-week plan
│   └── DataTable.tsx      # Recent check-in data sample table
└── ...

constants/             # App constants
└── Colors.ts          # Theme color definitions (generic light/dark theme)
                       # plus the `Brand` palette used by index.tsx/track.tsx

lib/                   # Utility libraries
├── llm.ts             # LLM integration and API communication
├── whoop.ts           # WHOOP API integration
├── analysis.ts        # Regression/correlation analysis for track.tsx
└── database.native.ts / database.web.ts  # Storage backends (SQLite / in-memory)

server/                # Express backend (local dev only, port 4000)
└── index.js          # OpenAI/Gemini/WHOOP proxy -- npm run server

functions/             # Cloudflare Pages Functions (production API)
├── _lib/              # Shared helpers (env, CORS, rate limiting)
├── api/               # /api/hypothesis, /api/weekly-plan, /api/whoop/token, /api/health
└── hypothesis.ts      # Root-level backward-compat mount
                       # Parallel Workers-runtime port of server/index.js's
                       # routes -- see CLOUDFLARE.md. Kept in sync by hand;
                       # Express and Workers don't share a runtime.

wrangler.toml          # Cloudflare Pages config (build output dir, rate
                       # limiting binding)

assets/                # Static assets (images, fonts)
```

## Key Features

### Hypothesis Generation System
1. User enters a desired outcome (e.g., "have more energy")
2. User adds daily activities they believe influence the outcome
3. AI generates a clear, neutral hypothesis connecting activities to outcome
4. Hypothesis displayed in formatted box for review

### UI Features
- Dark/light theme support with automatic detection
- Keyboard-aware layout (platform-specific)
- Loading indicators during API calls
- Error handling with user-friendly messages
- Chip-based activity display
- Input validation

## Architecture Patterns

### 1. Expo Router (File-Based Routing)
- Routes automatically generated from file structure
- Type-safe routes with `typedRoutes: true`
- Similar to Next.js routing pattern

### 2. Secure API Architecture
- Backend proxy pattern prevents client-side API key exposure
- Server-side OpenAI integration
- Fallback mechanisms for offline/error scenarios
- Never expose `OPENAI_API_KEY` to client

### 3. Theme System
- Centralized color definitions in `constants/Colors.ts`
- Theme-aware components using `useThemeColor` hook
- Automatic light/dark mode detection
- Platform-specific color scheme handling

### 4. Platform Abstraction
- Platform-specific files (`.web.ts`, `.native.ts`)
- `useClientOnlyValue` hook for hydration-safe rendering
- Conditional rendering based on `Platform.OS`

## API Integration

### Backend Endpoint
```
POST http://localhost:4000/hypothesis
Body: { outcome: string, activities: string[] }
Response: { hypothesis: string, usedFallback: boolean }
```

### Client-Side Communication (lib/llm.ts)
- Base URL resolution priority:
  1. `EXPO_PUBLIC_API_BASE_URL` environment variable
  2. Web: Current origin + port 4000
  3. Native: Expo hostUri + port 4000
  4. Fallback: Local template generation

### Error Handling
- Network errors → fallback hypothesis
- API errors → fallback hypothesis
- Missing backend → fallback hypothesis
- Graceful degradation ensures app always works

## Environment Variables

### Backend (.env in server/)
- `OPENAI_API_KEY` - OpenAI API key (required for AI features)
- `PORT` - Server port (default: 4000)

### Frontend
- `EXPO_PUBLIC_API_BASE_URL` - Backend URL override (optional)
- `EXPO_PUBLIC_OPENAI_API_KEY` - Alternative API key location

## Development Workflow

### Running the App
```bash
npm run android    # Run on Android
npm run ios        # Run on iOS
npm run web        # Run on web browser
npm run server     # Start Express backend (port 4000)
```

### Development Best Practices
1. Always run backend server when testing AI features
2. Use TypeScript strict mode for type safety
3. Test on multiple platforms (iOS, Android, Web)
4. Follow Expo Router conventions for routing
5. Use theme-aware components from `components/Themed.tsx`
6. Handle loading and error states for all async operations

## Code Style Guidelines

### Component Structure
- Use functional components with hooks
- Keep components focused and single-purpose
- Extract reusable logic into custom hooks
- Use TypeScript for all new code

### State Management
- Local component state using React hooks (useState)
- No external state management library needed for current scope
- Lift state when sharing between components

### Styling
- Use StyleSheet.create for performance
- Follow flex-based layouts for responsiveness
- Use theme colors from `constants/Colors.ts`
- Ensure proper contrast for accessibility

### Error Handling
- Always provide user-friendly error messages
- Implement loading states for async operations
- Validate inputs before API calls
- Use try-catch blocks for async operations

## Testing Considerations

### Areas to Test
- Hypothesis generation with various inputs
- Fallback behavior when backend unavailable
- Theme switching (light/dark mode)
- Platform-specific behavior (iOS, Android, Web)
- Keyboard interactions and layout
- Error scenarios and edge cases

## Future Enhancement Ideas

- User authentication and data persistence
- Hypothesis tracking over time
- Activity suggestions based on outcomes
- Data visualization of hypothesis results
- Social sharing features
- Offline mode with local storage

## Common Tasks

### Adding a New Screen
1. Create file in `app/` directory (e.g., `app/new-screen.tsx`)
2. Route automatically available at `/new-screen`
3. Add navigation link using `<Link href="/new-screen">`

### Adding a New API Endpoint
1. Add route in `server/index.js`
2. Update `lib/llm.ts` with client function
3. Handle errors and fallbacks
4. Test with and without backend running

### Updating Theme Colors
1. Edit `constants/Colors.ts`
2. Colors automatically apply to theme-aware components
3. Test in both light and dark modes

### Adding Dependencies
```bash
npm install <package>           # Add to package.json
npx expo install <package>      # Expo-compatible version
```

## Troubleshooting

### Backend Connection Issues
- Ensure server is running on port 4000
- Check `EXPO_PUBLIC_API_BASE_URL` if using custom URL
- Verify CORS configuration for web platform
- Check network connectivity

### Platform-Specific Issues
- iOS: Check Info.plist for required permissions
- Android: Check AndroidManifest.xml for permissions
- Web: Check for hydration errors, use `useClientOnlyValue`

### Build Issues
- Clear cache: `npx expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check TypeScript errors: `npx tsc --noEmit`
