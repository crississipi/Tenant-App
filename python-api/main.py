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
        
        # Move model to GPU if available
        if torch.cuda.is_available():
            model = model.to("cuda")
            logger.info("Model moved to GPU")
        else:
            logger.info("Using CPU for inference")
            
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

def process_single_image(image: Image.Image) -> str:
    """Process a single image with multiple prompt strategies"""
    strategies = [
        # Strategy 1: Simple direct approach
        {
            "prompt": "",
            "max_length": 100,
            "num_beams": 4,
            "temperature": 0.7,
            "do_sample": True
        },
        # Strategy 2: Maintenance focused but concise
        {
            "prompt": "maintenance issues damage repair",
            "max_length": 120,
            "num_beams": 5,
            "temperature": 0.8,
            "do_sample": True
        },
        # Strategy 3: Very simple description
        {
            "prompt": "describe what is visible",
            "max_length": 80,
            "num_beams": 3,
            "temperature": 0.6,
            "do_sample": False
        }
    ]
    
    for i, strategy in enumerate(strategies):
        try:
            logger.info(f"Trying strategy {i+1} with prompt: '{strategy['prompt']}'")
            
            if strategy["prompt"]:
                inputs = processor(image, strategy["prompt"], return_tensors="pt", padding=True)
            else:
                inputs = processor(image, return_tensors="pt", padding=True)
            
            if torch.cuda.is_available():
                inputs = {k: v.to("cuda") for k, v in inputs.items()}
            
            with torch.no_grad():
                out = model.generate(
                    **inputs,
                    max_length=strategy["max_length"],
                    num_beams=strategy["num_beams"],
                    temperature=strategy["temperature"],
                    do_sample=strategy["do_sample"],
                    early_stopping=True,
                    no_repeat_ngram_size=2
                )
            
            description = processor.decode(out[0], skip_special_tokens=True)
            logger.info(f"Strategy {i+1} result: {description}")
            
            # Validate the description is not repeating the prompt
            if is_valid_description(description, strategy["prompt"]):
                enhanced_desc = enhance_description(description)
                logger.info(f"Valid description found: {enhanced_desc}")
                return enhanced_desc
            else:
                logger.warning(f"Strategy {i+1} produced invalid description")
                
        except Exception as e:
            logger.warning(f"Strategy {i+1} failed: {e}")
            continue
    
    # If all strategies fail, use Hugging Face API
    raise Exception("All local processing strategies failed")

def is_valid_description(description: str, prompt: str) -> bool:
    """Check if the description is valid (not repeating prompt)"""
    if not description or len(description.strip()) < 10:
        return False
    
    description_lower = description.lower()
    prompt_lower = prompt.lower()
    
    # Check if description is just repeating the prompt
    if prompt and any(word in description_lower for word in prompt_lower.split() if len(word) > 4):
        return False
    
    # Check for common prompt repetition patterns
    invalid_patterns = [
        "analyze this", "describe", "examine this", "inspect this",
        "focus on", "specific components", "visible damage", "safety issues",
        "maintenance issues", "what you see", "this image"
    ]
    
    if any(pattern in description_lower for pattern in invalid_patterns):
        return False
    
    # Check if it's actually describing something
    descriptive_indicators = [
        'broken', 'cracked', 'damaged', 'leaking', 'stained', 'corroded', 
        'rusted', 'mold', 'hole', 'exposed', 'loose', 'worn', 'faulty', 
        'missing', 'bent', 'sagging', 'pipe', 'wall', 'floor', 'door',
        'window', 'water', 'electrical', 'wood', 'metal', 'plastic'
    ]
    
    valid_words = sum(1 for word in descriptive_indicators if word in description_lower)
    return valid_words >= 2 or len(description.split()) >= 8

def enhance_description(description: str) -> str:
    """Enhance the description to be more informative"""
    if not description:
        return "Unable to analyze image content"
    
    # Remove any remaining prompt-like phrases
    prompt_phrases = [
        "this is a picture of", "there is a", "this image shows",
        "this is an image of", "you can see", "in this photo",
        "the image shows", "we can see"
    ]
    
    for phrase in prompt_phrases:
        description = description.replace(phrase, "").strip()
    
    # Capitalize first letter
    if description:
        description = description[0].upper() + description[1:]
    
    # Ensure it ends with a period
    if description and not description.endswith(('!', '.', '?')):
        description += '.'
    
    return description

