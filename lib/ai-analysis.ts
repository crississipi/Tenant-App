/**
 * Advanced Maintenance Analysis Utilities
 * Migrated from Python to TypeScript - Retains all logic and functionality
 */

interface MaintenanceKeywords {
  structural: string[];
  plumbing: string[];
  electrical: string[];
  safety: string[];
  problems: string[];
  severity: string[];
}

interface MaintenanceTemplates {
  high_priority: string[];
  medium_priority: string[];
  low_priority: string[];
}

interface Analysis {
  components: string[];
  problems: string[];
  severity_indicators: string[];
  confidence: string;
  risk_level: string;
  maintenance_priority: string;
  isMaintenanceRelated: boolean;
  contextual_analysis: string;
  locations: string[];
  severity_level?: string;
  priority_level?: string;
  estimated_time?: string;
}

interface CostEstimate {
  pagtataya: string;
  palihan: string;
  mga_salik: string;
  paalala: string;
}

interface MaintenanceReport {
  pangunahing_isyu: string;
  mga_alternatibong_paglalarawan: string[];
  detalyadong_analysis: Analysis;
  mga_rekomendasyon: string[];
  pagtataya_ng_gastos: CostEstimate;
  antas_ng_priyoridad: string;
  oras_ng_pagganap: string;
  materyales_na_kailangan: string[];
  babala_at_pag_iingat: string[];
  hakbang_sa_pag_aayos: string[];
}

export class AdvancedMaintenanceAnalyzer {
  private maintenanceKeywordsTagalog: MaintenanceKeywords;
  private maintenanceTemplatesTagalog: MaintenanceTemplates;

  constructor() {
    this.maintenanceKeywordsTagalog = {
      structural: [
        'pader', 'kisame', 'sahig', 'pundasyon', 'haligi', 'drywall', 'kongkreto',
        'estruktural', 'suporta', 'poste', 'balangkas', 'subfloor', 'tiles',
        'linoleum', 'karpet', 'baseboard', 'trim', 'molding'
      ],
      plumbing: [
        'tubo', 'tagas', 'gripo', 'lababo', 'kubeta', 'drain', 'tubig', 'balbula',
        'plumbing', 'alkantarilya', 'bentilasyon', 'supply line', 'drain line',
        'trapiko', 'shower', 'bathtub', 'water heater', 'garbage disposal'
      ],
      electrical: [
        'kawad', 'saksakan', 'switch', 'breaker', 'elektrikal', 'sirkito',
        'wiring', 'socket', 'fixture', 'panel', 'conduit', 'junction box',
        'ilaw', 'lampu', 'ceiling fan', 'kasangkapan'
      ],
      safety: [
        'delikado', 'panganib', 'aksidente', 'inspeksyon', 'kaligtasan',
        'emergency', 'sira', 'baklas', 'hazard', 'risgo'
      ],
      problems: [
        'sira', 'basag', 'nasira', 'tumutulo', 'mantsa', 'kalawang', 'amag',
        'bulok', 'luma', 'gastado', 'baluktot', 'humpy', 'kalas', 'natanggal',
        'nawawala', 'butas', 'bitak', 'bali', 'basag', 'hubdan', 'nakalantad'
      ],
      severity: [
        'malaki', 'malubha', 'seryoso', 'malawak', 'kritikal', 'agaran',
        'delikado', 'panganib', 'hindi ligtas', 'emergency', 'bagsak',
        'baha', 'apaw', 'sunog'
      ]
    };

    this.maintenanceTemplatesTagalog = {
      high_priority: [
        "AGARANG PAG-AYOS: {problems} sa {components} na matatagpuan sa {locations}. {severity_context}",
        "MATAAS NA PRIORIDAD: {problems} na nakita sa {components}. {severity_context}",
        "DELIKADONG KALAGAYAN: {components} ay may {problems}. Kailangan ng agarang aksyon."
      ],
      medium_priority: [
        "PAGPAPAHAYAG NG PAG-AYOS: {problems} sa {components} sa {locations}. {severity_context}",
        "Kailangan ng PAG-AYOS: {components} ay may {problems}. {severity_context}",
        "PAGKUKUMPUNI: {problems} na nakita sa {components}. Kailangan ng inspeksyon."
      ],
      low_priority: [
        "PANGKARANIWANG PAGMA-MAINTENANCE: {problems} sa {components}. {severity_context}",
        "PAGPAPANATILI: {components} ay nangangailangan ng pansin dahil sa {problems}.",
        "PAG-AYOS: {problems} na nakita sa {components}. Maaring isagawa sa susunod na maintenance."
      ]
    };
  }

