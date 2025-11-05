import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();
const HF_TOKEN = process.env.HF_API_KEY!;
const PROCEDURE_URL = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1";
const TRANSLATE_URL = "https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-en-tl";

export async function POST(request: NextRequest) {
  try {
    // 1️⃣ Authentication check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // 2️⃣ Extract form data
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const userId = formData.get('userId') as string;
    const images = formData.getAll('images') as File[];
    const translateToTagalog = formData.get('translateToTagalog') === 'true';

    // 3️⃣ Validate inputs
    if (!title || !description || images.length === 0) {
      return NextResponse.json({ message: 'All fields including at least one image are required.' }, { status: 400 });
    }
    if (title.length < 5) {
      return NextResponse.json({ message: 'Title must be at least 5 characters long.' }, { status: 400 });
    }
    if (description.length < 10) {
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

    // 6️⃣ Check image quality and relevance using analyze-image API
    const qualityCheck = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/analyze-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrls: base64Images }),
    });

    const qualityData = await qualityCheck.json();
    
    if (!qualityCheck.ok) {
      const rejectionReasons = qualityData.rejectedReasons || qualityData.results?.map((r: any) => r.rejectionReason).filter(Boolean);
      return NextResponse.json(
        {
          message: 'Image validation failed',
          details: rejectionReasons || ['One or more images were rejected'],
          rejectedCount: qualityData.rejectedCount
        },
        { status: 400 }
      );
    }

    const { results } = qualityData;

    // 7️⃣ Proceed with text analysis using analyze-request API
    const captions = results.map((r: any) => r.caption);
    const aiTextRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/analyze-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userText: description,
        imageDescriptions: captions,
      }),
    });

    if (!aiTextRes.ok) {
      return NextResponse.json({ message: 'Failed to analyze request content' }, { status: 500 });
    }

    const { summary, urgencyLevel } = await aiTextRes.json();

    // 8️⃣ Generate step-by-step procedure for landlord
    let procedureText = "";
    try {
      const procedurePrompt = `
        Create a step-by-step maintenance procedure for this rental property issue:
        
        TITLE: "${title}"
        ISSUE: "${summary}"
        URGENCY: Level ${urgencyLevel}/4
        
        Provide 3-5 clear steps for maintenance staff. Format exactly as:
        Step 1: [First action - inspection/assessment]
        Step 2: [Second action - preparation/gathering]
        Step 3: [Third action - repair/implementation]
        Step 4: [Fourth action - testing/verification]
        Step 5: [Fifth action - cleanup/follow-up]
        
        Make steps practical, actionable, and specific to rental property maintenance.
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
    } catch (procedureError) {
      console.error('Procedure generation failed:', procedureError);
      procedureText = `Step 1: Inspect the reported issue\nStep 2: Gather necessary tools and materials\nStep 3: Perform required repairs\nStep 4: Test the repair\nStep 5: Clean up and document work`;
    }

    // 9️⃣ Translate procedure to Tagalog if requested
    let tagalogProcedure = "";
    if (translateToTagalog) {
      try {
        // Extract just the step content for translation
        const steps = procedureText.split('\n').filter(line => line.startsWith('Step'));
        const stepContents = steps.map(step => step.replace(/Step \d+:\s*/, ''));
        
        // Translate each step
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
              return step; // Fallback to original English
            }
          })
        );

        // Reconstruct procedure with translated steps
        tagalogProcedure = steps.map((step, index) => {
          const stepNumber = step.match(/Step (\d+):/)?.[1] || (index + 1).toString();
          return `Step ${stepNumber}: ${translatedSteps[index]}`;
        }).join('\n');

      } catch (translationError) {
        console.error('Tagalog translation failed:', translationError);
        tagalogProcedure = procedureText; // Fallback to English
      }
    }

    // 🔟 Format the procedure message
    const formattedProcedure = formatProcedureMessage(
      title, 
      translateToTagalog ? tagalogProcedure : procedureText, 
      summary, 
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

    const githubUpload = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/upload-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: encodedImages,
        folderName: `maintenance/${user.propertyId}`,
      }),
    });

    const githubRes = await githubUpload.json();
    if (!githubRes.success) {
      return NextResponse.json({ message: 'GitHub upload failed.', details: githubRes.message }, { status: 500 });
    }

    const uploadedUrls = githubRes.urls;

    // 1️⃣2️⃣ Save maintenance request to database
    const maintenance = await prisma.maintenance.create({
      data: {
        userId: parseInt(userId),
        propertyId: user.propertyId,
        rawRequest: description,
        processedRequest: summary,
        urgency: urgencyLevel.toString(),
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

    // 1️⃣4️⃣ Create documentation record
    await prisma.documentation.create({
      data: {
        maintenanceID: maintenance.maintenanceId,
        documentation: JSON.stringify({
          uploadedFiles: uploadedUrls,
          originalFilenames: images.map((i) => i.name),
          aiSummary: summary,
          urgencyLevel: urgencyLevel,
          procedureGenerated: formattedProcedure,
          translatedToTagalog: translateToTagalog
        }),
        dateIssued: new Date(),
      },
    });

    // 1️⃣5️⃣ Send procedure message to landlord (user ID 2)
    try {
      await prisma.messages.create({
        data: {
          senderID: parseInt(userId), // Tenant sends the message
          receiverID: 2, // Landlord's ID
          message: formattedProcedure,
          dateSent: new Date(),
          read: false,
        },
      });
    } catch (messageError) {
      console.error('Failed to send procedure message:', messageError);
      // Continue even if message sending fails
    }

    return NextResponse.json(
      {
        message: 'Maintenance request submitted successfully',
        maintenanceId: maintenance.maintenanceId,
        summary,
        urgency: urgencyLevel,
        uploadedUrls,
        procedureSent: true,
        translatedToTagalog: translateToTagalog
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating maintenance request:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}

function formatProcedureMessage(
  title: string, 
  procedure: string, 
  summary: string, 
  urgency: number, 
  isTagalog: boolean = false
): string {
  // Clean and format the procedure text
  let cleanedProcedure = procedure
    .replace(/(Step \d+:)/g, '\n$1') // Ensure each step is on new line
    .replace(/\n+/g, '\n') // Remove multiple newlines
    .trim();

  // If procedure generation failed or returned minimal content, use a default format
  if (!cleanedProcedure || cleanedProcedure.split('\n').length < 3) {
    if (isTagalog) {
      cleanedProcedure = `Step 1: Suriin ang iniulat na isyu: "${summary}"\nStep 2: Tayahin ang kinakailangang pagkumpuni at tipunin ang mga materyales\nStep 3: Isagawa ang kinakailangang pag-aayos\nStep 4: Subukan kung naayos na ang isyu\nStep 5: Linisin ang lugar at i-update ang mga talaan ng pag-aayos`;
    } else {
      cleanedProcedure = `Step 1: Inspect the reported issue: "${summary}"\nStep 2: Assess necessary repairs and gather materials\nStep 3: Perform the required maintenance work\nStep 4: Test that the issue is resolved\nStep 5: Clean the work area and update maintenance records`;
    }
  }

  const languageNote = isTagalog ? "(Translated to Tagalog)" : "";
  const noteText = isTagalog 
    ? "*Paunawa: Ito ay AI-generated na procedure at maaaring hindi magbigay ng eksaktong solusyon. Laging suriin ang sitwasyon nang propesyonal at sundin ang mga protocol sa kaligtasan.*"
    : "*Note: This is an AI-generated procedure and may not provide exact solutions. Always assess the situation professionally and follow safety protocols.*";

  return `🔧 **MAINTENANCE REQUEST: ${title.toUpperCase()}** ${languageNote}\nUrgency Level: ${urgency}/4\n\n${cleanedProcedure}\n\n---\n${noteText}`;
}