def enhance_analysis_with_context(description: str) -> dict:
    """Enhanced maintenance content analysis with more detailed detection"""
    
    maintenance_patterns = {
        'structural': [
            'wall', 'ceiling', 'floor', 'foundation', 'beam', 'drywall', 'concrete',
            'structural', 'support', 'joist', 'stud', 'framing', 'subfloor', 'tile',
            'linoleum', 'carpet', 'baseboard', 'trim', 'molding'
        ],
        'plumbing': [
            'pipe', 'leak', 'faucet', 'sink', 'toilet', 'drain', 'water', 'valve',
            'plumbing', 'sewer', 'vent', 'supply line', 'drain line', 'p-trap',
            'shower', 'bathtub', 'water heater', 'garbage disposal'
        ],
        'electrical': [
            'wire', 'outlet', 'switch', 'breaker', 'electrical', 'circuit',
            'wiring', 'socket', 'fixture', 'panel', 'conduit', 'junction box',
            'light', 'lamp', 'ceiling fan', 'appliance'
        ],
        'openings': [
            'door', 'window', 'frame', 'hinge', 'lock', 'handle', 'knob',
            'sliding', 'patio', 'screen', 'glass', 'pane', 'threshold'
        ],
        'problems': [
            'broken', 'cracked', 'damaged', 'leaking', 'stained', 'corroded', 
            'rusted', 'mold', 'mildew', 'rotten', 'decayed', 'worn', 'frayed',
            'bent', 'warped', 'sagging', 'loose', 'detached', 'missing',
            'hole', 'gap', 'crack', 'fracture', 'split', 'shattered',
            'exposed', 'uncovered', 'revealed', 'visible', 'showing'
        ],
        'severity_indicators': [
            'large', 'big', 'major', 'severe', 'significant', 'extensive',
            'serious', 'critical', 'urgent', 'hazard', 'danger', 'risk',
            'unsafe', 'emergency', 'collapse', 'flooding', 'overflow'
        ],
        'locations': [
            'bathroom', 'kitchen', 'basement', 'garage', 'under sink', 'utility',
            'laundry', 'mechanical', 'closet', 'pantry', 'bedroom', 'living room',
            'exterior', 'interior', 'attic', 'crawlspace', 'hallway'
        ]
    }
    
    # Enhanced analysis with context
    enhanced_analysis = {
        "components": [],
        "problems": [],
        "locations": [],
        "severity_indicators": [],
        "confidence": "low",
        "risk_level": "low",
        "maintenance_priority": "low",
        "details": {},
        "contextual_analysis": ""
    }
    
    description_lower = description.lower()
    
    # Enhanced keyword matching with context
    for category, keywords in maintenance_patterns.items():
        found_keywords = []
        for keyword in keywords:
            if keyword in description_lower:
                found_keywords.append(keyword)
        
        if found_keywords:
            enhanced_analysis["details"][category] = found_keywords
            
            # Add to appropriate lists
            if category in ['structural', 'plumbing', 'electrical', 'openings']:
                enhanced_analysis["components"].extend(found_keywords)
            elif category == 'problems':
                enhanced_analysis["problems"].extend(found_keywords)
            elif category == 'severity_indicators':
                enhanced_analysis["severity_indicators"].extend(found_keywords)
            elif category == 'locations':
                enhanced_analysis["locations"].extend(found_keywords)
    
    # Enhanced confidence calculation with weighted scoring
    component_score = len(enhanced_analysis["components"])
    problem_score = len(enhanced_analysis["problems"]) * 2  # Problems are more important
    severity_score = len(enhanced_analysis["severity_indicators"]) * 3  # Severity is most important
    location_score = len(enhanced_analysis["locations"])
    
    total_score = component_score + problem_score + severity_score + location_score
    
    # Enhanced confidence levels
    if total_score >= 8 or severity_score >= 3:
        enhanced_analysis["confidence"] = "high"
        enhanced_analysis["risk_level"] = "high"
        enhanced_analysis["maintenance_priority"] = "urgent"
    elif total_score >= 4:
        enhanced_analysis["confidence"] = "medium"
        enhanced_analysis["risk_level"] = "medium" 
        enhanced_analysis["maintenance_priority"] = "medium"
    else:
        enhanced_analysis["confidence"] = "low"
        enhanced_analysis["risk_level"] = "low"
        enhanced_analysis["maintenance_priority"] = "low"
    
    # Generate contextual analysis
    enhanced_analysis["contextual_analysis"] = generate_contextual_analysis(description, enhanced_analysis)
    
    # Determine if maintenance related based on enhanced criteria
    enhanced_analysis["isMaintenanceRelated"] = (
        enhanced_analysis["confidence"] != "low" or 
        len(enhanced_analysis["problems"]) > 0 or
        len(enhanced_analysis["severity_indicators"]) > 0
    )
    
    return enhanced_analysis