  extractComponents(text: string): string[] {
    const components: string[] = [];
    const textLower = text.toLowerCase();

    for (const [category, keywords] of Object.entries(this.maintenanceKeywordsTagalog)) {
      for (const keyword of keywords) {
        if (textLower.includes(keyword)) {
          components.push(keyword);
        }
      }
    }

    return [...new Set(components)];
  }

  extractProblems(text: string): string[] {
    const problems: string[] = [];
    const textLower = text.toLowerCase();

    for (const keyword of this.maintenanceKeywordsTagalog.problems) {
      if (textLower.includes(keyword)) {
        problems.push(keyword);
      }
    }

    return [...new Set(problems)];
  }

  assessSeverity(text: string): string {
    const textLower = text.toLowerCase();
    const highSeverityWords = this.maintenanceKeywordsTagalog.severity.filter(
      word => textLower.includes(word)
    ).length;

    if (highSeverityWords >= 2) return 'mataas';
    if (highSeverityWords >= 1) return 'katamtaman';
    return 'mababa';
  }

  createDetailedIssueTagalog(description: string, analysis: Analysis): string {
    const components = analysis.components.join(', ');
    const problems = analysis.problems.join(', ');
    const locations = analysis.locations.join(', ');
    const severity = analysis.severity_level || 'katamtaman';

    const severityContextMap: Record<string, string> = {
      mataas: "Nangangailangan ng AGARANG atensyon dahil sa panganib na dulot",
      katamtaman: "Kailangan ng pansin sa lalong madaling panahon",
      mababa: "Maaring ayusin sa susunod na schedule ng maintenance"
    };

    const severityContext = severityContextMap[severity] || "Kailangan ng inspeksyon";
    
    const templates = this.maintenanceTemplatesTagalog[`${severity}_priority` as keyof MaintenanceTemplates] 
      || this.maintenanceTemplatesTagalog.medium_priority;

    const template = templates[0];
    
    return template
      .replace('{problems}', problems || 'isyu sa pagpapanatili')
      .replace('{components}', components || 'bahagi ng property')
      .replace('{locations}', locations || 'naobserbahang area')
      .replace('{severity_context}', severityContext);
  }

  generateRecommendationsTagalog(analysis: Analysis): string[] {
    const recommendations: string[] = [];

    if (analysis.severity_level === 'mataas') {
      recommendations.push(
        "✋ AGARANG HINTO: Huwag gamitin ang area hanggang maayos",
        "🚨 TAWAGAN ANG PROPERTY MANAGER: Para sa agarang aksyon",
        "⚠️ MAGLAGAY NG BABALA: Upang maiwasan ang aksidente"
      );
    }

    const components = analysis.components;
    if (components.some(comp => ['kawad', 'elektrikal', 'saksakan'].includes(comp))) {
      recommendations.push(
        "⚡ KONSULTA SA LICENSED ELECTRICIAN: Para sa electrical issues",
        "🔌 IWASAN ANG PAGGAMIT: Hanggang ma-inspeksyonan",
        "💡 PATAYIN ANG POWER: Sa affected area"
      );
    }

    if (components.some(comp => ['tubo', 'tubig', 'tagas'].includes(comp))) {
      recommendations.push(
        "💧 ISARA ANG WATER SUPPLY: Upang maiwasan ang karagdagang pinsala",
        "🔧 TAWAGAN ANG PLUMBER: Para sa water-related issues",
        "🧹 PUNASAN ANG TUBIG: Upang maiwasan ang mold"
      );
    }

    recommendations.push(
      "📸 KUMUHA NG MGA LARAWAN: Para sa dokumentasyon",
      "📝 MAGHANDA NG REPORT: Para sa insurance at records",
      "🛠️ SCHEDULE NG REPAIR: Sa lalong madaling panahon"
    );

    return recommendations;
  }

