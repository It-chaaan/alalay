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
