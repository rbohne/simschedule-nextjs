# Deployment Guide for SIM Schedule Application

## Prerequisites
- GitHub account (free): https://github.com
- Vercel account (free): https://vercel.com
- Your GoDaddy domain access

---

## Step 1: Configure Git and Push to GitHub

### 1.1 Configure Git (One-time setup)
Open your terminal and run:
```bash
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"
```

### 1.2 Create Initial Commit
```bash
cd C:\Code\simschedule-nextjs
git commit -m "Initial commit - SIM Schedule application"
```

### 1.3 Create GitHub Repository
1. Go to https://github.com and sign in
2. Click the "+" icon in top right > "New repository"
3. Name it: `simschedule-nextjs`
4. Leave it **PUBLIC** (required for free Vercel hosting)
5. Do NOT initialize with README (we already have code)
6. Click "Create repository"

### 1.4 Push Code to GitHub
After creating the repository, GitHub will show you commands. Run:
```bash
git remote add origin https://github.com/YOUR-USERNAME/simschedule-nextjs.git
git branch -M main
git push -u origin main
```

Replace `YOUR-USERNAME` with your actual GitHub username.

---

## Step 2: Deploy to Vercel

### 2.1 Sign Up for Vercel
1. Go to https://vercel.com
2. Click "Sign Up"
3. Choose "Continue with GitHub"
4. Authorize Vercel to access your GitHub account

### 2.2 Import Your Project
1. On Vercel dashboard, click "Add New..." > "Project"
2. Find `simschedule-nextjs` repository and click "Import"
3. **Configure Project:**
   - Framework Preset: Next.js (should auto-detect)
   - Root Directory: `./`
   - Build Command: (leave default)
   - Output Directory: (leave default)

### 2.3 Add Environment Variables
Click "Environment Variables" and add these:

```
SUPABASE_SERVICE_ROLE_KEY = your-supabase-secret-key
```

**Important Notes:**
- The client-side keys (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are hardcoded in `src/lib/supabase.ts` due to a Next.js 16 + Turbopack compatibility issue, so you don't need to add them as environment variables in Vercel.
- Only the server-side `SUPABASE_SERVICE_ROLE_KEY` needs to be configured.

**To find the Secret Key:**
1. Go to your Supabase project dashboard at https://supabase.com
2. Click "Settings" (gear icon) > "API"
3. In the **Project API keys** section, copy the **Secret Key** (NOT the Publishable Key)
4. **Important**: Supabase updated their key format in 2024. The new keys start with `sb_secret_...` or similar. If you have an old JWT-format key (starts with `eyJ...`), you may see "Legacy API keys are disabled" errors. Use the new Secret Key format.

4. Click "Deploy"

Vercel will now build and deploy your app! This takes 2-3 minutes.

---

## Step 3: Configure Custom Domain (GoDaddy)

After deployment, Vercel will give you a URL like: `simschedule-nextjs.vercel.app`

### 3.1 Add Domain in Vercel
1. In your Vercel project, go to "Settings" > "Domains"
2. Enter your GoDaddy domain (e.g., `yourdomain.com`)
3. Click "Add"
4. Vercel will show you DNS records to add

### 3.2 Update DNS in GoDaddy
1. Log into your GoDaddy account
2. Go to "My Products" > "DNS" for your domain
3. Add the records that Vercel provided:

   **For root domain (yourdomain.com):**
   - Type: A
   - Name: @
   - Value: 76.76.21.21
   - TTL: 600

   **For www subdomain:**
   - Type: CNAME
   - Name: www
   - Value: cname.vercel-dns.com
   - TTL: 600

4. Click "Save"

DNS changes can take 5 minutes to 48 hours (usually ~10 minutes).

---

## Step 4: Update Supabase Settings

### 4.1 Add Production URL to Supabase
1. Go to https://supabase.com
2. Open your project
3. Go to "Authentication" > "URL Configuration"
4. Add your new domain to "Site URL" and "Redirect URLs":
   - `https://yourdomain.com`
   - `https://yourdomain.com/**`
   - `https://simschedule-nextjs.vercel.app`
   - `https://simschedule-nextjs.vercel.app/**`

---

## Step 5: Test Your Deployment

1. Visit your Vercel URL: `https://simschedule-nextjs.vercel.app`
2. Try logging in
3. Test booking a time slot
4. Test admin functions
5. Once DNS propagates, visit your custom domain

---

## Troubleshooting

### Build Failed
- Check the build logs in Vercel
- Ensure all environment variables are set correctly

### Login Not Working
- Make sure Supabase URLs are added correctly
- Check that environment variables match your local `.env.local`
- Verify you're using the new Supabase Secret Key format (not legacy JWT format)

### Pages Timeout and Redirect to Login
- **Symptom**: After navigating between pages or waiting on a page, you get redirected to login
- **Cause**: Missing Authorization headers on API endpoint calls
- **Fix**: Ensure all API route handlers accept the `request` parameter and all fetch calls include Authorization headers using `getAuthHeaders()` helper function
- **Example**: See `/src/app/messages/page.tsx` for proper implementation

### API Returns 401 Unauthorized Errors
- **Symptom**: API endpoints return "Unauthorized" even when logged in
- **Cause**: API route not receiving authentication token from client
- **Fix**: 
  1. Ensure the API route's GET/POST/PATCH/DELETE function accepts `request: Request` parameter
  2. Pass the request to `createServerSupabaseClient(request)`
  3. On the client side, use `getAuthHeaders()` to include Authorization header in fetch calls

### "Legacy API keys are disabled" Error
- **Symptom**: Admin operations fail with this error
- **Cause**: Using old JWT-format Supabase service role key
- **Fix**: Update `SUPABASE_SERVICE_ROLE_KEY` in Vercel environment variables with the new Secret Key from Supabase dashboard (starts with `sb_secret_...`)

### Domain Not Working
- Wait up to 48 hours for DNS propagation
- Use https://dnschecker.org to verify DNS changes
- Ensure you're using HTTPS (not HTTP)

---

## Future Updates

When you make changes to your code:

1. Commit changes:
```bash
git add .
git commit -m "Description of changes"
git push
```

2. Vercel will automatically detect the push and redeploy!

---

## Costs

- **Vercel**: FREE (Hobby plan supports your needs)
- **Supabase**: FREE (up to 500MB database, 2GB bandwidth/month)
- **GoDaddy Domain**: You already own this (~$15/year typically)

**Total ongoing cost: $0/month** (just your existing domain renewal)

---

## Support

If you encounter issues:
- Vercel: https://vercel.com/docs
- Supabase: https://supabase.com/docs
- Next.js: https://nextjs.org/docs