  estimateCostTagalog(analysis: Analysis): CostEstimate {
    const severity = analysis.severity_level || 'katamtaman';
    const components = analysis.components;

    const costRanges: Record<string, { min: number; max: number; currency: string }> = {
      mataas: { min: 5000, max: 50000, currency: 'PHP' },
      katamtaman: { min: 1000, max: 10000, currency: 'PHP' },
      mababa: { min: 200, max: 2000, currency: 'PHP' }
    };

    const baseCost = costRanges[severity] || costRanges.katamtaman;

    const componentMultipliers: Record<string, number> = {
      elektrikal: 1.5,
      plumbing: 1.2,
      estruktural: 2.0,
      kisame: 1.3,
      sahig: 1.1
    };

    let multiplier = 1.0;
    for (const comp of components) {
      multiplier = Math.max(multiplier, componentMultipliers[comp] || 1.0);
    }

    const estimatedMin = baseCost.min * multiplier;
    const estimatedMax = baseCost.max * multiplier;

    return {
      pagtataya: `₱${estimatedMin.toLocaleString('en-PH', { minimumFractionDigits: 0 })} - ₱${estimatedMax.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`,
      palihan: `${(baseCost.min * multiplier).toLocaleString('en-PH', { minimumFractionDigits: 0 })} - ${(baseCost.max * multiplier).toLocaleString('en-PH', { minimumFractionDigits: 0 })} PHP`,
      mga_salik: `Batay sa severity (${severity}) at mga components (${components.length})`,
      paalala: "Ang aktwal na gastos ay maaaring mag-iba batay sa assessment ng technician"
    };
  }

  requiredMaterialsTagalog(analysis: Analysis): string[] {
    const materials: string[] = [];
    const components = analysis.components;

    if (components.some(comp => ['tubo', 'plumbing'].includes(comp))) {
      materials.push('Tubo at mga fittings', 'Teflon tape', 'PVC cement');
    }

    if (components.some(comp => ['kawad', 'elektrikal'].includes(comp))) {
      materials.push('Electrical wire', 'Wire nuts', 'Electrical tape', 'Circuit breaker');
    }

    if (components.some(comp => ['pader', 'kisame'].includes(comp))) {
      materials.push('Drywall compound', 'Pintura', 'Sandpaper', 'Primer');
    }

    return materials;
  }

  safetyWarningsTagalog(analysis: Analysis): string[] {
    const warnings: string[] = [];
    const severity = analysis.severity_level || 'katamtaman';

    if (severity === 'mataas') {
      warnings.push(
        "🚨 DELIKADO: Huwag lapitan ang area",
        "⚠️ EMERGENCY: Tawagan kaagad ang property manager",
        "🔴 PRIORITY: Kailangang ayusin sa loob ng 24 oras"
      );
    }

    warnings.push(
      "👷 GUMAMIT NG PROTECTIVE GEAR sa inspection",
      "🔌 PATAYIN ANG POWER kung may electrical issue",
      "💧 ISARA ANG TUBIG kung may leak"
    );

    return warnings;
  }

  repairStepsTagalog(analysis: Analysis): string[] {
    return [
      "1. MAGHANDA NG MGA KASANGKAPAN at materyales",
      "2. SIGURADUHING LIGTAS ANG AREA bago magsimula",
      "3. KUNAN NG LARAWAN ang sira para sa dokumentasyon",
      "4. AYUSIN ANG PANGUNAHING ISYU una",
      "5. TESTING pagkatapos ng pag-aayos",
      "6. LINISIN ANG AREA pagkatapos",
      "7. FINAL INSPECTION bago ituring na tapos"
    ];
  }

  calculatePriority(analysis: Analysis): string {
    const severity = analysis.severity_level || 'mababa';
    const componentsCount = analysis.components.length;
    const problemsCount = analysis.problems.length;

    let priorityScore = 0;
    if (severity === 'mataas') priorityScore = 4;
    else if (severity === 'katamtaman') priorityScore = 2.5;
    else priorityScore = 1;

    priorityScore += Math.min(componentsCount, 3) * 0.5;
    priorityScore += Math.min(problemsCount, 3) * 0.5;

    if (priorityScore >= 4) return 'mataas';
    if (priorityScore >= 2.5) return 'katamtaman';
    return 'mababa';
  }

  estimateRepairTime(analysis: Analysis): string {
    const priority = analysis.priority_level || 'mababa';

    const timeEstimates: Record<string, string> = {
      mataas: "2-4 na oras (agarang pag-aayos)",
      katamtaman: "1-2 araw (sa loob ng linggo)",
      mababa: "1-2 linggo (sa susunod na schedule)"
    };

    return timeEstimates[priority] || "1-2 araw";
  }

