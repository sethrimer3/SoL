# Environment Configuration for SoL

## Development Setup

Create a `.env` file in the project root (do not commit this file):

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

## Production Setup

For production builds, set these environment variables in your deployment environment:

### GitHub Pages (GitHub Actions)

Add these as repository secrets:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Then in your GitHub Actions workflow:

```yaml
- name: Build
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
  run: npm run build
```

### Netlify

Add environment variables in Site Settings > Build & Deploy > Environment:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### Vercel

Add environment variables in Project Settings > Environment Variables:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## Webpack Configuration

The webpack.config.js should be updated to inject these at build time:

```javascript
const webpack = require('webpack');

module.exports = {
  // ... other config
  plugins: [
    new webpack.DefinePlugin({
      'process.env.SUPABASE_URL': JSON.stringify(process.env.SUPABASE_URL || ''),
      'process.env.SUPABASE_ANON_KEY': JSON.stringify(process.env.SUPABASE_ANON_KEY || '')
    })
  ]
};
```

## Security Notes

- **Anon Key**: Safe to expose in client-side code (Supabase designed for this)
- **Service Role Key**: NEVER expose in client code (keep server-side only)
- Row Level Security (RLS) policies protect data even with anon key
- For sensitive operations, implement proper authentication

## Getting Supabase Credentials

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project
3. Go to Settings > API
4. Copy your:
   - Project URL (SUPABASE_URL)
   - Anon/Public key (SUPABASE_ANON_KEY)
5. Run the database schema from `supabase.sql` in SQL Editor

## Fallback Behavior

If Supabase credentials are not configured:
- Online play option will be disabled/hidden
- LAN play will still work normally
- Single player mode unaffected
- Console will show warning: "Supabase not configured"
