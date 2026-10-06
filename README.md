

## Start Development

To start the development server, run:

```bash
npx expo start
```

If you need a tunnel, use:

```bash
npx expo start --tunnel
```

## Local Build (Linux)

To perform a local build on Linux, run the following command:

```bash
eas build --platform android --profile development --local
```

## Supabase

Set up the Supabase project and push the database schema:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Create a new migration:

```bash
npx supabase migration new <name>
```

## EAS Environment Variables (required for builds)

`.env` is gitignored, so EAS Build never sees it. Every `EXPO_PUBLIC_*` value
must exist as an EAS environment variable, otherwise it is inlined as
`undefined` and the app crashes on launch (missing Supabase config).

```bash
npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_URL \
  --value "<url>" --environment development --environment preview \
  --environment production --visibility sensitive --type string --non-interactive

npx eas-cli@latest env:set --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value "<anon-key>" --environment development --environment preview \
  --environment production --visibility sensitive --type string --non-interactive
```

Rules:

- Use `--visibility sensitive` or `plaintext`. **`secret` values are not
  inlined into `EXPO_PUBLIC_*`** and the app will crash on startup.
- Your profile picks the environment automatically: `distribution: store` →
  `production`, `developmentClient: true` → `development`, otherwise →
  `preview`. This project's `production` profile uses `distribution: internal`,
  so it resolves to the `preview` environment — setting all three environments
  covers every profile.
- Verify with `npx eas-cli@latest env:list --environment preview`.

If the variables are missing, the app now opens to a "Supabase is not
configured" error screen instead of crashing.

## Checks

```bash
npx tsc --noEmit
npx expo lint
```

## Viewer

A standalone web app to view the recorded location points on a map:
https://github.com/programisfun/safety-guard-viewer
