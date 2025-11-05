from fastapi import FastAPI, File, UploadFile, HTTPException, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from PIL import Image
import io
import torch
from transformers import BlipProcessor, BlipForConditionalGeneration
import logging
import os
import requests
import re
from dotenv import load_dotenv
from typing import List
import json

# Load environment variables
load_dotenv()

app = FastAPI(title="Maintenance Analysis API")

# CORS - allow your Next.js app to call this
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://yourdomain.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global variables for models
processor = None
model = None
HF_TOKEN = os.getenv("HF_API_KEY")

# Hugging Face API URLs
SUMMARIZE_URL = "https://api-inference.huggingface.co/models/facebook/bart-large-cnn"
URGENCY_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1"
COMPARE_URL = "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2"

@app.on_event("startup")
async def load_models():
    """Load models when the application starts"""
    global processor, model
    try:
        logger.info("Loading BLIP model...")
        processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-large")
        model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-large")
        logger.info("Models loaded successfully!")
    except Exception as e:
        logger.error(f"Error loading models: {e}")
        raise e

@app.get("/")
async def root():
    return {"message": "Maintenance Analysis API is running!"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "models_loaded": model is not None}

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"Response status: {response.status_code}")
    return response

def process_single_image(image: Image.Image, prompt: str) -> str:
    """Process a single image with proper error handling"""
    try:
        # Method 1: Try with padding first
        try:
            inputs = processor(
                image, 
                prompt, 
                return_tensors="pt",
                padding=True
            )
        except Exception as padding_error:
            logger.warning(f"Padding method failed, trying without padding: {padding_error}")
            # Method 2: Try without padding
            inputs = processor(
                image, 
                prompt, 
                return_tensors="pt"
            )
        
        # Generate description
        with torch.no_grad():
            out = model.generate(
                **inputs, 
                max_length=150,
                num_beams=5,
                early_stopping=True
            )
        
        description = processor.decode(out[0], skip_special_tokens=True)
        return description
        
    except Exception as e:
        logger.error(f"Image processing failed: {e}")
        raise e

# Image Analysis Endpoints
@app.post("/analyze-image")
async def analyze_image(file: UploadFile = File(...)):
    """
    Analyze an image and generate detailed description with maintenance focus
    """
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        logger.info(f"Processing image: {file.filename}")
        
        # Read and process image
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Generate detailed description with maintenance-focused prompt
        maintenance_prompt = """
        Analyze this image in detail and describe:
        1. All visible objects, components, and their condition
        2. Any signs of damage, wear, or maintenance issues
        3. Specific problems like leaks, cracks, stains, or corrosion
        4. Location context (bathroom, kitchen, pipe, wall, etc.)
        5. Urgency level and potential causes
        
        Be very specific and detailed in your observations.
        """
        
        description = process_single_image(image, maintenance_prompt)
        
        # Analyze for maintenance content
        analysis = analyze_maintenance_content(description.lower())
        
        logger.info(f"Analysis completed: {analysis['confidence']} confidence")
        
        return JSONResponse({
            "success": True,
            "description": description,
            "analysis": analysis,
            "isMaintenanceRelated": analysis["confidence"] != "low",
            "wordCount": len(description.split())
        })
        
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        return JSONResponse({
            "success": False,
            "description": f"Image processing failed: {str(e)}",
            "analysis": {"confidence": "low"},
            "isMaintenanceRelated": False,
            "error": str(e)
        })

@app.post("/analyze-multiple-images")
async def analyze_multiple_images(files: List[UploadFile] = File(...)):
    """Analyze multiple images at once"""
    results = []
    
    for file in files:
        try:
            # Read image data
            image_data = await file.read()
            
            # Process each image individually
            try:
                image = Image.open(io.BytesIO(image_data))
                
                # Convert to RGB if necessary
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                
                # Generate detailed description with maintenance-focused prompt
                maintenance_prompt = """
                Analyze this image in detail and describe:
                1. All visible objects, components, and their condition
                2. Any signs of damage, wear, or maintenance issues
                3. Specific problems like leaks, cracks, stains, or corrosion
                4. Location context (bathroom, kitchen, pipe, wall, etc.)
                5. Urgency level and potential causes
                
                Be very specific and detailed in your observations.
                """
                
                description = process_single_image(image, maintenance_prompt)
                
                # Analyze for maintenance content
                analysis = analyze_maintenance_content(description.lower())
                
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "description": description,
                    "analysis": analysis,
                    "isMaintenanceRelated": analysis["confidence"] != "low",
                    "wordCount": len(description.split())
                })
                
                logger.info(f"Successfully processed {file.filename}")
                
            except Exception as image_error:
                logger.error(f"Error processing image {file.filename}: {image_error}")
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "description": f"Failed to process image: {str(image_error)}",
                    "analysis": {"confidence": "low"},
                    "isMaintenanceRelated": False,
                    "error": str(image_error)
                })
            
        except Exception as e:
            logger.error(f"Error reading file {file.filename}: {e}")
            results.append({
                "filename": file.filename,
                "success": False,
                "description": f"Failed to read file: {str(e)}",
                "analysis": {"confidence": "low"},
                "isMaintenanceRelated": False,
                "error": str(e)
            })
    
    return {"results": results}

