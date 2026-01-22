import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface MaintenanceGuideRequest {
  title: string;
  description: string;
  urgency: string;
  category?: string;
  imageAnalysis?: string;
  translateToTagalog?: boolean;
}

interface MaintenanceGuideResponse {
  success: boolean;
  guide: {
    title: string;
    introduction: string;
    safetyWarnings: string[];
    steps: {
      stepNumber: number;
      action: string;
      details: string;
      tip?: string;
    }[];
    toolsNeeded: string[];
    whenToCallProfessional: string;
    preventiveTips: string[];
  };
  guideTl?: {
    title: string;
    introduction: string;
    safetyWarnings: string[];
    steps: {
      stepNumber: number;
      action: string;
      details: string;
      tip?: string;
    }[];
    toolsNeeded: string[];
    whenToCallProfessional: string;
    preventiveTips: string[];
  };
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

    const body: MaintenanceGuideRequest = await request.json();
    const { title, description, urgency, category, imageAnalysis, translateToTagalog } = body;

    if (!title || !description) {
      return NextResponse.json(
        { success: false, error: 'Title and description are required' },
        { status: 400 }
      );
    }

    const prompt = `You are an expert home maintenance advisor specializing in EMERGENCY FIRST-AID responses for property issues. A tenant has reported a specific maintenance problem and needs IMMEDIATE, PRACTICAL guidance using ONLY common household items they likely have at home.

**REPORTED ISSUE:**
- Problem Title: ${title}
- Detailed Description: ${description}
- Urgency Level: ${urgency || 'Medium'}
${category ? `- Issue Category: ${category}` : ''}
${imageAnalysis ? `- Visual Analysis: ${imageAnalysis}` : ''}

**CRITICAL INSTRUCTIONS:**
1. Your response MUST be 100% SPECIFIC to "${title}" - do NOT give generic advice
2. Every step must directly address the reported issue: "${description}"
3. ONLY suggest tools found in typical households (NO specialized plumbing/electrical tools)
4. Focus on TEMPORARY FIXES and DAMAGE PREVENTION until professional help arrives
5. Be realistic - tenants are NOT professionals

**COMMON HOUSEHOLD ITEMS AVAILABLE:**
- Towels, rags, old t-shirts, newspapers
- Buckets, pots, bowls, plastic containers
- Duct tape, electrical tape, masking tape
- Plastic bags, cling wrap, aluminum foil
- Rubber bands, hair ties, zip ties
- Old toothbrush, sponges, cleaning supplies
- Flashlight, candles, matches
- Basic tools: screwdriver, pliers, hammer (maybe)
- Baking soda, vinegar, dish soap

**RESPOND IN THIS EXACT JSON FORMAT:**
{
  "guide": {
    "title": "First-Aid Guide: ${title}",
    "introduction": "A specific 2-3 sentence explanation of what's happening with their ${title} issue and what immediate actions they should take to prevent further damage.",
    "safetyWarnings": [
      "Specific safety warning relevant to ${title}",
      "Another relevant safety precaution for this exact issue"
    ],
    "steps": [
      {
        "stepNumber": 1,
        "action": "Immediate action specific to ${title}",
        "details": "Detailed explanation using household items to address the ${title} problem (2-3 sentences)",
        "tip": "Helpful tip specific to this situation"
      }
    ],
    "toolsNeeded": ["Only common household items - be specific to what's needed for ${title}"],
    "whenToCallProfessional": "Specific situations related to ${title} that require immediate professional intervention",
    "preventiveTips": [
      "Tip to prevent ${title} from happening again",
      "Related maintenance advice"
    ]
  }${translateToTagalog ? `,
  "guideTl": {
    "title": "Unang-Tulong na Gabay: ${title}",
    "introduction": "Tagalog translation - specific explanation for their ${title} issue",
    "safetyWarnings": [
      "Tagalog safety warning specific to ${title}",
      "Another Tagalog safety warning"
    ],
    "steps": [
      {
        "stepNumber": 1,
        "action": "Tagalog action for ${title}",
        "details": "Tagalog detailed explanation for ${title} fix",
        "tip": "Tagalog tip"
      }
    ],
    "toolsNeeded": ["Mga gamit sa bahay na kailangan para sa ${title}"],
    "whenToCallProfessional": "Tagalog explanation when to call professional for ${title}",
    "preventiveTips": [
      "Tagalog preventive tip for ${title}"
    ]
  }` : ''}
}

**EXAMPLE - If the issue is "Broken Pipe" or "Water Leak":**
- Step 1: IMMEDIATELY turn off the main water valve (explain where to find it)
- Step 2: Place buckets/containers under the leak to catch water
- Step 3: Use towels to soak up standing water to prevent floor damage
- Step 4: Wrap the pipe with duct tape + plastic bag as temporary seal
- Step 5: Open faucets to drain remaining water from pipes
- Tools: Buckets, towels, duct tape, plastic bags, mop

**EXAMPLE - If the issue is "Clogged Drain":**
- Step 1: Try plunging with a cup or pot if no plunger available
- Step 2: Pour boiling water mixed with dish soap down the drain
- Step 3: Try baking soda + vinegar combination
- Tools: Pot for boiling water, dish soap, baking soda, vinegar

Generate 4-6 HIGHLY SPECIFIC steps for the reported issue: "${title}". Every instruction must directly help with "${description}".`;

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'Coliving Maintenance AI Guide'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 2500,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', errorText);
      return NextResponse.json(
        { success: false, error: 'Failed to generate maintenance guide' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'No response from AI' },
        { status: 500 }
      );
    }

    // Parse the JSON response
    let parsedGuide: MaintenanceGuideResponse;
    try {
      const cleanedContent = content.replace(/```json\n?|\n?```/g, '').trim();
      parsedGuide = JSON.parse(cleanedContent);
      parsedGuide.success = true;
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Return a contextual fallback guide based on the issue
      parsedGuide = {
        success: true,
        guide: {
          title: `First-Aid Guide: ${title}`,
          introduction: `We've received your maintenance request about "${title}". While waiting for professional help, here are some immediate steps you can take to manage this situation safely using items you have at home.`,
          safetyWarnings: [
            `For "${title}": If you notice any danger signs (smoke, sparks, flooding, gas smell), evacuate immediately and call emergency services.`,
            'Do not attempt repairs beyond temporary containment. Your safety is the priority.'
          ],
          steps: [
            {
              stepNumber: 1,
              action: 'Stop the Source (If Possible)',
              details: `For your "${title}" issue: If this involves water, locate and turn off the nearest shut-off valve. If electrical, switch off the circuit breaker. If it's a structural issue, keep the area clear.`,
              tip: 'Take photos now for documentation before making any changes.'
            },
            {
              stepNumber: 2,
              action: 'Contain and Protect',
              details: `Use towels, buckets, plastic bags, or duct tape to contain the "${title}" problem and prevent further damage to surrounding areas.`,
              tip: 'Move valuable items and electronics away from the affected area.'
            },
            {
              stepNumber: 3,
              action: 'Create a Temporary Fix',
              details: `For "${title}": Use household items like duct tape, plastic wrap, or towels as a temporary barrier or seal. This is not a permanent fix but will minimize damage.`,
            },
            {
              stepNumber: 4,
              action: 'Ventilate If Needed',
              details: 'If there are any fumes, moisture, or odors, open windows and doors to improve air circulation in the affected area.',
            },
            {
              stepNumber: 5,
              action: 'Document and Monitor',
              details: `Take clear photos and videos of the "${title}" damage. Note the time it started and check periodically to see if the situation worsens.`,
            }
          ],
          toolsNeeded: ['Towels/rags', 'Buckets or containers', 'Duct tape', 'Plastic bags', 'Flashlight'],
          whenToCallProfessional: `Your "${title}" request has been submitted. Professional help will be arranged. Call emergency services immediately if you notice: active flooding, electrical sparks, gas smell, or structural collapse risk.`,
          preventiveTips: [
            'Regular inspection of your unit can help catch issues early.',
            'Report minor problems immediately before they become major repairs.',
            'Know the location of main shut-off valves and circuit breakers in your unit.'
          ]
        }
      };
    }

    return NextResponse.json(parsedGuide);

  } catch (error) {
    console.error('Error generating maintenance guide:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Helper function to format the guide as a message
export function formatGuideAsMessage(guide: MaintenanceGuideResponse['guide'], guideTl?: MaintenanceGuideResponse['guideTl']): string {
  let message = `🛠️ **${guide.title}**\n\n`;
  message += `${guide.introduction}\n\n`;

  // Safety warnings
  if (guide.safetyWarnings && guide.safetyWarnings.length > 0) {
    message += `⚠️ **SAFETY WARNINGS / MGA BABALA SA KALIGTASAN:**\n`;
    guide.safetyWarnings.forEach((warning, i) => {
      message += `   ${i + 1}. ${warning}\n`;
    });
    message += `\n`;
  }

  // Steps
  message += `📋 **STEP-BY-STEP GUIDE / HAKBANG-HAKBANG NA GABAY:**\n\n`;
  guide.steps.forEach(step => {
    message += `**Step ${step.stepNumber}: ${step.action}**\n`;
    message += `${step.details}\n`;
    if (step.tip) {
      message += `💡 *Tip: ${step.tip}*\n`;
    }
    message += `\n`;
  });

  // Tools needed
  if (guide.toolsNeeded && guide.toolsNeeded.length > 0) {
    message += `🔧 **TOOLS YOU MAY NEED / MGA GAMIT NA MAAARING KAILANGANIN:**\n`;
    message += `   ${guide.toolsNeeded.join(', ')}\n\n`;
  }

  // When to call professional
  message += `📞 **WHEN TO CALL A PROFESSIONAL / KAILAN TUMAWAG NG PROPESYONAL:**\n`;
  message += `${guide.whenToCallProfessional}\n\n`;

  // Preventive tips
  if (guide.preventiveTips && guide.preventiveTips.length > 0) {
    message += `✅ **PREVENTIVE TIPS / MGA TIP PARA SA PAG-IWAS:**\n`;
    guide.preventiveTips.forEach((tip, i) => {
      message += `   ${i + 1}. ${tip}\n`;
    });
    message += `\n`;
  }

  message += `---\n`;
  message += `*This is an AI-generated guide. For complex issues, always wait for professional assistance. Your safety is our priority!*\n`;
  message += `*Ito ay gabay na gawa ng AI. Para sa mga kumplikadong isyu, maghintay ng propesyonal na tulong. Ang iyong kaligtasan ang aming prayoridad!*`;

  return message;
}
