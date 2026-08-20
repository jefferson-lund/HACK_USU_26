import { ScrollViewStyleReset } from 'expo-router/html';

import { VERSION_STORAGE_KEY } from '@/lib/siteVersion';

/**
 * Web-only HTML shell, rendered by Node at export time. Global to every route,
 * so nothing here can differ per version.
 */
export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>wohl</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: responsiveBackground }} />
        <script dangerouslySetInnerHTML={{ __html: versionGate }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

// The screens hardcode a light palette (see constants/Colors.ts) and
// useColorScheme.web.ts always returns 'light', so a dark body would just put
// a black frame behind white content.
const responsiveBackground = `
body {
  background-color: #fff;
}`;

/**
 * Honors the stored version before the JS bundle is requested, so a returning
 * visitor never sees a frame of the wrong version -- only a brief blank one.
 *
 * The pathname guard is essential: this script runs on every route, so without
 * it, loading /legacy while the preference said "v2" would bounce straight
 * back and make the switch unusable. Only "/" is ambiguous.
 */
const versionGate = `
(function () {
  try {
    var p = window.location.pathname.replace(/\\/index\\.html$/, '/');
    if (p !== '/' && p !== '') return;
    if (window.localStorage.getItem('${VERSION_STORAGE_KEY}') !== 'legacy') return;
    window.location.replace('/legacy' + window.location.search + window.location.hash);
  } catch (e) {
    // Storage blocked (e.g. Safari private browsing). The root layout's
    // post-hydration effect handles it instead.
  }
})();`;