  generateMaintenanceReportTagalog(description: string, analysis: Analysis): MaintenanceReport {
    const enhancedAnalysis = { ...analysis };
    enhancedAnalysis.priority_level = this.calculatePriority(enhancedAnalysis);
    enhancedAnalysis.estimated_time = this.estimateRepairTime(enhancedAnalysis);

    const primaryIssue = this.createDetailedIssueTagalog(description, enhancedAnalysis);

    return {
      pangunahing_isyu: primaryIssue,
      mga_alternatibong_paglalarawan: [
        this.createTechnicalIssueTagalog(enhancedAnalysis),
        this.createSimpleIssueTagalog(enhancedAnalysis),
        this.createUrgentIssueTagalog(enhancedAnalysis)
      ],
      detalyadong_analysis: enhancedAnalysis,
      mga_rekomendasyon: this.generateRecommendationsTagalog(enhancedAnalysis),
      pagtataya_ng_gastos: this.estimateCostTagalog(enhancedAnalysis),
      antas_ng_priyoridad: enhancedAnalysis.priority_level,
      oras_ng_pagganap: enhancedAnalysis.estimated_time,
      materyales_na_kailangan: this.requiredMaterialsTagalog(enhancedAnalysis),
      babala_at_pag_iingat: this.safetyWarningsTagalog(enhancedAnalysis),
      hakbang_sa_pag_aayos: this.repairStepsTagalog(enhancedAnalysis)
    };
  }

  createTechnicalIssueTagalog(analysis: Analysis): string {
    const components = analysis.components.join(', ');
    const problems = analysis.problems.join(', ');
    return `TECHNICAL REPORT: ${problems || 'isyu'} sa ${components || 'property'}. Severity: ${analysis.severity_level || 'katamtaman'}. Priority: ${analysis.priority_level || 'katamtaman'}`;
  }

  createSimpleIssueTagalog(analysis: Analysis): string {
    const problems = analysis.problems;
    const components = analysis.components;
    return `Kailangan ayusin: ${problems.join(', ') || 'isyu'} sa ${components.join(', ') || 'property'}`;
  }

  createUrgentIssueTagalog(analysis: Analysis): string {
    const problems = analysis.problems;
    return `AGARANG PAG-AYOS: ${problems.join(', ') || 'isyu sa pagpapanatili'} - ${analysis.severity_level || 'katamtaman'} na panganib`;
  }
}

// Helper Functions

export function enhanceAnalysisWithContext(description: string): Analysis {
  const maintenancePatterns: Record<string, string[]> = {
    structural: ['wall', 'ceiling', 'floor', 'foundation', 'beam', 'drywall', 'door', 'doorknob', 'knob', 'handle'],
    plumbing: ['pipe', 'leak', 'faucet', 'sink', 'toilet', 'drain', 'water', 'exposed', 'plumbing'],
    electrical: ['wire', 'outlet', 'switch', 'breaker', 'electrical', 'circuit', 'wiring'],
    problems: ['broken', 'cracked', 'damaged', 'leaking', 'stained', 'corroded', 'old', 'dilapidated', 'worn', 'exposed', 'missing', 'hole', 'deteriorated', 'rusted', 'peeling'],
    severity: ['large', 'major', 'severe', 'significant', 'extensive', 'serious', 'bad', 'poor']
  };

  const analysis: Analysis = {
    components: [],
    problems: [],
    severity_indicators: [],
    confidence: 'low',
    risk_level: 'low',
    maintenance_priority: 'low',
    isMaintenanceRelated: false,
    contextual_analysis: '',
    locations: []
  };

  const descriptionLower = description.toLowerCase();

  for (const [category, keywords] of Object.entries(maintenancePatterns)) {
    const found = keywords.filter(kw => descriptionLower.includes(kw));
    if (found.length > 0) {
      if (category === 'problems') {
        analysis.problems.push(...found);
      } else if (category === 'severity') {
        analysis.severity_indicators.push(...found);
      } else {
        analysis.components.push(...found);
      }
    }
  }

  analysis.components = [...new Set(analysis.components)];
  analysis.problems = [...new Set(analysis.problems)];
  analysis.severity_indicators = [...new Set(analysis.severity_indicators)];

  const score = analysis.components.length * 2 + analysis.problems.length * 3 + analysis.severity_indicators.length * 2;

  if (score >= 6) {
    analysis.confidence = 'high';
    analysis.risk_level = 'high';
    analysis.maintenance_priority = 'urgent';
    analysis.severity_level = 'mataas';
  } else if (score >= 3) {
    analysis.confidence = 'medium';
    analysis.risk_level = 'medium';
    analysis.maintenance_priority = 'medium';
    analysis.severity_level = 'katamtaman';
  } else if (score >= 1) {
    analysis.confidence = 'medium';
    analysis.risk_level = 'low';
    analysis.maintenance_priority = 'low';
    analysis.severity_level = 'mababa';
  } else {
    analysis.severity_level = 'mababa';
  }

  analysis.isMaintenanceRelated = analysis.problems.length > 0 || analysis.components.length > 0;
  analysis.contextual_analysis = `Found ${analysis.problems.length} issues affecting ${analysis.components.length} components`;

  return analysis;
}

