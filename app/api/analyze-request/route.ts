import { NextRequest, NextResponse } from "next/server";

const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const { userText, imageDescriptions } = await req.json();

    if (!userText && !imageDescriptions) {
      return NextResponse.json({ message: "No content provided" }, { status: 400 });
    }

    // Call Python API for request analysis
    const response = await fetch(`${PYTHON_API_URL}/analyze-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userText,
        imageDescriptions
      }),
    });

    if (!response.ok) {
      throw new Error(`Python API error: ${response.status}`);
    }

    const result = await response.json();
    
    return NextResponse.json(result);
    
  } catch (err: any) {
    console.error("Error analyzing request:", err.message);
    
    // Fallback to basic processing
    const { userText, imageDescriptions } = await req.json();
    const fallbackSummary = userText || imageDescriptions?.join(" ") || "Maintenance request";
    
    // Simple fallback urgency determination
    const fallbackUrgency = determineFallbackUrgency(fallbackSummary);
    
    return NextResponse.json({ 
      summary: fallbackSummary,
      urgencyLevel: fallbackUrgency,
      fallback: true
    });
  }
}

function determineFallbackUrgency(description: string): number {
  const lowerDesc = description.toLowerCase();
  
  // Critical urgency indicators
  if (/(gas leak|electrical spark|fire hazard|flood|no power|broken window|no lock|no heat|no water|raw sewage|exposed wire|structural collapse)/.test(lowerDesc)) {
    return 4;
  }
  
  // High urgency indicators
  if (/(leak|flooding|electrical|not working|broken|clog|overflow|pest|mold|no hot water|water damage|exposed pipe)/.test(lowerDesc)) {
    return 3;
  }
  
  // Medium urgency indicators
  if (/(slow|drip|minor|cosmetic|paint|scratch|loose|stain|sticking|noisy)/.test(lowerDesc)) {
    return 2;
  }
  
  return 2; // Default medium urgency
}