import { NextRequest, NextResponse } from 'next/server';

const PYTHON_API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8000'
  : process.env.PYTHON_API_URL;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll('files') as File[]; // Changed from 'images' to 'files'
    
    if (!files || files.length === 0) {
      return NextResponse.json({ message: 'No image files provided' }, { status: 400 });
    }

    // Send to Python API - FIXED: using correct endpoint
    const pythonFormData = new FormData();
    files.forEach(file => {
      pythonFormData.append('files', file);
    });

    console.log(`Sending ${files.length} images to Python API...`);

    const response = await fetch(`${PYTHON_API_URL}/analyze-multiple-images`, {
      method: 'POST',
      body: pythonFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Python API error:', response.status, errorText);
      throw new Error(`Python API error: ${response.status}`);
    }

    const pythonResults = await response.json();
    console.log('Python API results:', pythonResults);
    
    // Transform to match your expected response format
    const results = pythonResults.results.map((result: any) => ({
      success: result.success !== false,
      description: result.tagalog_description || result.original_description || "Analysis failed",
      maintenance_issue: result.maintenance_issue || "No specific issue identified",
      analysis: result.analysis || {},
      isMaintenanceRelated: result.isMaintenanceRelated || false,
      comprehensive_report: result.comprehensive_report || null,
      confidence_score: result.confidence_score || 0.5,
      processing_method: result.processing_method || "unknown",
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