export function enhanceBasicDescription(description: string): string {
  const result = description.toLowerCase();

  const patterns: Record<string, string> = {
    '(crack|cracks|cracking)': 'Structural cracking detected requiring repair',
    '(leak|leaking|water leak)': 'Water leakage issue identified requiring immediate attention',
    '(stain|stains|discolor|discoloration)': 'Staining and discoloration observed indicating water damage or deterioration',
    '(damage|damaged|damaging)': 'Property damage requiring professional repair',
    '(broken|break|breaking)': 'Structural failure detected requiring immediate repair',
    '(mold|mildew|fungus)': 'Moisture-related biological growth present requiring remediation',
    '(rust|rusted|corros|corroded)': 'Metal corrosion and deterioration observed requiring treatment',
    '(hole|holes)': 'Structural breach requiring patching and repair',
    '(loose|detach|detached)': 'Loose or detached component requiring reattachment',
    '(peel|peeling)': 'Surface degradation and peeling requiring refinishing',
    '(old|worn|aged|deteriorate|dilapidate)': 'Deterioration due to age requiring replacement or restoration',
    '(expose|exposed)': 'Exposed components creating safety hazard requiring cover or repair',
    '(door|doorknob|knob|handle).*?(broken|old|damage|worn|missing)': 'Door hardware failure requiring replacement',
    '(broken|damage|old).*?(door|doorknob|knob|handle)': 'Door hardware failure requiring replacement',
    '(floor|flooring).*?(broken|damage|crack|hole|expose|pipe)': 'Flooring damage with exposed infrastructure requiring immediate repair',
    '(pipe|plumbing).*?(expose|leak|break|damage)': 'Plumbing system damage requiring immediate attention',
    '(expose|visible).*?(pipe|plumbing|wire)': 'Exposed infrastructure creating safety concern',
    '(poor|bad).*?(condition|state)': 'Poor condition requiring maintenance work'
  };

  for (const [pattern, replacement] of Object.entries(patterns)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(result)) {
      return replacement;
    }
  }

  if (result.trim().length > 5) {
    return "Property maintenance issue identified requiring professional assessment and repair";
  }

  return "Property condition requiring inspection and maintenance evaluation";
}

export function ruleBasedSummarization(text: string): string {
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s);

  if (sentences.length <= 3) {
    return text;
  }

  const summarySentences = sentences.slice(0, Math.min(3, sentences.length));
  let summary = summarySentences.join('. ') + '.';

  if (summary.length > 200) {
    summary = summary.substring(0, 197) + '...';
  }

  return summary;
}

export function ruleBasedUrgencyClassification(text: string): number {
  const textLower = text.toLowerCase();

  const criticalKeywords = [
    'gas leak', 'electrical spark', 'fire', 'flood', 'no power',
    'broken window', 'no lock', 'no heat', 'no water', 'raw sewage',
    'exposed wire', 'structural collapse', 'flooding', 'sparking',
    'smoke', 'burning', 'short circuit', 'electrocution', 'emergency'
  ];

  const highKeywords = [
    'leak', 'electrical', 'not working', 'broken', 'clog', 'overflow',
    'pest', 'mold', 'no hot water', 'water damage', 'exposed pipe',
    'major', 'severe', 'serious', 'extensive', 'flood', 'burst'
  ];

  const mediumKeywords = [
    'slow', 'drip', 'minor', 'cosmetic', 'paint', 'scratch',
    'loose', 'stain', 'sticking', 'noisy', 'peeling', 'small',
    'squeak', 'stuck', 'difficult'
  ];

  if (criticalKeywords.some(keyword => textLower.includes(keyword))) {
    return 4;
  }

  if (highKeywords.some(keyword => textLower.includes(keyword))) {
    return 3;
  }

  if (mediumKeywords.some(keyword => textLower.includes(keyword))) {
    return 2;
  }

  return 2;
}

