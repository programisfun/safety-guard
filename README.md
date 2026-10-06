

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

## Checks

```bash
npx tsc --noEmit
npx expo lint
```
