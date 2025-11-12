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
NEXT_PUBLIC_SUPABASE_URL = https://uxtdsiqlzhzrwqyozuho.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dGRzaXFsemh6cndxeW96dWhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI2NTQ0MjksImV4cCI6MjA3ODIzMDQyOX0.jsXukhV2ApAv1cay_59nChhoq8XQmcfJDXlYLamLHGE
SUPABASE_SERVICE_ROLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4dGRzaXFsemh6cndxeW96dWhvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjY1NDQyOSwiZXhwIjoyMDc4MjMwNDI5fQ.AOmg3wiDAYe4JyQVVFcUbUadXNhgSTPQQ-YuF64lpBc
```

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
