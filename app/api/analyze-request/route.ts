import { NextRequest, NextResponse } from "next/server";
import { 
  AdvancedMaintenanceAnalyzer, 
  enhanceAnalysisWithContext,
  ruleBasedSummarization,
  ruleBasedUrgencyClassification,
  queryHuggingFaceAPI,
  cleanGeneratedText
} from '@/lib/ai-analysis';

const HF_TOKEN = process.env.HF_API_KEY;
const analyzer = new AdvancedMaintenanceAnalyzer();

// AI-powered summarization
async function summarizeRequestWithAI(text: string): Promise<string> {
  try {
    // Try Hugging Face first
    if (HF_TOKEN) {
      const prompt = `Summarize this maintenance request into a clear, concise description (2-3 sentences):

"${text}"

Summary:`;

      const response = await queryHuggingFaceAPI(
        JSON.stringify({ 
          inputs: prompt,
          parameters: {
            max_new_tokens: 150,
            temperature: 0.7,
            top_p: 0.9,
            do_sample: true,
            return_full_text: false
          }
        }),
        "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1",
        HF_TOKEN
      );

      if (response && Array.isArray(response) && response[0]?.generated_text) {
        const summary = cleanGeneratedText(response[0].generated_text.replace(prompt, ''));
        if (summary && summary.length > 20) {
          return summary;
        }
      }
    }

    // Fallback to rule-based
    return ruleBasedSummarization(text);
  } catch (error) {
    console.warn('AI summarization failed:', error);
    return ruleBasedSummarization(text);
  }
}

// AI-powered urgency classification
async function classifyUrgencyWithAI(text: string): Promise<number> {
  try {
    // Try Hugging Face first
    if (HF_TOKEN) {
      const prompt = `Analyze this maintenance request and classify its urgency level:
1 - Low (cosmetic, non-urgent)
2 - Medium (should be addressed soon)
3 - High (requires prompt attention)
4 - Critical (emergency, safety hazard)

Request: "${text}"

Respond with ONLY the number (1, 2, 3, or 4):`;

      const response = await queryHuggingFaceAPI(
        JSON.stringify({ 
          inputs: prompt,
          parameters: {
            max_new_tokens: 10,
            temperature: 0.3,
            do_sample: false,
            return_full_text: false
          }
        }),
        "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1",
        HF_TOKEN
      );

      if (response && Array.isArray(response) && response[0]?.generated_text) {
        const result = response[0].generated_text.trim();
        const urgencyLevel = parseInt(result.match(/[1-4]/)?.[0] || '2');
        if (urgencyLevel >= 1 && urgencyLevel <= 4) {
          return urgencyLevel;
        }
      }
    }

    // Fallback to rule-based
    return ruleBasedUrgencyClassification(text);
  } catch (error) {
    console.warn('AI urgency classification failed:', error);
    return ruleBasedUrgencyClassification(text);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = body.title || '';
    const userDescription = body.userDescription || body.userText || '';
    const imageAnalysis = body.imageAnalysis || null;
    const frontendAiAnalysis = body.frontendAiAnalysis || null;

    // Combine all text for analysis
    let combinedText = title ? `${title}: ${userDescription}` : userDescription;
    
    // Add image analysis descriptions if available
    if (imageAnalysis?.descriptions?.length > 0) {
      combinedText += ' ' + imageAnalysis.descriptions.join(' ');
    }

    if (!combinedText.trim()) {
      return NextResponse.json(
        { message: "No content provided" }, 
        { status: 400 }
      );
    }

    console.log('Analyzing request:', combinedText);

    // Perform summarization and urgency classification
    const summary = await summarizeRequestWithAI(combinedText);
    const urgencyLevel = await classifyUrgencyWithAI(combinedText);

    // Perform context analysis
    const analysis = enhanceAnalysisWithContext(combinedText);

    // Generate comprehensive analysis
    const urgencyMap: Record<number, string> = {
      1: "Low",
      2: "Medium",
      3: "High",
      4: "Critical"
    };

    const comprehensiveReport = analyzer.generateMaintenanceReportTagalog(summary, analysis);

    const comprehensiveAnalysis = {
      summary,
      urgency_level: urgencyLevel,
      urgency_text: urgencyMap[urgencyLevel] || "Medium",
      components_identified: analysis.components,
      problems_detected: analysis.problems,
      severity_assessment: analysis.severity_level || 'mababa',
      risk_level: analysis.risk_level,
      maintenance_priority: analysis.maintenance_priority,
      comprehensive_report: comprehensiveReport,
      confidence_score: analysis.confidence
    };

    return NextResponse.json({
      success: true,
      summary,
      urgencyLevel,
      comprehensiveAnalysis,
      timestamp: new Date().toISOString()
    });
    
  } catch (err: any) {
    console.error("Error analyzing request:", err);
    
    // Fallback processing
    try {
      const body = await req.json();
      const userText = body.userDescription || body.userText || '';
      const imageDescriptions = body.imageAnalysis?.descriptions || [];
      const fallbackSummary = userText || imageDescriptions?.join(" ") || "Maintenance request";
      const fallbackUrgency = ruleBasedUrgencyClassification(fallbackSummary);
      
      return NextResponse.json({ 
        success: true,
        summary: fallbackSummary,
        urgencyLevel: fallbackUrgency,
        comprehensiveAnalysis: {
          summary: fallbackSummary,
          urgency_level: fallbackUrgency,
          urgency_text: ["Low", "Medium", "High", "Critical"][fallbackUrgency - 1],
          components_identified: [],
          problems_detected: [],
          severity_assessment: 'mababa',
          risk_level: 'low',
          maintenance_priority: 'low',
          confidence_score: 'low',
          fallback_used: true
        },
        fallback: true,
        timestamp: new Date().toISOString()
      });
    } catch (fallbackError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to analyze request',
          details: err.message
        },
        { status: 500 }
      );
    }
  }
}