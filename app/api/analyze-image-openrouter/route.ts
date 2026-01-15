import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface AnalysisResult {
  success: boolean;
  isMaintenanceRelated: boolean;
  description: string;
  description_tl: string;
  maintenance_issue: string;
  maintenance_issue_tl: string;
  main_problem?: string;
  main_problem_tl?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  confidence_score: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    // If OpenRouter API key is not configured, fallback to HuggingFace TypeScript API
    if (!OPENROUTER_API_KEY) {
      console.log('OpenRouter API key not found, falling back to HuggingFace TypeScript API');
      return await fallbackToHuggingFace(request);
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No images provided' },
        { status: 400 }
      );
    }

    // Process all images
    const results: AnalysisResult[] = [];

    for (const file of files) {
      try {
        // Convert file to base64
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Image = buffer.toString('base64');
        const mimeType = file.type || 'image/jpeg';
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        // Call OpenRouter API with vision model
        const response = await fetch(OPENROUTER_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            'X-Title': 'Coliving Maintenance AI'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-exp:free', // Using Gemini Flash for vision
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: `You are an expert maintenance inspector analyzing images for property maintenance issues.

FIRST, determine if this image shows a MAINTENANCE-RELATED ISSUE (damage, malfunction, safety hazard, repair need, etc.) or is NOT maintenance-related (selfies, food, random objects, people, etc.).

If NOT maintenance-related:
{
  "isMaintenanceRelated": false,
  "description": "Brief description of what the image shows",
  "description_tl": "Tagalog translation of description",
  "maintenance_issue": "No maintenance issue found in this image",
  "maintenance_issue_tl": "Walang sira o damage na nakita sa larawang ito",
  "urgency": "low",
  "category": "not-applicable",
  "confidence_score": 0.9
}

If MAINTENANCE-RELATED, provide bilingual analysis:
{
  "isMaintenanceRelated": true,
  "description": "Simple description in English (2-3 sentences, emphasize the issue)",
  "description_tl": "Salin sa Tagalog ng description (2-3 pangungusap, i-highlight ang problema)",
  "maintenance_issue": "Brief issue summary in English",
  "maintenance_issue_tl": "Maikling deskripsyon ng problema sa Tagalog",
  "main_problem": "**MAIN PROBLEM:** [Highlighted main issue in English]",
  "main_problem_tl": "**PANGUNAHING PROBLEMA:** [Pangunahing isyu sa Tagalog]",
  "urgency": "low|medium|high|critical",
  "category": "electrical|plumbing|structural|appliance|cosmetic|safety|other",
  "confidence_score": 0.0-1.0
}

Keep descriptions simple and clear. Highlight the main problem in bold. Focus on what needs to be fixed.`
                  },
                  {
                    type: 'image_url',
                    image_url: {
                      url: dataUrl
                    }
                  }
                ]
              }
            ],
            temperature: 0.3,
            max_tokens: 1000,
            response_format: { type: "json_object" }
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('OpenRouter API error:', errorText);
          results.push({
            success: false,
            isMaintenanceRelated: false,
            description: 'Failed to analyze image',
            description_tl: 'Hindi na-analyze ang larawan',
            maintenance_issue: 'Analysis failed',
            maintenance_issue_tl: 'Hindi na-analyze',
            urgency: 'medium',
            category: 'unknown',
            confidence_score: 0,
            error: `API error: ${response.status}`
          });
          continue;
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
          results.push({
            success: false,
            isMaintenanceRelated: false,
            description: 'No analysis returned',
            description_tl: 'Hindi masuri ng AI ang litrato',
            maintenance_issue: 'Analysis incomplete',
            maintenance_issue_tl: 'Kulang ang resulta',
            urgency: 'medium',
            category: 'unknown',
            confidence_score: 0,
            error: 'Empty response from AI'
          });
          continue;
        }

        // Parse the JSON response
        let analysis;
        try {
          analysis = JSON.parse(content);
        } catch (parseError) {
          // If JSON parsing fails, try to extract information from text
          console.error('Failed to parse AI response as JSON:', content);
          results.push({
            success: false,
            isMaintenanceRelated: false,
            description: content.substring(0, 200),
            description_tl: 'Hindi maintindihan ng system ang sagot ng AI',
            maintenance_issue: 'Could not parse analysis',
            maintenance_issue_tl: 'Hindi ma-process ang resulta',
            urgency: 'medium',
            category: 'unknown',
            confidence_score: 0.5,
            error: 'JSON parse error'
          });
          continue;
        }

        results.push({
          success: true,
          isMaintenanceRelated: analysis.isMaintenanceRelated ?? true,
          description: analysis.description || 'Image analyzed',
          description_tl: analysis.description_tl || 'Na-analyze na ang larawan',
          maintenance_issue: analysis.maintenance_issue || 'Issue detected',
          maintenance_issue_tl: analysis.maintenance_issue_tl || 'May nakitang problema',
          main_problem: analysis.main_problem,
          main_problem_tl: analysis.main_problem_tl,
          urgency: analysis.urgency || 'medium',
          category: analysis.category || 'general',
          confidence_score: analysis.confidence_score || 0.8
        });

      } catch (fileError) {
        console.error('Error processing file:', fileError);
        results.push({
          success: false,
          isMaintenanceRelated: false,
          description: 'Error processing image',
          description_tl: 'May problema sa pag-check ng larawan',
          maintenance_issue: 'Processing failed',
          maintenance_issue_tl: 'Hindi ma-process',
          urgency: 'medium',
          category: 'unknown',
          confidence_score: 0,
          error: fileError instanceof Error ? fileError.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      success: true,
      results,
      total: results.length,
      successful: results.filter(r => r.success).length,
      maintenanceRelated: results.filter(r => r.isMaintenanceRelated).length
    });

  } catch (error) {
    console.error('Error in analyze-image-openrouter:', error);
    
    // Fallback to HuggingFace TypeScript API if OpenRouter fails
    try {
      console.log('OpenRouter failed, attempting HuggingFace TypeScript API fallback');
      return await fallbackToHuggingFace(request);
    } catch (fallbackError) {
      console.error('HuggingFace fallback also failed:', fallbackError);
      return NextResponse.json(
        {
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error'
        },
        { status: 500 }
      );
    }
  }
}

// Fallback function to use HuggingFace TypeScript API when OpenRouter is unavailable
async function fallbackToHuggingFace(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No images provided' },
        { status: 400 }
      );
    }

    // Forward to HuggingFace TypeScript API
    const hfFormData = new FormData();
    for (const file of files) {
      hfFormData.append('files', file);
    }

    // Get the base URL from the request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const response = await fetch(`${baseUrl}/api/analyze-images-ts`, {
      method: 'POST',
      body: hfFormData,
    });

    if (!response.ok) {
      throw new Error(`HuggingFace API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Response format already matches, just add source indicator
    return NextResponse.json({
      ...data,
      source: 'huggingface-ts' // Indicate the source
    });

  } catch (error) {
    console.error('HuggingFace API fallback error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Fallback API error'
      },
      { status: 500 }
    );
  }
}