export async function queryHuggingFaceAPI(
  imageData: Buffer | string,
  apiUrl: string,
  hfToken: string
): Promise<any> {
  try {
    const requestHeaders: Record<string, string> = {
      'Authorization': `Bearer ${hfToken}`
    };

    let requestBody: BodyInit;

    if (typeof imageData === 'string') {
      requestHeaders['Content-Type'] = 'application/json';
      requestBody = imageData;
    } else {
      requestHeaders['Content-Type'] = 'application/octet-stream';
      // Create a new ArrayBuffer copy from the Buffer data
      const uint8Array = new Uint8Array(imageData);
      requestBody = uint8Array.buffer as ArrayBuffer;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: requestBody
    });

    if (!response.ok) {
      throw new Error(`HF API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error calling Hugging Face API:', error);
    throw error;
  }
}

export function cleanGeneratedText(text: string): string {
  let cleaned = text.replace(/^(Description:|Here's|Here is|The description is:)\s*/i, '');
  cleaned = cleaned.replace(/\n+/g, ' ');
  cleaned = cleaned.trim();

  if (cleaned && !'.!?'.includes(cleaned[cleaned.length - 1])) {
    cleaned += '.';
  }

  return cleaned;
}

export function ruleBasedTagalogTranslation(text: string): string {
  const translations: Record<string, string> = {
    'crack': 'may bitak',
    'cracking': 'bumibitak',
    'leak': 'may tagas',
    'leaking': 'tumatagas',
    'damage': 'nasira',
    'damaged': 'sira',
    'broken': 'basag',
    'stain': 'mantsa',
    'staining': 'namimintana',
    'rust': 'kalawang',
    'corrosion': 'kinakalawang',
    'mold': 'amag',
    'hole': 'butas',
    'peeling': 'nakakalpak',
    'deterioration': 'luma na',
    'failure': 'nasira',
    'wall': 'pader',
    'ceiling': 'kisame',
    'floor': 'sahig',
    'pipe': 'tubo',
    'plumbing': 'tubo ng tubig',
    'electrical': 'kuryente',
    'wire': 'kawad',
    'wiring': 'mga kawad',
    'outlet': 'saksakan',
    'toilet': 'kubeta',
    'sink': 'lababo',
    'faucet': 'gripo',
    'severe': 'malala',
    'serious': 'seryoso',
    'major': 'malaki',
    'repair': 'kumpunihin',
    'fix': 'ayusin',
    'replace': 'palitan',
    'inspect': 'tingnan',
    'inspection': 'pagsusuri',
    'maintenance': 'pag-aayos',
    'attention': 'ating pansin',
    'immediate': 'kaagad',
    'urgent': 'madalian',
    'requires': 'kailangan',
    'requiring': 'nangangailangan',
    'observed': 'napansin',
    'detected': 'nakita',
    'identified': 'natukoy',
    'issue': 'problema',
    'problem': 'sira',
    'property': 'bahay',
    'water': 'tubig'
  };

  let translated = text;

  const phraseReplacements: Record<string, string> = {
    'maintenance issue': 'problema sa bahay',
    'requires attention': 'kailangan ng atensyon',
    'needs repair': 'kailangan ayusin',
    'professional assessment': 'tingnan ng eksperto',
    'water damage': 'sira mula sa tubig',
    'structural damage': 'sira sa istruktura',
    'electrical problem': 'problema sa kuryente',
    'plumbing issue': 'problema sa tubig',
    'safety hazard': 'delikado',
    'immediate action': 'kaagad na aksyon',
    'property maintenance': 'pag-aayos ng bahay'
  };

  for (const [english, tagalog] of Object.entries(phraseReplacements)) {
    const regex = new RegExp(`\\b${english}\\b`, 'gi');
    translated = translated.replace(regex, tagalog);
  }

  for (const [english, tagalog] of Object.entries(translations)) {
    const regex = new RegExp(`\\b${english}\\b`, 'gi');
    translated = translated.replace(regex, tagalog);
  }

  return translated;
}
