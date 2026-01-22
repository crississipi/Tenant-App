import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import axios from 'axios';
import { prisma } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const HF_TOKEN = process.env.HF_API_KEY!;
const PROCEDURE_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1";
const TRANSLATE_URL = "https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-en-tl";
const PYTHON_API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8000'
  : process.env.PYTHON_API_URL;

// Helper function to save images locally when GitHub upload fails
async function saveImagesLocally(
  images: { name: string; base64: string; type: string }[],
  propertyId: number
): Promise<string[]> {
  const urls: string[] = [];
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'maintenance', propertyId.toString());
  
  try {
    // Ensure directory exists
    await mkdir(uploadDir, { recursive: true });
    
    for (const image of images) {
      try {
        // Generate unique filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const ext = image.name.split('.').pop() || 'jpg';
        const fileName = `${timestamp}_${randomStr}.${ext}`;
        const filePath = path.join(uploadDir, fileName);
        
        // Extract base64 data (remove data:image/xxx;base64, prefix)
        const base64Data = image.base64.split(',')[1] || image.base64;
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Write file
        await writeFile(filePath, buffer);
        
        // Generate URL path
        const url = `/uploads/maintenance/${propertyId}/${fileName}`;
        urls.push(url);
        console.log(`[Maintenance] Saved image locally: ${url}`);
      } catch (imgError) {
        console.error(`[Maintenance] Failed to save image ${image.name}:`, imgError);
      }
    }
  } catch (dirError) {
    console.error('[Maintenance] Failed to create upload directory:', dirError);
  }
  
  return urls;
}

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
        // Use Buffer instead of atob (Node.js compatible)
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: img.type });
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

    // 8️⃣ Send email notification to landlord
    try {
      // Get landlord details (Property -> Users relation returns an array)
      const property = await prisma.property.findUnique({
        where: { propertyId },
        include: {
          Users: {
            select: {
              userID: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            }
          }
        }
      });

      // Get tenant details
      const tenant = await prisma.users.findUnique({
        where: { userID: userId },
        select: { firstName: true, lastName: true, userID: true }
      });

      // Normalize landlord user selection: prefer role 'landlord' or 'owner'
      const landlordUser = property?.Users?.find((u: any) => ['landlord', 'owner'].includes(String(u.role).toLowerCase())) || property?.Users?.[0];

      if (landlordUser?.email && tenant) {
        const { sendMaintenanceNotificationEmail } = await import('@/lib/email');

        await sendMaintenanceNotificationEmail({
          landlordEmail: landlordUser.email,
          landlordName: `${landlordUser.firstName || ''} ${landlordUser.lastName || ''}`.trim(),
          tenantName: `${tenant.firstName || ''} ${tenant.lastName || ''}`.trim(),
          propertyName: property?.name || '',
          maintenanceTitle: title,
          description: finalProcessedRequest,
          urgency: getUrgencyText(urgencyLevel),
          dateSubmitted: new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' }),
          maintenanceId: maintenanceId,
        });

        console.log(`[Background] Email notification sent to landlord: ${landlordUser.email}`);
      }
    } catch (emailError) {
      console.error('[Background] Email notification failed:', emailError);
    }

    // 9️⃣ Create notification for landlord in database
    try {
      // Get landlord details from property
      const property = await prisma.property.findUnique({
        where: { propertyId },
        include: {
          Users: {
            select: {
              userID: true,
              role: true,
            }
          }
        }
      });

      // Normalize landlord user selection: prefer role 'landlord' or 'owner'
      const landlordUser = property?.Users?.find((u: any) => ['landlord', 'owner'].includes(String(u.role).toLowerCase())) || property?.Users?.[0];

      if (landlordUser?.userID) {
        await prisma.notification.create({
          data: {
            userId: landlordUser.userID,
            type: 'maintenance_request',
            message: `New Maintenance Request: ${title} - ${finalProcessedRequest.substring(0, 100)}${finalProcessedRequest.length > 100 ? '...' : ''}`,
            relatedId: maintenanceId,
            isRead: false,
            createdAt: new Date(),
          }
        });
        console.log(`[Background] Notification created for landlord ID: ${landlordUser.userID}`);
      }
    } catch (notificationError) {
      console.error('[Background] Failed to create notification:', notificationError);
    }

    // 🔟 Generate and send AI first-aid guide to tenant
    try {
      // Get landlord info for sender ID
      const propertyWithLandlord = await prisma.property.findUnique({
        where: { propertyId },
        include: {
          Users: {
            where: { role: 'landlord' },
            select: { userID: true },
            take: 1
          }
        }
      });
      
      const landlordId = propertyWithLandlord?.Users?.[0]?.userID || 2; // Fallback to ID 2 (admin)

      console.log('[Background] Generating AI first-aid guide for tenant...');
      
      // Call the maintenance guide API
      const guideResponse = await fetch(`${baseUrl}/api/generate-maintenance-guide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title,
          description: finalProcessedRequest,
          urgency: getUrgencyText(urgencyLevel),
          category: imageAnalysisData?.maintenanceIssues?.[0] || 'general',
          imageAnalysis: imageAnalysisData?.descriptions?.join('; ') || null,
          translateToTagalog: true
        }),
      });

      if (guideResponse.ok) {
        const guideData = await guideResponse.json();
        
        if (guideData.success && guideData.guide) {
          // Format the guide as a readable message (inline function to avoid route import issues)
          const formatGuideMessage = (guide: any, guideTl?: any): string => {
            const sections = [];
            
            sections.push('🔧 **MAINTENANCE FIRST-AID GUIDE**\n');
            
            if (guide.immediateActions && guide.immediateActions.length > 0) {
              sections.push('**⚡ Immediate Actions:**');
              guide.immediateActions.forEach((action: string, i: number) => {
                sections.push(`${i + 1}. ${action}`);
              });
              sections.push('');
            }
            
            if (guide.safetyPrecautions && guide.safetyPrecautions.length > 0) {
              sections.push('**⚠️ Safety Precautions:**');
              guide.safetyPrecautions.forEach((precaution: string) => {
                sections.push(`• ${precaution}`);
              });
              sections.push('');
            }
            
            if (guide.temporaryFixes && guide.temporaryFixes.length > 0) {
              sections.push('**🔨 Temporary Fixes:**');
              guide.temporaryFixes.forEach((fix: string, i: number) => {
                sections.push(`${i + 1}. ${fix}`);
              });
              sections.push('');
            }
            
            if (guide.whatToAvoid && guide.whatToAvoid.length > 0) {
              sections.push('**❌ What to Avoid:**');
              guide.whatToAvoid.forEach((item: string) => {
                sections.push(`• ${item}`);
              });
              sections.push('');
            }
            
            if (guide.estimatedWaitTime) {
              sections.push(`**⏱️ Estimated Response Time:** ${guide.estimatedWaitTime}\n`);
            }
            
            sections.push('---');
            sections.push('*This is an AI-generated first-aid guide. For serious issues, please wait for professional maintenance staff.*');
            
            return sections.join('\n');
          };
          
          const guideMessage = formatGuideMessage(guideData.guide, guideData.guideTl);
          
          // Save the AI guide message to tenant (from landlord)
          await prisma.messages.create({
            data: {
              senderID: landlordId,
              receiverID: userId,
              message: guideMessage,
              dateSent: new Date(),
              read: false,
            },
          });
          
          console.log(`[Background] AI first-aid guide sent to tenant (user ${userId})`);
        }
      } else {
        console.warn('[Background] Failed to generate AI guide:', await guideResponse.text());
      }
    } catch (guideError) {
      console.error('[Background] Failed to generate/send AI guide:', guideError);
    }

    // 🔟 AI Training feedback (non-blocking)
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
    console.log('[Maintenance POST] Session:', session?.user?.id ? 'authenticated' : 'not authenticated');
    
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
      include: { Property: true },
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
        // Fallback: save images locally
        uploadedUrls = await saveImagesLocally(base64Images, user.propertyId);
      } else {
        uploadedUrls = githubRes.urls;
        console.log(`[Maintenance] Successfully uploaded ${uploadedUrls.length} images to GitHub`);
      }
    } catch (uploadError) {
      console.error('Image upload failed:', uploadError);
      // Fallback: save images locally
      uploadedUrls = await saveImagesLocally(base64Images, user.propertyId);
    }

    // 7️⃣ Save maintenance request to database IMMEDIATELY with pending AI status
    const maintenance = await prisma.maintenance.create({
      data: {
        userId: parseInt(userId),
        propertyId: user.propertyId,
        title: title || null,
        rawRequest: rawRequest,
        processedRequest: rawRequest.length > 200 ? rawRequest.substring(0, 200) + '...' : rawRequest,
        urgency: 'medium', // Default, will be updated by background process
        status: 'pending',
        dateIssued: new Date(),
      },
    });

    // 8️⃣ Save uploaded file URLs in Resource table (only save valid URLs)
    const validUrls = uploadedUrls.filter(url => url.startsWith('http') || url.startsWith('/uploads'));
    console.log(`[Maintenance] Saving ${validUrls.length} image URLs to Resource table for maintenance #${maintenance.maintenanceId}`);
    
    for (const url of validUrls) {
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
  } catch (error: any) {
    console.error('Error creating maintenance request:', error);
    console.error('Error stack:', error?.stack);
    return NextResponse.json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
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
    console.log('[Maintenance GET] Starting request...');
    
    const session = await getServerSession(authOptions);
    console.log('[Maintenance GET] Session:', session?.user?.id ? `User ${session.user.id}` : 'not authenticated');
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    console.log('[Maintenance GET] Requested userId:', userId);
    
    if (!userId || parseInt(userId) !== parseInt(session.user.id)) {
      return NextResponse.json({ message: 'Invalid user ID' }, { status: 400 });
    }

    console.log('[Maintenance GET] Fetching from database...');
    const maintenanceRequests = await prisma.maintenance.findMany({
      where: { userId: parseInt(userId) },
      include: {
        property: {
          select: {
            propertyId: true,
            name: true,
            address: true
          }
        },
        documentation: {
          select: {
            docuID: true,
            dateIssued: true,
            dateFixed: true,
            inChargeName: true,
            inChargeNumber: true,
            inChargePayment: true,
            remarks: true,
            totalMaterialCost: true,
            aiDescription: true,
            aiDescriptionTl: true
          }
        },
        availabilities: {
          select: {
            id: true,
            day: true,
            date: true,
            timeAvailableFrom: true,
            timeAvailableTo: true
          }
        }
      },
      orderBy: { dateIssued: 'desc' }
    });

    console.log('[Maintenance GET] Found', maintenanceRequests.length, 'requests');

    // Transform the response - safely handle all date conversions
    const transformedRequests = maintenanceRequests.map(req => {
      // Parse remarks if it's a JSON string
      let parsedRemarks = null;
      if (req.documentation?.remarks) {
        try {
          parsedRemarks = JSON.parse(req.documentation.remarks);
        } catch {
          parsedRemarks = { rawRemarks: req.documentation.remarks };
        }
      }

      // Safely serialize dates
      const safeDate = (date: Date | null | undefined) => {
        if (!date) return null;
        try {
          return date instanceof Date ? date.toISOString() : String(date);
        } catch {
          return null;
        }
      };

      return {
        maintenanceId: req.maintenanceId,
        userId: req.userId,
        propertyId: req.propertyId,
        title: req.title || null,
        rawRequest: req.rawRequest,
        processedRequest: req.processedRequest,
        urgency: req.urgency,
        status: req.status,
        schedule: safeDate(req.schedule),
        dateIssued: safeDate(req.dateIssued),
        createdAt: safeDate(req.createdAt),
        updatedAt: safeDate(req.updatedAt),
        property: req.property,
        availabilities: req.availabilities?.map((a) => ({
          ...a,
          date: safeDate(a.date),
          timeAvailableFrom: safeDate(a.timeAvailableFrom),
          timeAvailableTo: safeDate(a.timeAvailableTo)
        })) || [],
        // Convert single documentation to array format for frontend
        documentations: req.documentation 
          ? [{ 
              docuID: req.documentation.docuID,
              dateIssued: safeDate(req.documentation.dateIssued),
              dateFixed: safeDate(req.documentation.dateFixed),
              inChargeName: req.documentation.inChargeName,
              inChargeNumber: req.documentation.inChargeNumber,
              inChargePayment: req.documentation.inChargePayment,
              remarks: parsedRemarks,
              totalMaterialCost: req.documentation.totalMaterialCost,
              aiDescription: req.documentation.aiDescription,
              aiDescriptionTl: req.documentation.aiDescriptionTl
            }] 
          : []
      };
    });

    return NextResponse.json({ maintenanceRequests: transformedRequests });
  } catch (error: any) {
    console.error('Error fetching maintenance requests:', error);
    console.error('Error stack:', error?.stack);
    return NextResponse.json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}