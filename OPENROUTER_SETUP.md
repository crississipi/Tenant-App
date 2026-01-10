# OpenRouter API Integration for AI Image Analysis

This application uses OpenRouter to analyze maintenance request images with AI vision models.

## Setup

1. **Get an OpenRouter API Key**
   - Sign up at [https://openrouter.ai](https://openrouter.ai)
   - Navigate to "Keys" section
   - Create a new API key

2. **Configure Environment Variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Add your OpenRouter API key to `.env.local`:
   ```
   OPENROUTER_API_KEY="your-actual-api-key-here"
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

3. **API Model Used**
   - **Primary**: `google/gemini-2.0-flash-exp:free` (Vision-capable, free tier)
   - **Fallback**: Python API (existing implementation)

## How It Works

### AICameraCapture Component (Real-time Analysis)
- Uses OpenRouter API via `/api/analyze-image-openrouter`
- Analyzes each captured image immediately
- Displays urgency level and confidence score
- Shows analysis results in sidebar (desktop)

### SubmitNewRequest Component (Fallback)
- Uses Python API via `/api/analyze-image`
- Processes images when form is submitted
- Provides comprehensive analysis for final submission

## API Routes

### `/api/analyze-image-openrouter` (Primary - OpenRouter)
**POST** - Analyzes images using OpenRouter's vision models

**Request:**
```
FormData with 'files' field containing image files
```

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "success": true,
      "description": "Detailed description of the image",
      "maintenance_issue": "Specific issue identified",
      "urgency": "low|medium|high|critical",
      "category": "electrical|plumbing|structural|etc",
      "confidence_score": 0.95
    }
  ],
  "total": 1,
  "successful": 1
}
```

### `/api/analyze-image` (Fallback - Python API)
Existing endpoint that uses the Python backend for image analysis.

## Urgency Levels

- **Critical**: Immediate safety hazard or severe damage
- **High**: Significant issue requiring prompt attention
- **Medium**: Moderate issue, should be addressed soon
- **Low**: Minor issue or cosmetic concern

## Categories

- Electrical
- Plumbing
- Structural
- Appliance
- Cosmetic
- Safety
- Other

## Cost Considerations

- Using free tier models when possible
- OpenRouter free models have rate limits
- Monitor usage at [https://openrouter.ai/usage](https://openrouter.ai/usage)
- Python API acts as zero-cost fallback

## Error Handling

The system includes comprehensive error handling:
1. If OpenRouter fails → Returns error but continues
2. If image analysis fails → Image still gets uploaded
3. Python API always available as fallback in final submission

## Testing

1. Capture an image with the camera
2. Check browser console for analysis logs
3. View analysis results in the sidebar (desktop)
4. Submit the request to verify fallback flow
