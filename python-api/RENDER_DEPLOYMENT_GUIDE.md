# Deploying Python API to Render

This guide will help you deploy your FastAPI maintenance analysis API to Render.

## Prerequisites

- GitHub account
- Render account (sign up at https://render.com)
- Your code pushed to a GitHub repository

## Step 1: Prepare Your Repository

1. **Ensure all necessary files are present:**
   - ✅ `main.py` - Your FastAPI application
   - ✅ `requirements.txt` - Python dependencies
   - ✅ `render.yaml` - Render configuration (created)
   - ✅ `.env.example` - Environment variable template

2. **Create a `.gitignore` file** (if not already present):
   ```
   .env
   __pycache__/
   *.pyc
   *.log
   .DS_Store
   ```

3. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

## Step 2: Set Up Render Service

### Option A: Using Blueprint (Recommended)

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will automatically detect `render.yaml`
5. Click **"Apply"**

### Option B: Manual Setup

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure the service:
   - **Name:** `coliving-maintenance-api` (or your preferred name)
   - **Region:** Choose closest to your users (e.g., Oregon, Singapore)
   - **Branch:** `main` (or your default branch)
   - **Root Directory:** `coliving_tenant_app/python-api`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan:** Free (for testing) or Starter (for production)

## Step 3: Configure Environment Variables

1. In your Render dashboard, go to your service
2. Navigate to **"Environment"** tab
3. Add the following environment variables:
   - `OPENROUTER_API_KEY` - Your OpenRouter API key
   - `PYTHON_VERSION` - `3.11.0` (optional, Render auto-detects)
   - Any other variables from your `.env` file

**Important:** Do NOT commit your `.env` file to GitHub!

## Step 4: Deploy

1. Click **"Create Web Service"** or **"Deploy"**
2. Render will:
   - Clone your repository
   - Install dependencies from `requirements.txt`
   - Start your FastAPI application
   - Assign you a public URL (e.g., `https://your-service.onrender.com`)

## Step 5: Monitor Deployment

1. Watch the build logs in real-time
2. Check for any errors during installation
3. Wait for the service to become live (may take 5-10 minutes on first deploy)

## Step 6: Test Your Deployment

Once deployed, test your API:

```bash
# Check health endpoint
curl https://your-service.onrender.com/

# Test an endpoint
curl -X POST https://your-service.onrender.com/analyze-with-chat \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test-image.jpg" \
  -F "user_description=broken sink"
```

## Important Considerations

### 1. **Model Loading & Cold Starts**

Your API loads large ML models (BLIP, transformers), which can cause:
- **Long initial startup time** (5-15 minutes)
- **High memory usage** (may exceed free tier limits)
- **Cold start delays** after inactivity

**Solutions:**
- Upgrade to a paid plan with more RAM (at least 2-4 GB)
- Consider using Render's persistent disk for model caching
- Implement health check endpoint to keep service warm
- Use lighter model versions if possible

### 2. **Free Tier Limitations**

Render's free tier:
- ⏸️ Spins down after 15 minutes of inactivity
- 🐌 Cold starts can take 30+ seconds
- 💾 512 MB RAM (may not be enough for ML models)
- 🚫 No persistent storage

**Recommendation:** Use at least the **Starter plan ($7/month)** for ML workloads.

### 3. **Update Your Frontend**

Update your Next.js tenant app to use the Render URL:

```typescript
// In your tenant app configuration
const PYTHON_API_URL = process.env.NEXT_PUBLIC_PYTHON_API_URL || 
  'https://your-service.onrender.com';
```

Add to your `.env.local`:
```
NEXT_PUBLIC_PYTHON_API_URL=https://your-service.onrender.com
```

### 4. **CORS Configuration**

Ensure your `main.py` allows requests from your frontend domain:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-frontend-domain.vercel.app",  # Add your frontend URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Troubleshooting

### Build Fails

- Check `requirements.txt` for incompatible versions
- Look for missing system dependencies
- Review build logs for specific errors

### Out of Memory

- Upgrade to a larger instance type
- Reduce model sizes or use quantized versions
- Implement lazy loading for models

### Slow Response Times

- Cold starts are normal on free tier
- Consider using cron jobs to keep service warm
- Upgrade to paid plan for always-on service

### Health Check Failures

Add a simple health endpoint to `main.py`:

```python
@app.get("/")
async def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
```

## Monitoring & Maintenance

1. **Check Logs:** Render dashboard → Logs tab
2. **Monitor Metrics:** CPU, Memory, Response times
3. **Set Up Alerts:** Configure notifications for downtime
4. **Auto-Deploy:** Enable automatic deploys on git push

## Costs Estimation

- **Free Tier:** $0/month (limited, spins down)
- **Starter:** $7/month (512 MB RAM)
- **Standard:** $25/month (2 GB RAM) - **Recommended for ML models**
- **Pro:** $85/month (4 GB RAM) - For production

## Additional Resources

- [Render Python Documentation](https://render.com/docs/deploy-fastapi)
- [FastAPI Deployment Guide](https://fastapi.tiangolo.com/deployment/)
- [Render Community](https://community.render.com/)

## Next Steps

After successful deployment:

1. ✅ Test all API endpoints
2. ✅ Update frontend to use new API URL
3. ✅ Set up monitoring and alerts
4. ✅ Consider implementing caching for frequently used models
5. ✅ Document API endpoints for your team

---

**Need Help?** Check Render's documentation or contact their support team.
