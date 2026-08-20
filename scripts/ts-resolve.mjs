// Lets the dev scripts import the app's TypeScript modules directly.
//
// The repo uses extensionless relative imports ('./dateKey'), which Metro and
// tsc both resolve but Node's ESM resolver does not. This hook retries a
// failed relative specifier with the TS extensions appended, so scripts/ can
// run app code without a build step or a second import convention.
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CANDIDATES = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (!specifier.startsWith('.') || !context.parentURL) throw err;
      const base = new URL(specifier, context.parentURL).href;
      for (const ext of CANDIDATES) {
        const candidate = new URL(base + ext);
        if (existsSync(fileURLToPath(candidate))) {
          // Recurse rather than returning a url directly, so Node still does
          // its own format detection and applies type stripping to the .ts.
          return nextResolve(specifier + ext, context);
        }
      }
      throw err;
    }
  },
});
