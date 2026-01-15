# Setting Up Python API as Separate Repository

This guide shows you how to move the Python API to its own GitHub repository for easier Render deployment.

## Step 1: Create New GitHub Repository

1. Go to https://github.com/new
2. Create a new repository:
   - **Name:** `coliving-ai` (or your preferred name)
   - **Description:** "AI-powered maintenance analysis API for CoLiving platform"
   - **Visibility:** Private or Public
   - **Do NOT** initialize with README, .gitignore, or license (we already have these)
3. Click **"Create repository"**

## Step 2: Prepare the Python API Directory

The following files are already prepared in your `python-api` folder:
- ✅ `main.py` - Main FastAPI application
- ✅ `requirements.txt` - Dependencies
- ✅ `render.yaml` - Render configuration (updated for standalone repo)
- ✅ `.gitignore` - Git ignore rules
- ✅ `.env.example` - Environment template
- ✅ `README.md` - Repository documentation
- ✅ `RENDER_DEPLOYMENT_GUIDE.md` - Deployment guide

## Step 3: Initialize and Push to New Repository

Open a terminal and run:

```bash
# Navigate to the python-api directory
cd c:\xampp\htdocs\capstone\coliving_tenant_app\python-api

# Initialize git repository
git init

# Add all files (will respect .gitignore)
git add .

# Make first commit
git commit -m "Initial commit: CoLiving AI maintenance analysis API"

# Add your GitHub repository as remote
git remote add origin https://github.com/colivingdevteam/coliving-ai.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 4: Deploy to Render

### IMPORTANT: Verify Your Repository First

Before deploying, make sure:
1. All files are pushed to GitHub
2. Check your repository online: https://github.com/colivingdevteam/coliving-ai
3. Verify that `requirements.txt` and `main.py` are visible in the root

### Option A: Manual Setup (Recommended - More Control)

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect your repository: `coliving-ai`
4. **CRITICAL: Configure these EXACT settings:**
   - **Name:** `coliving-ai`
   - **Region:** Singapore (or closest to users)
   - **Branch:** `main`
   - **Root Directory:** Leave **BLANK** (empty)
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Instance Type:** Free (or Starter for 2GB RAM)
5. **Environment Variables** (click "Advanced"):
   - Add `OPENROUTER_API_KEY` with your actual API key
   - Add `PYTHON_VERSION` = `3.11.0` (optional)
6. Click **"Create Web Service"**

### Option B: Using Blueprint

1. Go to https://dashboard.render.com
2. Click **"New +"** → **"Blueprint"**
3. Connect your new repository: `coliving-ai`
4. Render will auto-detect `render.yaml`
5. Add environment variables:
   - `OPENROUTER_API_KEY` - Your OpenRouter API key
6. Click **"Apply"**

### If You're Still Getting "requirements.txt not found" Error:

**Check these:**

1. **Verify files are in repository root:**
   ```bash
   cd c:\xampp\htdocs\capstone\coliving_tenant_app\python-api
   git status
   git log --oneline  # Should show your commits
   ```

2. **Make sure you pushed everything:**
   ```bash
   git push origin main
   ```

3. **In Render Dashboard:**
   - Go to your service
   - Click **"Manual Deploy"** → **"Clear build cache & deploy"**
   - Watch the logs carefully

4. **Double-check Root Directory setting:**
   - In Render service settings
   - **Root Directory** must be **BLANK** (empty, not "." or "/")
   - If it shows anything, delete it and save

## Step 5: Update Your Tenant App

Update your Next.js tenant app to use the new API URL:

1. Open `coliving_tenant_app/.env.local`
2. Add or update:
```env
NEXT_PUBLIC_PYTHON_API_URL=https://coliving-ai.onrender.com
```

3. In your API calls, use:
```typescript
const apiUrl = process.env.NEXT_PUBLIC_PYTHON_API_URL || 'http://localhost:8000';
```

## Step 6: Update CORS Settings

Make sure your `main.py` allows requests from your frontend:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "https://your-tenant-app.vercel.app",  # Add your deployed frontend URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Benefits of Separate Repository

✅ **Simpler Deployment** - No need for `rootDirectory` configuration
✅ **Independent Versioning** - API has its own version history
✅ **Easier CI/CD** - Cleaner build and deployment pipelines
✅ **Better Organization** - Clear separation of concerns
✅ **Smaller Repository** - Faster clones and builds

## Future Maintenance

### Updating the API

```bash
cd c:\path\to\coliving-ai

# Make your changes
# Edit main.py or other files

# Commit and push
git add .
git commit -m "Description of changes"
git push origin main
```

Render will automatically redeploy when you push to the `main` branch.

### Managing Environment Variables

Update environment variables in the Render dashboard:
1. Go to your service
2. Click **"Environment"** tab
3. Add/edit variables
4. Click **"Save Changes"**

## Troubleshooting

### Build Fails
- Check logs in Render dashboard
- Verify `requirements.txt` is valid
- Ensure Python version compatibility

### API Not Responding
- Check if service is running in Render dashboard
- Verify environment variables are set
- Check logs for errors

### CORS Errors
- Update `allow_origins` in `main.py`
- Redeploy after changes

## Repository Structure

Your new `coliving-ai` repository will have this structure:

```
coliving-ai/
├── .env.example
├── .gitignore
├── main.py
├── README.md
├── render.yaml
├── requirements.txt
├── RENDER_DEPLOYMENT_GUIDE.md
└── SETUP_SEPARATE_REPO.md (this file)
```

## Next Steps

1. ✅ Create GitHub repository
2. ✅ Push code to new repository
3. ✅ Deploy to Render
4. ✅ Test API endpoints
5. ✅ Update tenant app configuration
6. ✅ Monitor deployment

---

**Success!** Your Python API is now a standalone service that can be deployed and managed independently.
