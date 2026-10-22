import './mobile-a32-search-tabs-contract.cjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const screen = readFileSync(new URL('../src/experience/MobileExperience.tsx', import.meta.url), 'utf8');
const client = readFileSync(new URL('../src/experience/feed-api.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const requireSource = (source, value) => assert.ok(source.includes(value), 'Missing integration contract: ' + value);
requireSource(app, 'if (session) return <MobileExperience session={session}');
requireSource(app, 'getSupabase().auth.signOut()');
requireSource(app, 'syncMobileAccount(result.data.session.access_token)');
for (const path of [
  '/feed/', '/search?q=', '/posts/', '/like', '/save', '/comments', '/users/',
  '/bookings/slots', '/bookings'
]) requireSource(client, path);
for (const item of ['VideoView', 'FlatList', 'pagingEnabled', 'onEndReached', 'post.media',
                    "sheet === 'comments'", "sheet === 'service'", "sheet === 'booking'",
                    'EXPO_PUBLIC_HUSTLE_ENABLE_BOOKING_REQUESTS', "Alert.alert('Send booking request?'"]) {
  requireSource(screen, item);
}
for (const dep of ['expo-video','@expo/vector-icons','react-native-safe-area-context']) assert.ok(pkg.dependencies[dep], 'Dependency missing: ' + dep);
assert.ok(!screen.includes('hustle.example'), 'Placeholder external share link must not be shipped');
assert.ok(!screen.includes('escrow.release'), 'No escrow writes from the mobile UI');
console.log('Mobile source-contract gate: PASS (auth handoff, API routes, feed, guarded booking and dependencies)');
