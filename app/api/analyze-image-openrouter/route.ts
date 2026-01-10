import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface AnalysisResult {
  success: boolean;
  description: string;
  maintenance_issue: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  confidence_score: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    if (!OPENROUTER_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OpenRouter API key not configured' },
        { status: 500 }
      );
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

Analyze this image and provide:
1. A detailed description of what you see (50-150 words)
2. Identify any maintenance issues, damages, or concerns
3. Assess the urgency level (low, medium, high, critical)
4. Categorize the issue (electrical, plumbing, structural, appliance, cosmetic, safety, other)
5. Provide a confidence score (0-1) for your analysis

Format your response as JSON:
{
  "description": "detailed description",
  "maintenance_issue": "specific issue found or 'No visible issues'",
  "urgency": "low|medium|high|critical",
  "category": "category name",
  "confidence_score": 0.0-1.0,
  "recommendations": "brief recommendations"
}

If no maintenance issue is visible, still describe what you see but mark urgency as "low" and maintenance_issue as "No visible issues".`
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
            description: 'Failed to analyze image',
            maintenance_issue: 'Analysis failed',
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
            description: 'No analysis returned',
            maintenance_issue: 'Analysis incomplete',
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
            description: content.substring(0, 200),
            maintenance_issue: 'Could not parse analysis',
            urgency: 'medium',
            category: 'unknown',
            confidence_score: 0.5,
            error: 'JSON parse error'
          });
          continue;
        }

        results.push({
          success: true,
          description: analysis.description || 'Image analyzed',
          maintenance_issue: analysis.maintenance_issue || 'Issue detected',
          urgency: analysis.urgency || 'medium',
          category: analysis.category || 'general',
          confidence_score: analysis.confidence_score || 0.8
        });

      } catch (fileError) {
        console.error('Error processing file:', fileError);
        results.push({
          success: false,
          description: 'Error processing image',
          maintenance_issue: 'Processing failed',
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
      successful: results.filter(r => r.success).length
    });

  } catch (error) {
    console.error('Error in analyze-image-openrouter:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}
