import { NextRequest, NextResponse } from 'next/server';

// Use local Python API during development, production URL in production
const PYTHON_API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8000'
  : process.env.PYTHON_API_URL;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('images') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ message: 'No image files provided' }, { status: 400 });
    }

    // Send to Python API
    const pythonFormData = new FormData();
    files.forEach(file => {
      pythonFormData.append('files', file);
    });

    const response = await fetch(`${PYTHON_API_URL}/analyze-multiple-images`, {
      method: 'POST',
      body: pythonFormData,
    });

    if (!response.ok) {
      throw new Error(`Python API error: ${response.status}`);
    }

    const pythonResults = await response.json();
    
    // Transform to match your expected response format
    const results = pythonResults.results.map((result: any) => ({
      success: result.success !== false,
      caption: result.description || "Analysis failed",
      isMaintenanceRelated: result.isMaintenanceRelated || false,
      analysis: result.analysis || {},
      rawCaptions: [result.description || ""],
      timestamp: new Date().toISOString(),
      ...(result.error && { error: result.error })
    }));

    return NextResponse.json({ 
      results,
      processedCount: results.filter((r: any) => r.success).length,
      totalCount: results.length
    });
    
  } catch (err: any) {
    console.error('Error in analyze-image route:', err);
    return NextResponse.json({ 
      message: 'Image analysis service unavailable',
      error: err.message 
    }, { status: 500 });
  }
}