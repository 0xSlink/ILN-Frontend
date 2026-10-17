// Next.js client instrumentation — runs before hydration.
import { installGlobalErrorTracking, attachCompatibilityContextToSentry } from './src/lib/errorTracking';

try {
  installGlobalErrorTracking();
  attachCompatibilityContextToSentry();
} catch {
  // instrumentation must never break startup
}
