# Alalay Mobile Auth Setup

## Android APK release source of truth

Run every Expo/EAS command from this `mobile/` directory. `app.json` and
`eas.json` here are the only mobile build configuration. Alalay's permanent
Android application ID is `com.itchaaan.alalay`; do not change it after APKs
are distributed, because Android only accepts an update when its application
ID and signing certificate match the installed app.

Both `preview` and `production` EAS profiles intentionally create internal
APKs. No Play Store submission is configured. Before a release build, use
EAS-managed Android credentials and confirm the certificate fingerprint from
the downloaded artifact. Never commit a keystore, its password, or EAS tokens.

## Public Supabase build configuration

`app.json` is static and `eas.json` selects the EAS `preview` or `production`
environment for those profiles. Expo replaces `EXPO_PUBLIC_*` values while it
bundles JavaScript, so an APK cannot read `mobile/.env` after it has been
built. The local `.env` is intentionally ignored and is not uploaded to EAS.

In Expo Dashboard, open the Alalay project, then **Environment variables**:

1. Select the `preview` or `production` environment.
2. Add `EXPO_PUBLIC_SUPABASE_URL` using that environment's HTTPS Supabase
   project URL.
3. Add `EXPO_PUBLIC_SUPABASE_ANON_KEY` using only that project's anon or
   publishable key.
4. Add `EXPO_PUBLIC_API_URL` using the HTTPS API origin for that environment.
5. Rebuild the APK after saving the values; changing an EAS variable does not
   alter an APK that already exists.

The same public values can be supplied from an approved CI secret store. Do
not add a service-role key, database password, OAuth client secret, scheduler
secret, or any other private key to an EAS environment used by the mobile app.
The `eas-build-pre-install` hook runs `npm run validate:public-env` and fails
the build before dependency installation if either required Supabase value is
missing, malformed, or is a service-role JWT. It intentionally prints no
configuration values or variable names.

For local development, copy `.env.example` to `.env`, set the public values,
and run:

```powershell
npm run validate:public-env
npm start
```

For an internal preview APK, configure the `preview` EAS environment first,
then run:

```powershell
eas build --platform android --profile preview
```

For the corrected production APK, configure the `production` EAS environment
first, then run this exact command from `mobile/`:

```powershell
eas build --platform android --profile production
```

If your organization manages public build configuration from the EAS CLI
instead of the dashboard, create the same variables in the matching
environment (for example `eas env:create --environment production`) and do
not place values in source control. There is no Android EAS build job in this
repository's GitHub Actions workflow; it runs quality checks only. A locally
generated `expo run:android`/Gradle APK uses the local build environment and
is not evidence that EAS production values are configured.

If using a local keystore instead of EAS-managed credentials, retain an
encrypted offline backup of the keystore, alias, and credentials in the team's
approved secret manager. Losing it prevents future APKs from updating existing
installations. Configure or inspect credentials interactively only:

```powershell
eas credentials --platform android
```

This command must be run by an authorized account holder; it does not publish
or submit a build.

Mobile email confirmation uses `Linking.createURL('/auth/callback')` and the
Expo Router route at `/auth/callback`. The generated Expo Go URL is logged only
in development so it can be added to Supabase without exposing credentials.

In Supabase Dashboard → Authentication → URL Configuration:

1. Keep the existing web Site URL and web callback URLs.
2. Add the development redirect printed by the mobile app, for example the
   Expo Go URL produced by `Linking.createURL('/auth/callback')`.
3. Add `alalay://auth/callback` for development builds and production builds.
   Expo Go must use its generated `exp://.../--/auth/callback` URL instead;
   do not force the `alalay://` scheme inside Expo Go.

Keep `https://alalay-orpin.vercel.app` as the Supabase Site URL and retain the
exact web callback `https://alalay-orpin.vercel.app/auth/callback`. Remove the
broad `alalay://**` pattern if the dashboard accepts the exact native callback.

Expo Go development URLs can change when the LAN address or Expo server
changes. A development build is recommended for stable deep-link testing. A
scheme change requires rebuilding the native app; it cannot be fully applied
to an already-installed Expo Go or native binary.

Google Cloud must continue to use the Supabase provider callback
`https://your-project.supabase.co/auth/v1/callback`; do not add the native
scheme there. Supabase must allowlist `alalay://auth/callback` so it can return
to the APK rather than falling back to the web Site URL.
