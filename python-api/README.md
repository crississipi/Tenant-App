# CoLiving Maintenance AI API

FastAPI-based AI service for analyzing maintenance issues using image recognition and natural language processing.

## Features

- 🖼️ Image analysis using BLIP and BLIP-2 models
- 💬 Natural language processing for maintenance descriptions
- 🤖 AI-powered chat interface using OpenRouter
- 🔍 Advanced image preprocessing and enhancement
- 📊 Comprehensive logging and error handling

## Tech Stack

- **FastAPI** - Modern web framework for Python
- **Transformers** - Hugging Face models for AI analysis
- **PyTorch** - Deep learning framework
- **Pillow & OpenCV** - Image processing
- **Uvicorn** - ASGI server

## Local Development

### Prerequisites

- Python 3.11+
- pip or conda

### Installation

1. Clone the repository:
```bash
git clone https://github.com/colivingdevteam/coliving-ai.git
cd coliving-ai
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY
```

4. Run the server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

## API Endpoints

### Health Check
```
GET /
```

### Analyze Image with Description
```
POST /analyze-with-description
Content-Type: multipart/form-data

file: image file
description: text description of the issue
```

### AI Chat Analysis
```
POST /analyze-with-chat
Content-Type: multipart/form-data

file: image file
user_description: user's description of the problem
```

### Other Endpoints

See the full API documentation at `/docs` when running the server.

## Deployment

This API is configured for deployment on Render. See [RENDER_DEPLOYMENT_GUIDE.md](RENDER_DEPLOYMENT_GUIDE.md) for detailed instructions.

### Quick Deploy to Render

1. Push this repository to GitHub
2. Connect to Render using the Blueprint
3. Add `OPENROUTER_API_KEY` to environment variables
4. Deploy!

## Environment Variables

- `OPENROUTER_API_KEY` - Your OpenRouter API key (required)
- `PORT` - Server port (default: 8000)

## Project Structure

```
.
├── main.py                          # Main FastAPI application
├── requirements.txt                 # Python dependencies
├── render.yaml                      # Render deployment config
├── .env.example                     # Environment variable template
├── .gitignore                       # Git ignore rules
├── README.md                        # This file
└── RENDER_DEPLOYMENT_GUIDE.md      # Deployment instructions
```

## Models Used

- **BLIP** - Salesforce BLIP for image captioning
- **BLIP-2** - Advanced image-to-text generation
- **Various Transformers** - For text analysis and processing

## Performance Considerations

- Models are loaded lazily on first use
- Initial request may take longer due to model loading
- Recommended: At least 2-4 GB RAM for production deployment
- Consider using GPU instances for faster inference

## License

Private - CoLiving Development Team

## Support

For issues or questions, contact the development team.
