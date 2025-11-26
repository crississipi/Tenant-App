import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const HF_TOKEN = process.env.HF_API_KEY!;
const PROCEDURE_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1";
const TRANSLATE_URL = "https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-en-tl";
const PYTHON_API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8000'
  : process.env.PYTHON_API_URL;

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

    // 5️⃣ Convert images to base64 for AI analysis
    const base64Images: string[] = [];
    for (const image of images) {
      const bytes = await image.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = `data:${image.type};base64,${buffer.toString('base64')}`;
      base64Images.push(base64);
    }

    // 6️⃣ STEP 1: Analyze images using Python AI
    let pythonResults = null;
    let imageAnalysisData = null;

    try {
      console.log('Sending images to Python AI for analysis...');
      
      const pythonFormData = new FormData();
      images.forEach(file => pythonFormData.append('files', file));

      const pythonResponse = await fetch(`${PYTHON_API_URL}/analyze-multiple-images`, {
        method: 'POST',
        body: pythonFormData,
      });

      if (pythonResponse.ok) {
        pythonResults = await pythonResponse.json();
        console.log('Python AI analysis completed:', pythonResults);
        
        // Extract image analysis data for summarization
        if (pythonResults.results && pythonResults.results.length > 0) {
          const successfulResults = pythonResults.results.filter((r: any) => r.success);
          imageAnalysisData = {
            descriptions: successfulResults.map((r: any) => r.description),
            maintenanceIssues: successfulResults.map((r: any) => r.maintenance_issue),
            components: successfulResults.flatMap((r: any) => r.analysis?.components || []),
            riskLevels: successfulResults.map((r: any) => r.analysis?.risk_level || 'medium')
          };
        }
      } else {
        console.warn('Python AI analysis failed, using fallback analysis');
      }
    } catch (pythonError) {
      console.warn('Python AI service unavailable:', pythonError);
    }

    // 7️⃣ STEP 2: Summarize request and determine urgency
    let finalProcessedRequest = rawRequest; // Default to original if summarization fails
    let urgencyLevel = 2; // Default medium urgency

    try {
      console.log('Summarizing request and determining urgency...');
      
      // Prepare data for summarization
      const summarizationData = {
        title: title,
        userDescription: rawRequest,
        imageAnalysis: imageAnalysisData,
        frontendAiAnalysis: aiAnalysis ? JSON.parse(aiAnalysis) : null
      };

      const summarizationResponse = await fetch(`${baseUrl}/api/analyze-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(summarizationData),
      });

      if (summarizationResponse.ok) {
        const { summary, urgencyLevel: analyzedUrgency } = await summarizationResponse.json();
        finalProcessedRequest = summary || rawRequest;
        urgencyLevel = analyzedUrgency || urgencyLevel;
        console.log('Request summarized successfully. Urgency level:', urgencyLevel);
      } else {
        console.warn('Summarization API failed, using original description');
        // Fallback: Simple truncation if API fails
        finalProcessedRequest = rawRequest.length > 200 
          ? rawRequest.substring(0, 200) + '...' 
          : rawRequest;
      }
    } catch (summarizationError) {
      console.error('Summarization process failed:', summarizationError);
      // Fallback: Simple truncation
      finalProcessedRequest = rawRequest.length > 200 
        ? rawRequest.substring(0, 200) + '...' 
        : rawRequest;
    }

    // 8️⃣ STEP 3: Generate step-by-step procedure for landlord
    let procedureText = "";
    try {
      const procedurePrompt = `
        Create a step-by-step maintenance procedure for this rental property issue:
        
        TITLE: "${title}"
        ORIGINAL DESCRIPTION: "${rawRequest}"
        SUMMARIZED ISSUE: "${finalProcessedRequest}"
        URGENCY: Level ${urgencyLevel}/4
        ${imageAnalysisData ? `AI IDENTIFIED COMPONENTS: ${imageAnalysisData.components.join(', ')}` : ''}
        
        Provide 3-5 clear steps for maintenance staff. Format exactly as:
        Step 1: [First action - inspection/assessment]
        Step 2: [Second action - preparation/gathering]
        Step 3: [Third action - repair/implementation] 
        Step 4: [Fourth action - testing/verification]
        Step 5: [Fifth action - cleanup/follow-up]
        
        Make steps practical, actionable, and specific to rental property maintenance.
        Consider safety protocols and property preservation.
      `;

      const procedureRes = await axios.post(
        PROCEDURE_URL,
        { inputs: procedurePrompt },
        { 
          headers: { 
            Authorization: `Bearer ${HF_TOKEN}`, 
            'Content-Type': 'application/json' 
          },
          timeout: 30000
        }
      );

      procedureText = procedureRes.data?.[0]?.generated_text || "";
      
      // Clean up the procedure text
      procedureText = procedureText
        .replace(procedurePrompt, '')
        .replace(/<[^>]*>/g, '')
        .trim();
        
    } catch (procedureError) {
      console.error('Procedure generation failed:', procedureError);
      procedureText = `Step 1: Inspect the reported issue: "${finalProcessedRequest}"\nStep 2: Gather necessary tools and materials\nStep 3: Perform required repairs\nStep 4: Test the repair\nStep 5: Clean up and document work`;
    }

    // 9️⃣ Translate procedure to Tagalog if requested
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
                { 
                  headers: { 
                    Authorization: `Bearer ${HF_TOKEN}`,
                    'Content-Type': 'application/json'
                  },
                  timeout: 30000
                }
              );
              return translateRes.data?.[0]?.translation_text || step;
            } catch (translateError) {
              console.error('Translation failed for step:', step, translateError);
              return step;
            }
          })
        );

        tagalogProcedure = steps.map((step, index) => {
          const stepNumber = step.match(/Step (\d+):/)?.[1] || (index + 1).toString();
          return `Step ${stepNumber}: ${translatedSteps[index]}`;
        }).join('\n');

      } catch (translationError) {
        console.error('Tagalog translation failed:', translationError);
        tagalogProcedure = procedureText;
      }
    }

    // 🔟 Format the procedure message
    const formattedProcedure = formatProcedureMessage(
      title, 
      translateToTagalog ? tagalogProcedure : procedureText, 
      finalProcessedRequest, 
      urgencyLevel,
      translateToTagalog
    );

    // 1️⃣1️⃣ Upload images to GitHub
    const encodedImages = await Promise.all(
      images.map(async (img, index) => ({
        name: img.name,
        content: base64Images[index].split(',')[1],
      }))
    );

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

    // 1️⃣2️⃣ Save maintenance request to database
    const maintenance = await prisma.maintenance.create({
      data: {
        title,
        userId: parseInt(userId),
        propertyId: user.propertyId,
        rawRequest: rawRequest,
        processedRequest: finalProcessedRequest,
        urgency: getUrgencyText(urgencyLevel),
        status: 'pending',
        dateIssued: new Date(),
      },
    });

    // 1️⃣3️⃣ Save uploaded file URLs in Resource table
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

    // 1️⃣4️⃣ Create enhanced documentation record with AI analysis
    const documentationData = {
      uploadedFiles: uploadedUrls,
      originalFilenames: images.map((i) => i.name),
      userDescription: rawRequest,
      processedRequest: finalProcessedRequest,
      urgencyLevel: urgencyLevel,
      procedureGenerated: formattedProcedure,
      translatedToTagalog: translateToTagalog,
      imageAnalysis: pythonResults,
      frontendAiAnalysis: aiAnalysis ? JSON.parse(aiAnalysis) : null,
      summarizationUsed: true,
      analysisTimestamp: new Date().toISOString()
    };

    await prisma.documentation.create({
      data: {
        maintenanceID: maintenance.maintenanceId,
        documentation: JSON.stringify(documentationData),
        dateIssued: new Date(),
      },
    });

    // 1️⃣5️⃣ Send AI Training Feedback (Non-blocking)
    try {
      if (pythonResults && process.env.ENABLE_AI_TRAINING === 'true') {
        fetch(`${PYTHON_API_URL}/training/feedback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            maintenance_id: maintenance.maintenanceId,
            user_description: rawRequest,
            ai_analysis: pythonResults,
            final_summary: finalProcessedRequest,
            urgency_level: urgencyLevel,
            timestamp: new Date().toISOString()
          }),
        }).catch(trainError => {
          console.warn('AI training feedback failed:', trainError);
        });
      }
    } catch (trainingError) {
      console.warn('AI training submission failed:', trainingError);
    }

    // 1️⃣6️⃣ Send procedure message to landlord (user ID 2)
    try {
      await prisma.messages.create({
        data: {
          senderID: parseInt(userId),
          receiverID: 2,
          message: formattedProcedure,
          dateSent: new Date(),
          read: false,
        },
      });
    } catch (messageError) {
      console.error('Failed to send procedure message:', messageError);
    }

    // 1️⃣7️⃣ Return success response
    return NextResponse.json(
      {
        message: 'Maintenance request submitted successfully',
        maintenanceId: maintenance.maintenanceId,
        summary: finalProcessedRequest,
        urgency: urgencyLevel,
        uploadedUrls,
        procedureSent: true,
        translatedToTagalog: translateToTagalog,
        aiAnalysisUsed: !!pythonResults,
        summarizationUsed: true
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

    return NextResponse.json({ maintenanceRequests });
  } catch (error) {
    console.error('Error fetching maintenance requests:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}