# Alternative: Use Hugging Face API as fallback
@app.post("/analyze-image-hf")
async def analyze_image_hf(file: UploadFile = File(...)):
    """Use Hugging Face API directly as fallback"""
    try:
        if not HF_TOKEN:
            raise HTTPException(status_code=500, detail="HF_API_KEY not configured")
            
        image_data = await file.read()
        
        response = requests.post(
            "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large",
            headers={"Authorization": f"Bearer {HF_TOKEN}"},
            data=image_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            description = result[0]['generated_text']
            
            analysis = analyze_maintenance_content(description.lower())
            
            return JSONResponse({
                "success": True,
                "description": description,
                "analysis": analysis,
                "isMaintenanceRelated": analysis["confidence"] != "low",
                "wordCount": len(description.split()),
                "source": "huggingface_api"
            })
        else:
            raise HTTPException(status_code=500, detail=f"Hugging Face API error: {response.status_code}")
            
    except Exception as e:
        logger.error(f"Hugging Face API fallback failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Request Analysis Endpoint
@app.post("/analyze-request")
async def analyze_request(data: dict = Body(...)):
    """
    Analyze maintenance request combining user text and image descriptions
    """
    try:
        user_text = data.get("userText", "")
        image_descriptions = data.get("imageDescriptions", [])
        
        if not user_text and not image_descriptions:
            return JSONResponse({
                "message": "No content provided"
            }, status_code=400)

        final_description = ""
        
        # Determine the best description source
        if user_text and image_descriptions and len(image_descriptions) > 0:
            # Both user text and image descriptions available
            combined_image_desc = " ".join(image_descriptions)
            
            # Use similarity comparison to choose the best description
            try:
                similarity_response = requests.post(
                    COMPARE_URL,
                    headers={"Authorization": f"Bearer {HF_TOKEN}"},
                    json={
                        "inputs": {
                            "source_sentence": user_text,
                            "sentences": [combined_image_desc]
                        }
                    },
                    timeout=15
                )

                if similarity_response.status_code == 200:
                    similarity_data = similarity_response.json()
                    similarity_score = similarity_data[0] if similarity_data else 0
                    
                    if similarity_score < 0.4 and len(combined_image_desc) > len(user_text):
                        # AI provides significantly different and more detailed information
                        final_description = f'Tenant reported: "{user_text}". AI analysis identified additional details: {combined_image_desc}'
                    elif similarity_score >= 0.6:
                        # High similarity, use user text with AI confirmation
                        final_description = f'{user_text} (Confirmed by AI image analysis)'
                    else:
                        # Moderate similarity, combine both
                        final_description = f'{user_text}. AI analysis: {combined_image_desc}'
                else:
                    # Fallback if similarity check fails
                    final_description = f'{user_text}. {combined_image_desc}'
                    
            except Exception as similarity_error:
                logger.error(f"Similarity check failed: {similarity_error}")
                final_description = f'{user_text}. {combined_image_desc}'
                
        elif image_descriptions and len(image_descriptions) > 0:
            # Only image descriptions available
            final_description = " ".join(image_descriptions)
        else:
            # Only user text available
            final_description = user_text

        # Classify urgency
        urgency_level = await classify_urgency(final_description)

        return JSONResponse({
            "summary": final_description,
            "urgencyLevel": urgency_level
        })
        
    except Exception as e:
        logger.error(f"Error analyzing request: {e}")
        
        # Fallback processing
        user_text = data.get("userText", "")
        image_descriptions = data.get("imageDescriptions", [])
        fallback_summary = user_text or " ".join(image_descriptions) or "Maintenance request"
        fallback_urgency = determine_fallback_urgency(fallback_summary)
        
        return JSONResponse({
            "summary": fallback_summary,
            "urgencyLevel": fallback_urgency,
            "fallback": True
        })

async def classify_urgency(description: str) -> int:
    """Classify urgency level from 1 to 4"""
    urgency_prompt = f"""
    Analyze this rental property maintenance request and determine urgency level from 1 to 4:
    
    ISSUE: "{description}"
    
    URGENCY SCALE:
    1 - Low: Cosmetic/minor issues (paint touch-ups, loose handles, minor scratches, small stains)
    2 - Medium: Functional issues needing attention soon (slow drains, minor leaks, appliance issues, sticking doors)
    3 - High: Significant impact on living conditions (broken HVAC, major leaks, electrical problems, no hot water)
    4 - Critical: Safety hazards or emergencies (gas leaks, no power, flooding, fire hazards, structural collapse)
    
    Consider: Safety risk, property damage potential, health concerns, impact on basic living functions.
    Respond with ONLY the number 1, 2, 3, or 4.
    """

    urgency_level = 2  # Default medium urgency
    
    try:
        urgency_res = requests.post(
            URGENCY_URL,
            headers={
                "Authorization": f"Bearer {HF_TOKEN}",
                "Content-Type": "application/json"
            },
            json={"inputs": urgency_prompt},
            timeout=30
        )

        if urgency_res.status_code == 200:
            urgency_data = urgency_res.json()
            urgency_text = urgency_data[0].get("generated_text", "2") if urgency_data else "2"
            urgency_match = re.search(r'\b[1-4]\b', urgency_text)
            urgency_level = int(urgency_match.group()) if urgency_match else 2
        else:
            logger.warning(f"Urgency API returned status {urgency_res.status_code}")
            urgency_level = determine_fallback_urgency(description)
            
    except Exception as urgency_error:
        logger.error(f'Urgency classification failed: {urgency_error}')
        urgency_level = determine_fallback_urgency(description)
    
    # Ensure bounds
    return max(1, min(4, urgency_level))

def determine_fallback_urgency(description: str) -> int:
    """Fallback urgency determination based on keyword matching"""
    lower_desc = description.lower()
    
    # Critical urgency indicators
    if re.search(r'(gas leak|electrical spark|fire hazard|flood|no power|broken window|no lock|no heat|no water|raw sewage|exposed wire|structural collapse)', lower_desc):
        return 4
    
    # High urgency indicators
    if re.search(r'(leak|flooding|electrical|not working|broken|clog|overflow|pest|mold|no hot water|water damage|exposed pipe)', lower_desc):
        return 3
    
    # Medium urgency indicators
    if re.search(r'(slow|drip|minor|cosmetic|paint|scratch|loose|stain|sticking|noisy)', lower_desc):
        return 2
    
    return 2  # Default medium urgency

def analyze_maintenance_content(description: str):
    """Analyze description for maintenance-related content"""
    
    maintenance_patterns = {
        'structural': ['wall', 'ceiling', 'floor', 'foundation', 'beam', 'drywall', 'concrete'],
        'plumbing': ['pipe', 'leak', 'faucet', 'sink', 'toilet', 'drain', 'water', 'valve'],
        'electrical': ['wire', 'outlet', 'switch', 'breaker', 'electrical', 'circuit'],
        'problems': ['broken', 'cracked', 'damaged', 'leaking', 'stained', 'corroded', 'rusted', 'mold'],
        'locations': ['bathroom', 'kitchen', 'basement', 'garage', 'under sink', 'utility']
    }
    
    analysis = {
        "components": [],
        "problems": [],
        "locations": [],
        "confidence": "low",
        "details": {}
    }
    
    # Check each category
    for category, keywords in maintenance_patterns.items():
        found_keywords = []
        for keyword in keywords:
            if keyword in description:
                found_keywords.append(keyword)
        
        if found_keywords:
            analysis["details"][category] = found_keywords
            
            # Add to appropriate lists
            if category in ['structural', 'plumbing', 'electrical']:
                analysis["components"].extend(found_keywords)
            elif category == 'problems':
                analysis["problems"].extend(found_keywords)
            elif category == 'locations':
                analysis["locations"].extend(found_keywords)
    
    # Calculate confidence
    component_count = len(analysis["components"])
    problem_count = len(analysis["problems"])
    
    if problem_count >= 2 and component_count >= 1:
        analysis["confidence"] = "high"
    elif problem_count >= 1 or component_count >= 2:
        analysis["confidence"] = "medium"
    
    return analysis

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)