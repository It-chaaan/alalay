# Alalay Mobile Auth Setup

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

Expo Go development URLs can change when the LAN address or Expo server
changes. A development build is recommended for stable deep-link testing. A
scheme change requires rebuilding the native app; it cannot be fully applied
to an already-installed Expo Go or native binary.
