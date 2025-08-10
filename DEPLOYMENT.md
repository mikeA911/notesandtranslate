# Deployment Guide

## Backend Deployment to Railway

### Files Created:
- `railway.json` - Railway configuration
- `nixpacks.toml` - Build configuration
- `.env.railway` - Environment variables template

### Steps:
1. Push your code to GitHub
2. Go to [railway.app](https://railway.app)
3. Create new project → "Deploy from GitHub repo"
4. Select your repository
5. Add environment variables from `.env.railway` file
6. Deploy automatically builds and runs

### Environment Variables to Set in Railway Dashboard:
```
NODE_ENV=production
SUPABASE_URL=https://wehcgfyykmqhcuzjykio.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlaGNnZnl5a21xaGN1emp5a2lvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2NDI1OTMsImV4cCI6MjA3MDIxODU5M30.m_xHOnMLl1Uxm7QskOU_oMzdFcnpv3GpjmZysXhJyiE
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlaGNnZnl5a21xaGN1emp5a2lvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY0MjU5MywiZXhwIjoyMDcwMjE4NTkzfQ.XoO3KxP8V2XI5KIxYTElLbnbr77XK4nskqidY4cXWng
STRIPE_SECRET_KEY=your_production_stripe_key
STRIPE_WEBHOOK_SECRET=your_production_webhook_secret
SENDGRID_API_KEY=your_sendgrid_api_key
FROM_EMAIL=noreply@groupspark.com
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=groupspark-uploads
AWS_REGION=us-east-1
FRONTEND_URL=https://your-app.netlify.app
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Frontend Deployment to Netlify

### Files Created:
- `netlify.toml` - Netlify configuration
- `_redirects` - SPA routing redirects
- `.env` - Development environment
- `.env.production` - Production environment template

### Steps:
1. **Update Environment Variables**: 
   - Edit `.env.production` and replace `YOUR_RAILWAY_URL` with your actual Railway URL
   
2. **Manual Deployment**:
   - Run `npm run build` locally
   - Drag and drop the `dist` folder to [netlify.com/drop](https://netlify.com/drop)

3. **Automatic Deployment**:
   - Go to [netlify.com](https://netlify.com)
   - New site from Git → Connect to GitHub
   - Select your repository
   - Build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Add environment variables:
     ```
     VITE_API_URL=https://your-railway-url.railway.app
     GEMINI_API_KEY=your_gemini_api_key
     GROUPSPARK_API_URL=https://your-railway-url.railway.app
     ```

### After Deployment:
1. Copy your Netlify URL (e.g., https://your-app.netlify.app)
2. Update the `FRONTEND_URL` variable in your Railway backend deployment
3. Update CORS settings in your backend if needed

## Final Steps:
1. Test your deployed frontend → should connect to your Railway backend
2. Update any hardcoded URLs in your code to use environment variables
3. Test all functionality (translations, API calls, etc.)

## Environment Variables Summary:

### Backend (Railway):
- All database, API, and service credentials
- FRONTEND_URL pointing to Netlify deployment

### Frontend (Netlify):  
- VITE_API_URL pointing to Railway deployment
- GEMINI_API_KEY for AI features
- GROUPSPARK_API_URL for backend API calls