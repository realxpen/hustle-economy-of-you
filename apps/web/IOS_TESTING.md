# Hustle — zero-budget iPhone testing

Two complementary surfaces. Neither constitutes a production launch.

## 1. Install Hustle on the iPhone Home Screen (web PWA)

After a reviewed web preview deployment is available over HTTPS:

1. Open that **Hustle web deployment URL** in iPhone Safari.
2. Use Share -> Add to Home Screen (or the Safari Page Menu -> Share path).
3. Enable **Open as Web App**, if offered, and choose **Add**.
4. Tap **Hustle** on the Home Screen. It launches at `/home` in standalone mode.

The PWA has its own standalone browser context. Login state may differ from Safari.
It is not a native React Native build, does not guarantee background notifications,
and requires internet access to load live data. There is intentionally **no service
worker caching sensitive requests or private pages**. Avoid claims of offline support.

The feature ships as a code change first. Do not say it is installed until the
reviewed commit is deployed, the HTTPS routes pass checks, and the owner verifies
the install on their iPhone. Existing web Vercel config disables Git-driven deploys.

## 2. Test the native UI through Expo Go

The `apps/mobile` app uses Expo SDK 54, which is currently available in the
App Store Expo Go build for iOS. Install Expo Go, sign into the same Expo
account used by the CLI (`xpen`), and open the project QR/link **while its
development server is running**.

From the monorepo root, a developer or remote development environment can start
`npm run dev:mobile`. A laptop and iPhone can connect on the same LAN. A remote
server requires a reachable tunnel (for example, `npx expo start --tunnel`
from `apps/mobile`). The remote host must stay running during the session.
The founder does not need to type these commands if an authorized development
environment can run them. A deployed web PWA does not make Expo Go work offline.

Expo Go cannot run arbitrary custom native modules; check native dependency
compatibility before treating an Expo Go pass as native release acceptance.

## Security and release limits

- Use dedicated staging/disposable accounts only; never production credentials.
- Do not enable live booking writes, payment rails or custody by installing a PWA.
- Public API base URLs must be HTTPS and connected to an authorized environment.
- No Apple Developer membership is needed for Expo Go or a Home Screen web app.
- An Apple-signed device build / TestFlight remains a separate future gate.