def generate_contextual_analysis(description: str, analysis: dict) -> str:
    """Generate contextual analysis based on the description and findings"""
    
    contextual_parts = []
    
    # Add location context
    if analysis["locations"]:
        locations = ", ".join(analysis["locations"])
        contextual_parts.append(f"Located in {locations}")
    
    # Add component context
    if analysis["components"]:
        components = ", ".join(analysis["components"])
        contextual_parts.append(f"Affects {components}")
    
    # Add problem context
    if analysis["problems"]:
        problems = ", ".join(analysis["problems"])
        contextual_parts.append(f"Issues include {problems}")
    
    # Add severity context
    if analysis["severity_indicators"]:
        severity = ", ".join(analysis["severity_indicators"])
        contextual_parts.append(f"Severity indicators: {severity}")
    
    # Add risk assessment
    if analysis["risk_level"] == "high":
        contextual_parts.append("High risk requiring immediate attention")
    elif analysis["risk_level"] == "medium":
        contextual_parts.append("Medium risk needing prompt inspection")
    else:
        contextual_parts.append("Low risk - routine maintenance recommended")
    
    return ". ".join(contextual_parts) + "." if contextual_parts else "Basic maintenance assessment completed."

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
        
        # Validate image
        if image.size[0] < 50 or image.size[1] < 50:
            raise HTTPException(status_code=400, detail="Image is too small")
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Process image with multiple strategies
        try:
            description = process_single_image(image)
        except Exception as local_error:
            logger.warning(f"Local processing failed, trying Hugging Face API: {local_error}")
            description = await analyze_with_hf_api(image_data, file.filename)
        
        # Enhanced analysis for maintenance content
        analysis = enhance_analysis_with_context(description.lower())
        
        logger.info(f"Final analysis: {description}")
        
        return JSONResponse({
            "success": True,
            "description": description,
            "analysis": analysis,
            "isMaintenanceRelated": analysis["isMaintenanceRelated"],
            "wordCount": len(description.split())
        })
        
    except Exception as e:
        logger.error(f"Error processing image: {e}")
        return JSONResponse({
            "success": False,
            "description": f"Image analysis failed: {str(e)}",
            "analysis": {
                "confidence": "low", 
                "isMaintenanceRelated": False,
                "risk_level": "low",
                "maintenance_priority": "low",
                "contextual_analysis": "Analysis failed due to processing error"
            },
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
                
                # Validate image
                if image.size[0] < 50 or image.size[1] < 50:
                    results.append({
                        "filename": file.filename,
                        "success": False,
                        "description": "Image is too small for analysis",
                        "analysis": {
                            "confidence": "low", 
                            "isMaintenanceRelated": False,
                            "risk_level": "low",
                            "maintenance_priority": "low",
                            "contextual_analysis": "Image too small for detailed analysis"
                        },
                        "isMaintenanceRelated": False,
                        "error": "Image too small"
                    })
                    continue
                
                # Convert to RGB if necessary
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                
                # Process image
                try:
                    description = process_single_image(image)
                except Exception as local_error:
                    logger.warning(f"Local processing failed for {file.filename}, using Hugging Face API")
                    description = await analyze_with_hf_api(image_data, file.filename)
                
                # Enhanced analysis for maintenance content
                analysis = enhance_analysis_with_context(description.lower())
                
                results.append({
                    "filename": file.filename,
                    "success": True,
                    "description": description,
                    "analysis": analysis,
                    "isMaintenanceRelated": analysis["isMaintenanceRelated"],
                    "wordCount": len(description.split())
                })
                
                logger.info(f"Successfully processed {file.filename}")
                
            except Exception as image_error:
                logger.error(f"Error processing image {file.filename}: {image_error}")
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "description": f"Failed to process image: {str(image_error)}",
                    "analysis": {
                        "confidence": "low", 
                        "isMaintenanceRelated": False,
                        "risk_level": "low",
                        "maintenance_priority": "low",
                        "contextual_analysis": "Analysis failed due to processing error"
                    },
                    "isMaintenanceRelated": False,
                    "error": str(image_error)
                })
            
        except Exception as e:
            logger.error(f"Error reading file {file.filename}: {e}")
            results.append({
                "filename": file.filename,
                "success": False,
                "description": f"Failed to read file: {str(e)}",
                "analysis": {
                    "confidence": "low", 
                    "isMaintenanceRelated": False,
                    "risk_level": "low",
                    "maintenance_priority": "low",
                    "contextual_analysis": "Analysis failed due to file reading error"
                },
                "isMaintenanceRelated": False,
                "error": str(e)
            })
    
    return {"results": results}

async def analyze_with_hf_api(image_data: bytes, filename: str) -> str:
    """Use Hugging Face API as fallback"""
    if not HF_TOKEN:
        raise Exception("HF_API_KEY not configured")
    
    try:
        response = requests.post(
            "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large",
            headers={"Authorization": f"Bearer {HF_TOKEN}"},
            data=image_data,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            description = result[0]['generated_text']
            logger.info(f"HF API success for {filename}: {description}")
            
            # Enhance the description
            enhanced_desc = enhance_description(description)
            return enhanced_desc
        else:
            raise Exception(f"Hugging Face API error: {response.status_code}")
            
    except Exception as e:
        logger.error(f"Hugging Face API failed for {filename}: {e}")
        raise e

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

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)