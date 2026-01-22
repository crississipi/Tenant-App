import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import axios from 'axios';
import { prisma } from '@/lib/prisma';
const HF_TOKEN = process.env.HF_API_KEY!;
const PROCEDURE_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1";
const TRANSLATE_URL = "https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-en-tl";
const PYTHON_API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8000'
  : process.env.PYTHON_API_URL;

// Background processing function - runs after response is sent
async function processMaintenanceInBackground(
  maintenanceId: number,
  userId: number,
  propertyId: number,
  title: string,
  rawRequest: string,
  images: { name: string; base64: string; type: string }[],
  translateToTagalog: boolean,
  aiAnalysis: string | null,
  baseUrl: string
) {
  try {
    console.log(`[Background] Starting processing for maintenance #${maintenanceId}`);
    
    // 1️⃣ Analyze images using Python AI
    let pythonResults = null;
    let imageAnalysisData = null;

    try {
      console.log('[Background] Sending images to Python AI for analysis...');
      
      const pythonFormData = new FormData();
      for (const img of images) {
        const base64Data = img.base64.split(',')[1] || img.base64;
        const binaryString = atob(base64Data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: img.type });
        pythonFormData.append('files', blob, img.name);
      }

      const pythonResponse = await fetch(`${PYTHON_API_URL}/analyze-multiple-images`, {
        method: 'POST',
        body: pythonFormData,
      });

      if (pythonResponse.ok) {
        pythonResults = await pythonResponse.json();
        console.log('[Background] Python AI analysis completed');
        
        if (pythonResults.results && pythonResults.results.length > 0) {
          const successfulResults = pythonResults.results.filter((r: any) => r.success);
          imageAnalysisData = {
            descriptions: successfulResults.map((r: any) => r.description),
            maintenanceIssues: successfulResults.map((r: any) => r.maintenance_issue),
            components: successfulResults.flatMap((r: any) => r.analysis?.components || []),
            riskLevels: successfulResults.map((r: any) => r.analysis?.risk_level || 'medium')
          };
        }
      }
    } catch (pythonError) {
      console.warn('[Background] Python AI service unavailable:', pythonError);
    }

    // 2️⃣ Summarize request and determine urgency
    let finalProcessedRequest = rawRequest;
    let urgencyLevel = 2;

    try {
      console.log('[Background] Summarizing request...');
      
      const summarizationData = {
        title: title,
        userDescription: rawRequest,
        imageAnalysis: imageAnalysisData,
        frontendAiAnalysis: aiAnalysis ? JSON.parse(aiAnalysis) : null
      };

      const summarizationResponse = await fetch(`${baseUrl}/api/analyze-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(summarizationData),
      });

      if (summarizationResponse.ok) {
        const { summary, urgencyLevel: analyzedUrgency } = await summarizationResponse.json();
        finalProcessedRequest = summary || rawRequest;
        urgencyLevel = analyzedUrgency || urgencyLevel;
        console.log('[Background] Request summarized. Urgency:', urgencyLevel);
      }
    } catch (summarizationError) {
      console.error('[Background] Summarization failed:', summarizationError);
      finalProcessedRequest = rawRequest.length > 200 ? rawRequest.substring(0, 200) + '...' : rawRequest;
    }

    // 3️⃣ Generate step-by-step procedure
    let procedureText = "";
    try {
      const procedurePrompt = `
        Create a step-by-step maintenance procedure for this rental property issue:
        
        TITLE: "${title}"
        SUMMARIZED ISSUE: "${finalProcessedRequest}"
        URGENCY: Level ${urgencyLevel}/4
        ${imageAnalysisData ? `AI IDENTIFIED COMPONENTS: ${imageAnalysisData.components.join(', ')}` : ''}
        
        Provide 3-5 clear steps for maintenance staff. Format exactly as:
        Step 1: [First action]
        Step 2: [Second action]
        Step 3: [Third action]
        Step 4: [Fourth action]
        Step 5: [Fifth action]
      `;

      const procedureRes = await axios.post(
        PROCEDURE_URL,
        { inputs: procedurePrompt },
        { 
          headers: { Authorization: `Bearer ${HF_TOKEN}`, 'Content-Type': 'application/json' },
          timeout: 30000
        }
      );

      procedureText = procedureRes.data?.[0]?.generated_text || "";
      procedureText = procedureText.replace(procedurePrompt, '').replace(/<[^>]*>/g, '').trim();
        
    } catch (procedureError) {
      console.error('[Background] Procedure generation failed:', procedureError);
      procedureText = `Step 1: Inspect the reported issue\nStep 2: Gather necessary tools\nStep 3: Perform repairs\nStep 4: Test the repair\nStep 5: Document work`;
    }

    // 4️⃣ Translate if requested
    let tagalogProcedure = "";
    if (translateToTagalog) {
      try {
        const steps = procedureText.split('\n').filter(line => line.startsWith('Step'));
        const stepContents = steps.map(step => step.replace(/Step \d+:\s*/, ''));
        
        const translatedSteps = await Promise.all(
          stepContents.map(async (step) => {
            try {
              const translateRes = await axios.post(
                TRANSLATE_URL,
                { inputs: step },
                { headers: { Authorization: `Bearer ${HF_TOKEN}` }, timeout: 30000 }
              );
              return translateRes.data?.[0]?.translation_text || step;
            } catch { return step; }
          })
        );

        tagalogProcedure = steps.map((step, index) => {
          const stepNumber = step.match(/Step (\d+):/)?.[1] || (index + 1).toString();
          return `Step ${stepNumber}: ${translatedSteps[index]}`;
        }).join('\n');
      } catch { tagalogProcedure = procedureText; }
    }

    const formattedProcedure = formatProcedureMessage(
      title, 
      translateToTagalog ? tagalogProcedure : procedureText, 
      finalProcessedRequest, 
      urgencyLevel,
      translateToTagalog
    );

    // 5️⃣ Update maintenance record with processed data
    await prisma.maintenance.update({
      where: { maintenanceId },
      data: {
        processedRequest: finalProcessedRequest,
        urgency: getUrgencyText(urgencyLevel),
      },
    });

    // 6️⃣ Update documentation with AI analysis
    const documentationData = {
      userDescription: rawRequest,
      processedRequest: finalProcessedRequest,
      urgencyLevel: urgencyLevel,
      procedureGenerated: formattedProcedure,
      translatedToTagalog: translateToTagalog,
      imageAnalysis: pythonResults,
      frontendAiAnalysis: aiAnalysis ? JSON.parse(aiAnalysis) : null,
      analysisTimestamp: new Date().toISOString()
    };

    await prisma.documentation.updateMany({
      where: { maintenanceID: maintenanceId },
      data: { remarks: JSON.stringify(documentationData) },
    });

    // 7️⃣ Send procedure message to landlord
    try {
      await prisma.messages.create({
        data: {
          senderID: userId,
          receiverID: 2,
          message: formattedProcedure,
          dateSent: new Date(),
          read: false,
        },
      });
    } catch (messageError) {
      console.error('[Background] Failed to send procedure message:', messageError);
    }

    // 8️⃣ AI Training feedback (non-blocking)
    if (pythonResults && process.env.ENABLE_AI_TRAINING === 'true') {
      fetch(`${PYTHON_API_URL}/training/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maintenance_id: maintenanceId,
          user_description: rawRequest,
          ai_analysis: pythonResults,
          final_summary: finalProcessedRequest,
          urgency_level: urgencyLevel,
          timestamp: new Date().toISOString()
        }),
      }).catch(() => {});
    }

    console.log(`[Background] Processing complete for maintenance #${maintenanceId}`);
  } catch (error) {
    console.error(`[Background] Error processing maintenance #${maintenanceId}:`, error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1️⃣ Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Get base URL for internal API calls
    const getBaseUrl = () => {
      if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
      const proto = request.headers.get('x-forwarded-proto') || 'http';
      const host = request.headers.get('host');
      return `${proto}://${host}`;
    };

    const baseUrl = getBaseUrl();

    // 2️⃣ Extract form data
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const rawRequest = formData.get('rawRequest') as string;
    const userId = formData.get('userId') as string;
    const images = formData.getAll('images') as File[];
    const translateToTagalog = formData.get('translateToTagalog') === 'true';
    const aiAnalysis = formData.get('aiAnalysis') as string;

    // 3️⃣ Validate inputs
    if (!title || !rawRequest || images.length === 0) {
      return NextResponse.json({ message: 'All fields including at least one image are required.' }, { status: 400 });
    }
    if (title.length < 5) {
      return NextResponse.json({ message: 'Title must be at least 5 characters long.' }, { status: 400 });
    }
    if (rawRequest.length < 10) {
      return NextResponse.json({ message: 'Description must be at least 10 characters long.' }, { status: 400 });
    }
    if (images.length > 5) {
      return NextResponse.json({ message: 'Maximum of 5 images allowed.' }, { status: 400 });
    }

    for (const image of images) {
      if (!image.type.startsWith('image/')) {
        return NextResponse.json({ message: 'Only image files are allowed.' }, { status: 400 });
      }
      if (image.size > 10 * 1024 * 1024) {
        return NextResponse.json({ message: 'File size must be below 10MB.' }, { status: 400 });
      }
    }

    // 4️⃣ Verify user's property ownership
    const user = await prisma.users.findUnique({
      where: { userID: parseInt(userId) },
      include: { property: true },
    });

    if (!user || !user.propertyId) {
      return NextResponse.json({ message: 'User property not found.' }, { status: 400 });
    }

    // 5️⃣ Convert images to base64 for storage and later processing
    const base64Images: { name: string; base64: string; type: string }[] = [];
    for (const image of images) {
      const bytes = await image.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = `data:${image.type};base64,${buffer.toString('base64')}`;
      base64Images.push({ name: image.name, base64, type: image.type });
    }

    // 6️⃣ Upload images to GitHub FIRST (quick operation)
    const encodedImages = base64Images.map(img => ({
      name: img.name,
      content: img.base64.split(',')[1],
    }));

    let uploadedUrls: string[] = [];

    try {
      const githubUpload = await fetch(`${baseUrl}/api/upload-images`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: encodedImages,
          folderName: `maintenance/${user.propertyId}`,
        }),
      });

      const githubRes = await githubUpload.json();
      
      if (!githubRes.success) {
        console.error('GitHub upload failed:', githubRes.message);
        uploadedUrls = [`Failed to upload: ${githubRes.message}`];
      } else {
        uploadedUrls = githubRes.urls;
      }
    } catch (uploadError) {
      console.error('Image upload failed:', uploadError);
      uploadedUrls = ['Image upload service temporarily unavailable'];
    }

    // 7️⃣ Save maintenance request to database IMMEDIATELY with pending AI status
    const maintenance = await prisma.maintenance.create({
      data: {
        userId: parseInt(userId),
        propertyId: user.propertyId,
        rawRequest: `${title}: ${rawRequest}`,
        processedRequest: rawRequest.length > 200 ? rawRequest.substring(0, 200) + '...' : rawRequest,
        urgency: 'medium', // Default, will be updated by background process
        status: 'pending',
        dateIssued: new Date(),
      },
    });

    // 8️⃣ Save uploaded file URLs in Resource table
    for (const url of uploadedUrls) {
      await prisma.resource.create({
        data: {
          referenceId: maintenance.maintenanceId,
          referenceType: 'Maintenance',
          url,
          fileName: url.split('/').pop() || 'unknown',
        },
      });
    }

    // 9️⃣ Create initial documentation record (will be updated by background process)
    const initialDocData = {
      uploadedFiles: uploadedUrls,
      originalFilenames: images.map((i) => i.name),
      userDescription: rawRequest,
      processedRequest: 'Processing...',
      urgencyLevel: 2,
      procedureGenerated: 'Generating...',
      analysisTimestamp: new Date().toISOString(),
      status: 'processing'
    };

    await prisma.documentation.create({
      data: {
        maintenanceID: maintenance.maintenanceId,
        dateIssued: new Date(),
        remarks: JSON.stringify(initialDocData),
      },
    });

    // 🔟 Trigger background processing (non-blocking)
    // Using setImmediate-like pattern to not block response
    processMaintenanceInBackground(
      maintenance.maintenanceId,
      parseInt(userId),
      user.propertyId,
      title,
      rawRequest,
      base64Images,
      translateToTagalog,
      aiAnalysis,
      baseUrl
    ).catch(err => {
      console.error('[Background] Processing failed:', err);
    });

    // 1️⃣1️⃣ Return success response IMMEDIATELY
    return NextResponse.json(
      {
        message: 'Maintenance request submitted successfully! AI analysis is processing in the background.',
        maintenanceId: maintenance.maintenanceId,
        uploadedUrls,
        status: 'submitted',
        aiProcessing: true
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating maintenance request:', error);
    return NextResponse.json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper Functions

function formatProcedureMessage(
  title: string, 
    procedure: string, 
  summary: string, 
  urgency: number, 
  isTagalog: boolean = false
): string {
  let cleanedProcedure = procedure
    .replace(/(Step \d+:)/g, '\n$1')
    .replace(/\n+/g, '\n')
    .trim();

  if (!cleanedProcedure || cleanedProcedure.split('\n').length < 3) {
    if (isTagalog) {
      cleanedProcedure = `Step 1: Suriin ang iniulat na isyu: "${summary}"\nStep 2: Tayahin ang kinakailangang pagkumpuni at tipunin ang mga materyales\nStep 3: Isagawa ang kinakailangang pag-aayos\nStep 4: Subukan kung naayos na ang isyu\nStep 5: Linisin ang lugar at i-update ang mga talaan ng pag-aayos`;
    } else {
      cleanedProcedure = `Step 1: Inspect the reported issue: "${summary}"\nStep 2: Assess necessary repairs and gather materials\nStep 3: Perform the required maintenance work\nStep 4: Test that the issue is resolved\nStep 5: Clean the work area and update maintenance records`;
    }
  }

  const languageNote = isTagalog ? "(Translated to Tagalog)" : "";
  const urgencyText = getUrgencyText(urgency);
  
  const noteText = isTagalog 
    ? "*Paunawa: Ito ay AI-generated na procedure at maaaring hindi magbigay ng eksaktong solusyon. Laging suriin ang sitwasyon nang propesyonal at sundin ang mga protocol sa kaligtasan.*"
    : "*Note: This is an AI-generated procedure and may not provide exact solutions. Always assess the situation professionally and follow safety protocols.*";

  return `🔧 **MAINTENANCE REQUEST: ${title.toUpperCase()}** ${languageNote}\n\n**Urgency Level:** ${urgency}/4 (${urgencyText})\n**Issue Summary:** ${summary}\n\n**MAINTENANCE PROCEDURE:**\n${cleanedProcedure}\n\n---\n${noteText}`;
}

function getUrgencyText(urgencyLevel: number): string {
  switch (urgencyLevel) {
    case 1: return 'Low';
    case 2: return 'Medium';
    case 3: return 'High';
    case 4: return 'Critical';
    default: return 'Medium';
  }
}

function getUrgencyLevel(urgencyString: string): number {
  switch (urgencyString) {
    case 'low': return 1;
    case 'medium': return 2;
    case 'high': return 3;
    case 'critical': return 4;
    default: return 2;
  }
}

function calculateAverageConfidence(results: any[]): number {
  if (!results || results.length === 0) return 0;
  
  const confidenceScores = results
    .filter(r => r.confidence_score !== undefined)
    .map(r => r.confidence_score);
    
  if (confidenceScores.length === 0) return 0;
  
  const average = confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length;
  return Math.round(average * 100);
}

// GET endpoint to retrieve maintenance requests
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId || parseInt(userId) !== parseInt(session.user.id)) {
      return NextResponse.json({ message: 'Invalid user ID' }, { status: 400 });
    }

    const maintenanceRequests = await prisma.maintenance.findMany({
      where: { userId: parseInt(userId) },
      include: {
        property: true,
        documentations: true,
        availabilities: true
      },
      orderBy: { dateIssued: 'desc' }
    });

    // Transform the response to ensure documentations is always an array for frontend compatibility
    const transformedRequests = maintenanceRequests.map(req => {
      // Parse remarks if it's a JSON string
      let parsedRemarks = null;
      if (req.documentations?.remarks) {
        try {
          parsedRemarks = JSON.parse(req.documentations.remarks);
        } catch {
          parsedRemarks = { rawRemarks: req.documentations.remarks };
        }
      }

      return {
        ...req,
        // Convert single documentation to array format for frontend
        documentations: req.documentations 
          ? [{ 
              docuID: req.documentations.docuID,
              dateIssued: req.documentations.dateIssued?.toISOString() || null,
              dateFixed: req.documentations.dateFixed?.toISOString() || null,
              inChargeName: req.documentations.inChargeName,
              inChargeNumber: req.documentations.inChargeNumber,
              inChargePayment: req.documentations.inChargePayment,
              remarks: parsedRemarks,
              totalMaterialCost: req.documentations.totalMaterialCost,
              documentation: req.documentations.documentation,
              aiDescription: req.documentations.aiDescription,
              aiDescriptionTl: req.documentations.aiDescriptionTl
            }] 
          : []
      };
    });

    return NextResponse.json({ maintenanceRequests: transformedRequests });
  } catch (error) {
    console.error('Error fetching maintenance requests:', error);
    return NextResponse.json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}