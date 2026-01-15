import { NextRequest, NextResponse } from 'next/server';
import { 
  AdvancedMaintenanceAnalyzer, 
  enhanceAnalysisWithContext,
  enhanceBasicDescription,
  queryHuggingFaceAPI,
  cleanGeneratedText,
  ruleBasedTagalogTranslation
} from '@/lib/ai-analysis';

const HF_TOKEN = process.env.HF_API_KEY!;
const BLIP_BASE_URL = "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-base";
const VIT_GPT2_URL = "https://api-inference.huggingface.co/models/nlpconnect/vit-gpt2-image-captioning";

const analyzer = new AdvancedMaintenanceAnalyzer();

// Helper function to generate caption using HF API
async function multiModelCaptionGeneration(imageBuffer: Buffer): Promise<string> {
  try {
    // Try BLIP base model first
    let caption = await queryHuggingFaceAPI(imageBuffer, BLIP_BASE_URL, HF_TOKEN);
    
    if (caption && Array.isArray(caption) && caption[0]?.generated_text) {
      const text = caption[0].generated_text;
      if (text && text.length > 10) {
        return enhanceDescription(text);
      }
    }

    // Fallback to ViT-GPT2
    caption = await queryHuggingFaceAPI(imageBuffer, VIT_GPT2_URL, HF_TOKEN);
    
    if (caption && Array.isArray(caption) && caption[0]?.generated_text) {
      return enhanceDescription(caption[0].generated_text);
    }

    return "Unable to generate description";
  } catch (error) {
    console.error('Caption generation failed:', error);
    return "Unable to analyze image content";
  }
}

function enhanceDescription(description: string): string {
  if (!description) {
    return "Unable to analyze image content";
  }

  const cleanupPatterns: [RegExp, string][] = [
    [/\b(this is a picture of|there is a|this image shows|this is an image of|you can see|in this photo|the image shows|we can see)\b/gi, ''],
    [/\s+/g, ' ']
  ];

  let cleaned = description;
  for (const [pattern, replacement] of cleanupPatterns) {
    cleaned = cleaned.replace(pattern, replacement);
  }

  cleaned = cleaned.trim();

  if (cleaned) {
    cleaned = cleaned[0].toUpperCase() + cleaned.slice(1);
    if (!'.!?'.includes(cleaned[cleaned.length - 1])) {
      cleaned += '.';
    }
  }

  return cleaned;
}

// AI-powered description expansion
async function expandDescriptionWithAI(basicDescription: string, imageAnalysis: any): Promise<string> {
  try {
    const components = imageAnalysis.components?.join(', ') || 'general property areas';
    const problems = imageAnalysis.problems?.join(', ') || 'something that seems damaged or misplaced';
    const severity = imageAnalysis.severity_indicators?.join(', ') || 'nothing obvious, assume moderate concern';

    const expansionPrompt = `You are a meticulous tenant describing an issue to a property manager. 
Use the observations below to craft a clear, conversational note (2-3 sentences) that still sounds professional:
- Basic observation: ${basicDescription}
- Components involved: ${components}
- Visible issues: ${problems}
- Severity cues: ${severity}

Write sentences that:
1. Start by describing what the tenant plainly sees.
2. Explain how serious it feels and why it matters.
3. Politely ask for timely maintenance help.

Description:`;

    // Try Hugging Face API for expansion
    if (HF_TOKEN) {
      try {
        const response = await queryHuggingFaceAPI(
          JSON.stringify({ inputs: expansionPrompt }),
          "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1",
          HF_TOKEN
        );

        if (response && Array.isArray(response) && response[0]?.generated_text) {
          const expanded = cleanGeneratedText(response[0].generated_text.replace(expansionPrompt, ''));
          if (expanded && expanded.length > 20) {
            return expanded;
          }
        }
      } catch (error) {
        console.warn('HF expansion failed:', error);
      }
    }

    // Fallback to rule-based expansion
    return ruleBasedExpansion(basicDescription, imageAnalysis);
  } catch (error) {
    console.error('AI expansion failed:', error);
    return ruleBasedExpansion(basicDescription, imageAnalysis);
  }
}

function ruleBasedExpansion(basicDescription: string, analysis: any): string {
  const components = analysis.components || [];
  const problems = analysis.problems || [];
  const severityLevel = analysis.severity_level || analysis.severity || 'katamtaman';

  const componentPhrase = formatEnList(components, 'the area shown in the photo');
  const problemPhrase = formatEnList(problems, 'some visible wear');

  const severityDescriptorMap: Record<string, string> = {
    mataas: 'severe damage that looks urgent',
    katamtaman: 'moderate damage that is slowly worsening',
    mababa: 'early damage that could expand if ignored'
  };
  const severityDescriptor = severityDescriptorMap[severityLevel] || 'damage that should be checked soon';

  const syntheticText = `The image reveals ${problemPhrase} affecting ${componentPhrase}, showing ${severityDescriptor}.`;
  const fallbackText = enhanceBasicDescription(basicDescription);

  return craftConversationalDescription(syntheticText, fallbackText, analysis);
}

function formatEnList(items: string[], defaultValue: string): string {
  const filtered = items.filter(item => item);
  if (filtered.length === 0) return defaultValue;
  if (filtered.length === 1) return filtered[0];
  if (filtered.length === 2) return `${filtered[0]} and ${filtered[1]}`;
  return `${filtered.slice(0, -1).join(', ')}, and ${filtered[filtered.length - 1]}`;
}

function ensureSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  if (!'.!?'.includes(trimmed[trimmed.length - 1])) {
    return trimmed + '.';
  }
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function craftConversationalDescription(aiText: string, fallback: string, analysis: any): string {
  const components = analysis.components || [];
  const problems = analysis.problems || [];
  const componentPhrase = formatEnList(components, 'the area shown in the photo');
  const problemPhrase = formatEnList(problems, 'a visible issue');

  const severityLevel = analysis.severity_level || analysis.severity || 'katamtaman';
  const severitySentenceMap: Record<string, string> = {
    mataas: 'It already feels urgent and could pose a safety risk if ignored',
    katamtaman: "It's starting to worsen, so a prompt inspection would really help",
    mababa: 'It is still manageable, but I would like to fix it before it spreads'
  };
  const severitySentence = ensureSentence(severitySentenceMap[severityLevel] || 'It would help to inspect this area so the damage does not spread');

  const observationSentence = ensureSentence(`The photo clearly shows ${problemPhrase} affecting ${componentPhrase}`);
  const cleanedAi = cleanGeneratedText(aiText);
  let detailSentence = '';
  if (cleanedAi && !observationSentence.toLowerCase().includes(cleanedAi.toLowerCase())) {
    detailSentence = ensureSentence(cleanedAi);
  }

  let fallbackSentence = '';
  if (!detailSentence && fallback) {
    fallbackSentence = ensureSentence(fallback);
  }

  const callToAction = ensureSentence('Please help schedule a repair so it does not get worse');

  const sentences = [observationSentence];
  for (const candidate of [detailSentence, fallbackSentence, severitySentence, callToAction]) {
    if (candidate && !sentences.some(s => s.toLowerCase() === candidate.toLowerCase())) {
      sentences.push(candidate);
    }
  }

  return sentences.join(' ').trim();
}

// Translate to Tagalog
async function translateToTagalog(text: string): Promise<string> {
  try {
    // Try Hugging Face Translation API
    if (HF_TOKEN) {
      try {
        const response = await queryHuggingFaceAPI(
          JSON.stringify({ inputs: text }),
          "https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-en-tl",
          HF_TOKEN
        );

        if (response && Array.isArray(response) && response[0]?.translation_text) {
          return ensureNaturalTagalog(response[0].translation_text);
        }
      } catch (error) {
        console.warn('HF translation failed:', error);
      }
    }

    // Fallback to rule-based translation
    return ensureNaturalTagalog(ruleBasedTagalogTranslation(text));
  } catch (error) {
    console.error('Translation failed:', error);
    return ensureNaturalTagalog(text);
  }
}

function ensureNaturalTagalog(text: string): string {
  if (!text) return text;

  let polished = ruleBasedTagalogTranslation(text);

  const replacements: Record<string, string> = {
    'maintenance': 'pagpapanatili',
    'issue': 'problema',
    'problem': 'suliranin',
    'component': 'bahagi',
    'system': 'sistema',
    'please': 'pakiusap',
    'manager': 'tagapamahala',
    'damage': 'sira',
    'repair': 'pag-aayos',
    'check': 'suriin',
    'inspect': 'siyasatin',
    'help': 'tulong',
    'tenant': 'nangungupahan',
    'area': 'bahagi',
    'severe': 'malala',
    'urgent': 'agaran',
    'please help': 'pakiusap tulungan',
    'and': 'at'
  };

  for (const [pattern, replacement] of Object.entries(replacements)) {
    const regex = new RegExp(`\\b${pattern}\\b`, 'gi');
    polished = polished.replace(regex, replacement);
  }

  polished = polished.replace(/\s+/g, ' ').trim();
  
  const sentences = polished.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s);
  const normalized = sentences.map(sentence => {
    if (!sentence) return '';
    let normalized = sentence.length > 1 
      ? sentence[0].toUpperCase() + sentence.slice(1)
      : sentence.toUpperCase();
    if (!'.!?'.includes(normalized[normalized.length - 1])) {
      normalized += '.';
    }
    return normalized;
  });

  return normalized.join(' ');
}

// Analyze multiple images
async function analyzeMultipleImages(files: File[]): Promise<any[]> {
  const results = [];

  for (const file of files) {
    try {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const basicDescription = await multiModelCaptionGeneration(buffer);
      const analysis = enhanceAnalysisWithContext(basicDescription);
      const expandedDescription = await expandDescriptionWithAI(basicDescription, analysis);
      const tagalogBasic = await translateToTagalog(basicDescription);
      const tagalogExpanded = await translateToTagalog(expandedDescription);
      const maintenanceReport = analyzer.generateMaintenanceReportTagalog(expandedDescription, analysis);

      results.push({
        success: true,
        filename: file.name,
        description: basicDescription,
        expanded_description: expandedDescription,
        tagalog_basic: tagalogBasic,
        tagalog_expanded: tagalogExpanded,
        analysis: analysis,
        maintenance_issue: expandedDescription,
        confidence_score: analysis.confidence === 'high' ? 90 : analysis.confidence === 'medium' ? 70 : 50,
        comprehensive_report: maintenanceReport,
        isMaintenanceRelated: analysis.isMaintenanceRelated
      });
    } catch (error) {
      console.error(`Error analyzing ${file.name}:`, error);
      results.push({
        success: false,
        filename: file.name,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  return results;
}

// POST endpoint
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No files provided' },
        { status: 400 }
      );
    }

    // Validate all files
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        return NextResponse.json(
          { success: false, error: `File ${file.name} must be an image` },
          { status: 400 }
        );
      }

      if (file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: `File ${file.name} size must be below 10MB` },
          { status: 400 }
        );
      }
    }

    console.log(`Analyzing ${files.length} images using TypeScript AI analysis...`);

    // Analyze all images
    const results = await analyzeMultipleImages(files);

    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error analyzing images:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to analyze images',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
