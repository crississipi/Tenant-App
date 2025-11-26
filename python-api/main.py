from fastapi import FastAPI, File, UploadFile, HTTPException, Body, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import uvicorn
from PIL import Image, ImageEnhance, ImageFilter
import io
import torch
import torch.nn.functional as F
from transformers import (
    BlipProcessor, BlipForConditionalGeneration, 
    Blip2Processor, Blip2ForConditionalGeneration,
    AutoProcessor, AutoModelForCausalLM,
    pipeline,
    AutoTokenizer,
    AutoModelForSequenceClassification
)
import logging
import os
import requests
import re
from dotenv import load_dotenv
from typing import List, Dict, Any, Optional
import json
from datetime import datetime
import hashlib
import base64
import numpy as np
from scipy import spatial
import cv2
import asyncio
from concurrent.futures import ThreadPoolExecutor
import aiohttp

# Load environment variables
load_dotenv()

# Enhanced logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    handlers=[
        logging.FileHandler('advanced_maintenance_api.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Global variables for multiple models
processor_blip = None
model_blip = None
processor_blip2 = None
model_blip2 = None
maintenance_classifier = None
damage_detector = None
safety_assessor = None
cost_estimator = None
HF_TOKEN = os.getenv("HF_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Hugging Face API URLs
BLIP_LARGE_URL = "https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large"
BLIP2_URL = "https://api-inference.huggingface.co/models/Salesforce/blip2-opt-2.7b"
LLAMA_URL = "https://api-inference.huggingface.co/models/meta-llama/Llama-2-7b-chat-hf"
MAINTENANCE_CLASSIFIER_URL = "https://api-inference.huggingface.co/models/course5ai/maintenance-classifier"

class AdvancedMaintenanceAnalyzer:
    """Advanced analyzer for maintenance content generation"""
    
    def __init__(self):
        self.maintenance_keywords_tagalog = {
            'structural': [
                'pader', 'kisame', 'sahig', 'pundasyon', 'haligi', 'drywall', 'kongkreto',
                'estruktural', 'suporta', 'poste', 'balangkas', 'subfloor', 'tiles',
                'linoleum', 'karpet', 'baseboard', 'trim', 'molding'
            ],
            'plumbing': [
                'tubo', 'tagas', 'gripo', 'lababo', 'kubeta', 'drain', 'tubig', 'balbula',
                'plumbing', 'alkantarilya', 'bentilasyon', 'supply line', 'drain line',
                'trapiko', 'shower', 'bathtub', 'water heater', 'garbage disposal'
            ],
            'electrical': [
                'kawad', 'saksakan', 'switch', 'breaker', 'elektrikal', 'sirkito',
                'wiring', 'socket', 'fixture', 'panel', 'conduit', 'junction box',
                'ilaw', 'lampu', 'ceiling fan', 'kasangkapan'
            ],
            'safety': [
                'delikado', 'panganib', 'aksidente', 'inspeksyon', 'kaligtasan',
                'emergency', 'sira', 'baklas', 'hazard', 'risgo'
            ],
            'problems': [
                'sira', 'basag', 'nasira', 'tumutulo', 'mantsa', 'kalawang', 'amag',
                'bulok', 'luma', 'gastado', 'baluktot', 'humpy', 'kalas', 'natanggal',
                'nawawala', 'butas', 'bitak', 'bali', 'basag', 'hubdan', 'nakalantad'
            ],
            'severity': [
                'malaki', 'malubha', 'seryoso', 'malawak', 'kritikal', 'agaran',
                'delikado', 'panganib', 'hindi ligtas', 'emergency', 'bagsak',
                'baha', 'apaw', 'sunog'
            ]
        }
        
        self.maintenance_templates_tagalog = {
            'high_priority': [
                "AGARANG PAG-AYOS: {problems} sa {components} na matatagpuan sa {locations}. {severity_context}",
                "MATAAS NA PRIORIDAD: {problems} na nakita sa {components}. {severity_context}",
                "DELIKADONG KALAGAYAN: {components} ay may {problems}. Kailangan ng agarang aksyon."
            ],
            'medium_priority': [
                "PAGPAPAHAYAG NG PAG-AYOS: {problems} sa {components} sa {locations}. {severity_context}",
                "Kailangan ng PAG-AYOS: {components} ay may {problems}. {severity_context}",
                "PAGKUKUMPUNI: {problems} na nakita sa {components}. Kailangan ng inspeksyon."
            ],
            'low_priority': [
                "PANGKARANIWANG PAGMA-MAINTENANCE: {problems} sa {components}. {severity_context}",
                "PAGPAPANATILI: {components} ay nangangailangan ng pansin dahil sa {problems}.",
                "PAG-AYOS: {problems} na nakita sa {components}. Maaring isagawa sa susunod na maintenance."
            ]
        }

    def generate_maintenance_report_tagalog(self, description: str, analysis: Dict) -> Dict[str, Any]:
        """Generate comprehensive maintenance report in Tagalog"""
        
        # Enhanced analysis with multiple model approaches
        enhanced_analysis = self.enhance_analysis_with_ai(description, analysis)
        
        # Generate multiple versions of maintenance issues
        maintenance_issues = self.generate_multiple_maintenance_issues(description, enhanced_analysis)
        
        # Create comprehensive report
        report = {
            "pangunahing_isyu": maintenance_issues["primary"],
            "mga_alternatibong_paglalarawan": maintenance_issues["alternatives"],
            "detalyadong_analysis": enhanced_analysis,
            "mga_rekomendasyon": self.generate_recommendations_tagalog(enhanced_analysis),
            "pagtataya_ng_gastos": self.estimate_cost_tagalog(enhanced_analysis),
            "antas_ng_priyoridad": enhanced_analysis["priority_level"],
            "oras_ng_pagganap": enhanced_analysis["estimated_time"],
            "materyales_na_kailangan": self.required_materials_tagalog(enhanced_analysis),
            "babala_at_pag-iingat": self.safety_warnings_tagalog(enhanced_analysis),
            "hakbang_sa_pag-aayos": self.repair_steps_tagalog(enhanced_analysis)
        }
        
        return report

    def enhance_analysis_with_ai(self, description: str, basic_analysis: Dict) -> Dict[str, Any]:
        """Enhance analysis using multiple AI approaches"""
        
        # Multi-model analysis
        analysis_results = []
        
        # Approach 1: BLIP-based analysis
        analysis_results.append(self.analyze_with_blip_context(description))
        
        # Approach 2: Rule-based enhancement
        analysis_results.append(self.rule_based_enhancement(description))
        
        # Combine all analyses
        combined_analysis = self.combine_analyses(analysis_results, basic_analysis)
        
        return combined_analysis

    def analyze_with_blip_context(self, description: str) -> Dict[str, Any]:
        """Enhanced analysis using BLIP context understanding"""
        
        # Use multiple prompts for different aspects
        prompts = [
            "Maintenance issue: damage repair problem",
            "Property inspection: structural plumbing electrical",
            "Safety hazard: risk danger emergency",
            "Building defect: crack leak break"
        ]
        
        analyses = []
        for prompt in prompts:
            try:
                enhanced_input = f"{prompt}: {description}"
                # This would typically use the BLIP model with different prompts
                analysis = self.simulate_blip_analysis(enhanced_input)
                analyses.append(analysis)
            except Exception as e:
                logger.warning(f"BLIP analysis with prompt '{prompt}' failed: {e}")
        
        return self.merge_blip_analyses(analyses)

    def simulate_blip_analysis(self, text: str) -> Dict[str, Any]:
        """Simulate enhanced BLIP analysis (replace with actual model calls)"""
        
        # This is a simulation - replace with actual BLIP model calls
        return {
            "components": self.extract_components(text),
            "problems": self.extract_problems(text),
            "severity": self.assess_severity(text),
            "context": f"Analysis of: {text}"
        }

    def generate_multiple_maintenance_issues(self, description: str, analysis: Dict) -> Dict[str, Any]:
        """Generate multiple versions of maintenance issues using different approaches"""
        
        issues = {
            "primary": "",
            "alternatives": [],
            "technical": "",
            "simple": ""
        }
        
        # Primary issue (most detailed)
        issues["primary"] = self.create_detailed_issue_tagalog(description, analysis)
        
        # Alternative versions
        issues["alternatives"].append(self.create_technical_issue_tagalog(analysis))
        issues["alternatives"].append(self.create_simple_issue_tagalog(analysis))
        issues["alternatives"].append(self.create_urgent_issue_tagalog(analysis))
        
        # Technical version
        issues["technical"] = self.create_technical_report_tagalog(analysis)
        
        # Simple version
        issues["simple"] = self.create_simple_description_tagalog(analysis)
        
        return issues

    def create_detailed_issue_tagalog(self, description: str, analysis: Dict) -> str:
        """Create detailed maintenance issue in Tagalog"""
        
        components = ", ".join(analysis.get("components", []))
        problems = ", ".join(analysis.get("problems", []))
        locations = ", ".join(analysis.get("locations", []))
        severity = analysis.get("severity_level", "katamtaman")
        
        severity_context = {
            "mataas": "Nangangailangan ng AGARANG atensyon dahil sa panganib na dulot",
            "katamtaman": "Kailangan ng pansin sa lalong madaling panahon",
            "mababa": "Maaring ayusin sa susunod na schedule ng maintenance"
        }.get(severity, "Kailangan ng inspeksyon")
        
        template = self.maintenance_templates_tagalog.get(
            f"{severity}_priority", 
            self.maintenance_templates_tagalog['medium_priority']
        )[0]
        
        issue = template.format(
            problems=problems if problems else "isyu sa pagpapanatili",
            components=components if components else "bahagi ng property",
            locations=locations if locations else "naobserbahang area",
            severity_context=severity_context
        )
        
        return issue

    def generate_recommendations_tagalog(self, analysis: Dict) -> List[str]:
        """Generate maintenance recommendations in Tagalog"""
        
        recommendations = []
        
        # Safety first recommendations
        if analysis.get("severity_level") == "mataas":
            recommendations.extend([
                "✋ AGARANG HINTO: Huwag gamitin ang area hanggang maayos",
                "🚨 TAWAGAN ANG PROPERTY MANAGER: Para sa agarang aksyon",
                "⚠️ MAGLAGAY NG BABALA: Upang maiwasan ang aksidente"
            ])
        
        # Component-specific recommendations
        components = analysis.get("components", [])
        if any(comp in ['kawad', 'elektrikal', 'saksakan'] for comp in components):
            recommendations.extend([
                "⚡ KONSULTA SA LICENSED ELECTRICIAN: Para sa electrical issues",
                "🔌 IWASAN ANG PAGGAMIT: Hanggang ma-inspeksyonan",
                "💡 PATAYIN ANG POWER: Sa affected area"
            ])
        
        if any(comp in ['tubo', 'tubig', 'tagas'] for comp in components):
            recommendations.extend([
                "💧 ISARA ANG MAIN WATER VALVE: Kung may malaking tagas",
                "🛠️ TAWAGAN ANG PLUMBER: Para sa plumbing issues",
                "🪣 MAGHANDA NG PANALO: Para sa mga tagas"
            ])
        
        # General recommendations
        recommendations.extend([
            "📸 KUMUHA NG MGA LARAWAN: Para sa dokumentasyon",
            "📝 MAGHANDA NG REPORT: Para sa insurance at records",
            "🛠️ SCHEDULE NG REPAIR: Sa lalong madaling panahon"
        ])
        
        return recommendations

    def estimate_cost_tagalog(self, analysis: Dict) -> Dict[str, Any]:
        """Estimate repair costs in Tagalog"""
        
        severity = analysis.get("severity_level", "katamtaman")
        components = analysis.get("components", [])
        
        cost_ranges = {
            "mataas": {"min": 5000, "max": 50000, "currency": "PHP"},
            "katamtaman": {"min": 1000, "max": 10000, "currency": "PHP"},
            "mababa": {"min": 200, "max": 2000, "currency": "PHP"}
        }
        
        base_cost = cost_ranges.get(severity, cost_ranges["katamtaman"])
        
        # Adjust based on components
        component_multipliers = {
            'elektrikal': 1.5,
            'plumbing': 1.2,
            'estruktural': 2.0,
            'kisame': 1.3,
            'sahig': 1.1
        }
        
        multiplier = 1.0
        for comp in components:
            multiplier *= component_multipliers.get(comp, 1.0)
        
        estimated_min = base_cost["min"] * multiplier
        estimated_max = base_cost["max"] * multiplier
        
        return {
            "pagtataya": f"₱{estimated_min:,.0f} - ₱{estimated_max:,.0f}",
            "palihan": f"{base_cost['min'] * multiplier:,.0f} - {base_cost['max'] * multiplier:,.0f} PHP",
            "mga_salik": f"Batay sa severity ({severity}) at mga components ({len(components)})",
            "paalala": "Ang aktwal na gastos ay maaaring mag-iba batay sa assessment ng technician"
        }

    def required_materials_tagalog(self, analysis: Dict) -> List[str]:
        """List required materials in Tagalog"""
        
        materials = []
        components = analysis.get("components", [])
        
        if any(comp in ['tubo', 'plumbing'] for comp in components):
            materials.extend(["PVC pipes", "pipe fittings", "plumber's tape", "sealant"])
        
        if any(comp in ['kawad', 'elektrikal'] for comp in components):
            materials.extend(["electrical wires", "outlets", "circuit breakers", "conduit"])
        
        if any(comp in ['pader', 'kisame'] for comp in components):
            materials.extend(["drywall", "joint compound", "paint", "primer"])
        
        # Translate to Tagalog
        tagalog_materials = []
        for material in materials:
            tagalog_materials.append(f"{material} (kailangan sa pag-aayos)")
        
        return tagalog_materials

    def safety_warnings_tagalog(self, analysis: Dict) -> List[str]:
        """Generate safety warnings in Tagalog"""
        
        warnings = []
        severity = analysis.get("severity_level", "katamtaman")
        
        if severity == "mataas":
            warnings.extend([
                "⚠️ HINDI LIGTAS ANG AREA - Bawal pumasok",
                "🚨 AGARANG EBAKUASYON kung may panganib",
                "📞 TAWAGAN ANG EMERGENCY SERVICES kung kinakailangan"
            ])
        
        warnings.extend([
            "👷 GUMAMIT NG PROTECTIVE GEAR sa inspection",
            "🔌 PATAYIN ANG POWER kung may electrical issue",
            "💧 ISARA ANG TUBIG kung may leak"
        ])
        
        return warnings

    def repair_steps_tagalog(self, analysis: Dict) -> List[str]:
        """Generate repair steps in Tagalog"""
        
        steps = [
            "1. MAGHANDA NG MGA KASANGKAPAN at materyales",
            "2. SIGURADUHING LIGTAS ANG AREA bago magsimula",
            "3. KUNAN NG LARAWAN ang sira para sa dokumentasyon",
            "4. AYUSIN ANG PANGUNAHING ISYU una",
            "5. TESTING pagkatapos ng pag-aayos",
            "6. LINISIN ANG AREA pagkatapos",
            "7. FINAL INSPECTION bago ituring na tapos"
        ]
        
        return steps

    # Helper methods
    def extract_components(self, text: str) -> List[str]:
        """Extract components from text"""
        components = []
        text_lower = text.lower()
        
        for category, keywords in self.maintenance_keywords_tagalog.items():
            if category in ['structural', 'plumbing', 'electrical']:
                for keyword in keywords:
                    if keyword in text_lower:
                        components.append(keyword)
        
        return list(set(components))

    def extract_problems(self, text: str) -> List[str]:
        """Extract problems from text"""
        problems = []
        text_lower = text.lower()
        
        for keyword in self.maintenance_keywords_tagalog['problems']:
            if keyword in text_lower:
                problems.append(keyword)
        
        return list(set(problems))

    def assess_severity(self, text: str) -> str:
        """Assess severity level"""
        text_lower = text.lower()
        
        high_severity_words = sum(1 for word in self.maintenance_keywords_tagalog['severity'] if word in text_lower)
        
        if high_severity_words >= 2:
            return "mataas"
        elif high_severity_words >= 1:
            return "katamtaman"
        else:
            return "mababa"

    def rule_based_enhancement(self, description: str) -> Dict[str, Any]:
        """Rule-based analysis enhancement"""
        return {
            "components": self.extract_components(description),
            "problems": self.extract_problems(description),
            "severity_level": self.assess_severity(description),
            "confidence": "mataas" if len(description.split()) > 10 else "katamtaman"
        }

    def combine_analyses(self, analyses: List[Dict], basic_analysis: Dict) -> Dict[str, Any]:
        """Combine multiple analyses into one comprehensive result"""
        
        combined = basic_analysis.copy()
        
        for analysis in analyses:
            combined.update(analysis)
        
        # Calculate overall priority
        combined["priority_level"] = self.calculate_priority(combined)
        combined["estimated_time"] = self.estimate_repair_time(combined)
        
        return combined

    def calculate_priority(self, analysis: Dict) -> str:
        """Calculate overall priority level"""
        severity = analysis.get("severity_level", "mababa")
        components_count = len(analysis.get("components", []))
        problems_count = len(analysis.get("problems", []))
        
        priority_score = 0
        if severity == "mataas":
            priority_score += 3
        elif severity == "katamtaman":
            priority_score += 2
        else:
            priority_score += 1
            
        priority_score += min(components_count, 3) * 0.5
        priority_score += min(problems_count, 3) * 0.5
        
        if priority_score >= 4:
            return "mataas"
        elif priority_score >= 2.5:
            return "katamtaman"
        else:
            return "mababa"

    def estimate_repair_time(self, analysis: Dict) -> str:
        """Estimate repair time"""
        priority = analysis.get("priority_level", "mababa")
        
        time_estimates = {
            "mataas": "2-4 na oras (agarang pag-aayos)",
            "katamtaman": "1-2 araw (sa loob ng linggo)",
            "mababa": "1-2 linggo (sa susunod na schedule)"
        }
        
        return time_estimates.get(priority, "1-2 araw")

    def create_technical_issue_tagalog(self, analysis: Dict) -> str:
        """Create technical version of maintenance issue"""
        components = ", ".join(analysis.get("components", []))
        problems = ", ".join(analysis.get("problems", []))
        
        return f"TECHNICAL REPORT: {problems if problems else 'isyu'} sa {components if components else 'property'}. Severity: {analysis.get('severity_level', 'katamtaman')}. Priority: {analysis.get('priority_level', 'katamtaman')}"

    def create_simple_issue_tagalog(self, analysis: Dict) -> str:
        """Create simple version of maintenance issue"""
        problems = analysis.get('problems', [])
        components = analysis.get('components', [])
        return f"Kailangan ayusin: {', '.join(problems) if problems else 'isyu'} sa {', '.join(components) if components else 'property'}"

    def create_urgent_issue_tagalog(self, analysis: Dict) -> str:
        """Create urgent version of maintenance issue"""
        problems = analysis.get('problems', [])
        return f"AGARANG PAG-AYOS: {', '.join(problems) if problems else 'isyu sa pagpapanatili'} - {analysis.get('severity_level', 'katamtaman')} na panganib"

    def create_technical_report_tagalog(self, analysis: Dict) -> str:
        """Create comprehensive technical report"""
        components = analysis.get('components', [])
        problems = analysis.get('problems', [])
        return f"MAINTENANCE TECHNICAL REPORT: Components affected: {', '.join(components) if components else 'hindi tukoy'}. Issues: {', '.join(problems) if problems else 'isyu sa pagpapanatili'}. Severity: {analysis.get('severity_level')}. Estimated repair time: {analysis.get('estimated_time')}"

    def create_simple_description_tagalog(self, analysis: Dict) -> str:
        """Create simple description"""
        problems = analysis.get('problems', [])
        return f"May sira na kailangang ayusin: {', '.join(problems) if problems else 'isyu sa pagpapanatili'}"

    def merge_blip_analyses(self, analyses: List[Dict]) -> Dict[str, Any]:
        """Merge multiple BLIP analyses"""
        if not analyses:
            return {}
        
        merged = {
            "components": [],
            "problems": [],
            "severity": "mababa",
            "context": ""
        }
        
        for analysis in analyses:
            merged["components"].extend(analysis.get("components", []))
            merged["problems"].extend(analysis.get("problems", []))
        
        # Deduplicate
        merged["components"] = list(set(merged["components"]))
        merged["problems"] = list(set(merged["problems"]))
        
        # Determine overall severity
        severities = [analysis.get("severity", "mababa") for analysis in analyses]
        if any(sev == "mataas" for sev in severities):
            merged["severity"] = "mataas"
        elif any(sev == "katamtaman" for sev in severities):
            merged["severity"] = "katamtaman"
        
        merged["context"] = "Combined analysis from multiple AI approaches"
        
        return merged

# Initialize the advanced analyzer
advanced_analyzer = AdvancedMaintenanceAnalyzer()

# AI EXPANSION FUNCTIONS

async def expand_description_with_ai(basic_description: str, image_analysis: dict) -> str:
    """
    Expand basic description into maintenance-worthy context using AI
    """
    try:
        # Prepare context for AI expansion
        components = ", ".join(image_analysis.get("components", []))
        problems = ", ".join(image_analysis.get("problems", []))
        severity = image_analysis.get("severity_indicators", [])
        
        # Create a detailed prompt for AI expansion
        expansion_prompt = f"""You are a meticulous tenant describing an issue to a property manager. 
Use the observations below to craft a clear, conversational note (2-3 sentences) that still sounds professional:
- Basic observation: {basic_description}
- Components involved: {components if components else 'general property areas'}
- Visible issues: {problems if problems else 'something that seems damaged or misplaced'}
- Severity cues: {', '.join(severity) if severity else 'nothing obvious, assume moderate concern'}

Write sentences that:
1. Start by describing what the tenant plainly sees.
2. Explain how serious it feels and why it matters.
3. Politely ask for timely maintenance help.

Description:"""

        # Try multiple AI services for expansion
        expanded = None
        used_rule_based = False
        
        # Option 1: Use Hugging Face LLaMA or similar
        if HF_TOKEN:
            expanded = await expand_with_huggingface(expansion_prompt)
        
        # Option 2: Use OpenAI (if available)
        if not expanded and OPENAI_API_KEY:
            expanded = await expand_with_openai(expansion_prompt)
        
        # Option 3: Rule-based enhancement as fallback
        if not expanded:
            expanded = rule_based_expansion(basic_description, image_analysis)
            used_rule_based = True
        
        if not used_rule_based:
            expanded = craft_conversational_description(expanded, basic_description, image_analysis)
        
        return expanded.strip()
        
    except Exception as e:
        logger.error(f"AI expansion failed: {e}")
        return rule_based_expansion(basic_description, image_analysis)


async def expand_with_huggingface(prompt: str) -> str:
    """Expand description using Hugging Face API"""
    try:
        headers = {"Authorization": f"Bearer {HF_TOKEN}"}
        
        # Use a smaller, faster model for text generation
        api_url = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1"
        
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": 150,
                "temperature": 0.7,
                "top_p": 0.9,
                "do_sample": True,
                "return_full_text": False
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(api_url, headers=headers, json=payload, timeout=30) as response:
                if response.status == 200:
                    result = await response.json()
                    if isinstance(result, list) and len(result) > 0:
                        generated_text = result[0].get('generated_text', '')
                        # Extract just the description part
                        return clean_generated_text(generated_text)
                    
    except Exception as e:
        logger.warning(f"Hugging Face expansion failed: {e}")
        return None


async def expand_with_openai(prompt: str) -> str:
    """Expand description using OpenAI API"""
    try:
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": "gpt-3.5-turbo",
            "messages": [
                {"role": "system", "content": "You are a professional building maintenance inspector. Provide concise, technical descriptions."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 150,
            "temperature": 0.7
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    return result['choices'][0]['message']['content'].strip()
                    
    except Exception as e:
        logger.warning(f"OpenAI expansion failed: {e}")
        return None


def rule_based_expansion(basic_description: str, analysis: dict) -> str:
    """
    Enhanced rule-based expansion as fallback
    Creates maintenance-worthy descriptions from basic captions
    """
    components = analysis.get("components", [])
    problems = analysis.get("problems", [])
    severity_level = analysis.get("severity_level") or analysis.get("severity") or "katamtaman"
    
    component_phrase = format_en_list(components, "the area shown in the photo")
    problem_phrase = format_en_list(problems, "some visible wear")
    
    severity_descriptor_map = {
        "mataas": "severe damage that looks urgent",
        "katamtaman": "moderate damage that is slowly worsening",
        "mababa": "early damage that could expand if ignored"
    }
    severity_descriptor = severity_descriptor_map.get(severity_level, "damage that should be checked soon")
    
    synthetic_ai_text = f"The image reveals {problem_phrase} affecting {component_phrase}, showing {severity_descriptor}."
    fallback_text = enhance_basic_description(basic_description)
    
    return craft_conversational_description(synthetic_ai_text, fallback_text, analysis)


def enhance_basic_description(description: str) -> str:
    """Enhance basic description with maintenance context"""
    description = description.lower()
    
    # Pattern matching for common scenarios - MORE AGGRESSIVE
    patterns = {
        r'(crack|cracks|cracking)': 'Structural cracking detected requiring repair',
        r'(leak|leaking|water leak)': 'Water leakage issue identified requiring immediate attention',
        r'(stain|stains|discolor|discoloration)': 'Staining and discoloration observed indicating water damage or deterioration',
        r'(damage|damaged|damaging)': 'Property damage requiring professional repair',
        r'(broken|break|breaking)': 'Structural failure detected requiring immediate repair',
        r'(mold|mildew|fungus)': 'Moisture-related biological growth present requiring remediation',
        r'(rust|rusted|corros|corroded)': 'Metal corrosion and deterioration observed requiring treatment',
        r'(hole|holes)': 'Structural breach requiring patching and repair',
        r'(loose|detach|detached)': 'Loose or detached component requiring reattachment',
        r'(peel|peeling)': 'Surface degradation and peeling requiring refinishing',
        r'(old|worn|aged|deteriorate|dilapidate)': 'Deterioration due to age requiring replacement or restoration',
        r'(expose|exposed)': 'Exposed components creating safety hazard requiring cover or repair',
        r'(door|doorknob|knob|handle).*?(broken|old|damage|worn|missing)': 'Door hardware failure requiring replacement',
        r'(broken|damage|old).*?(door|doorknob|knob|handle)': 'Door hardware failure requiring replacement',
        r'(floor|flooring).*?(broken|damage|crack|hole|expose|pipe)': 'Flooring damage with exposed infrastructure requiring immediate repair',
        r'(pipe|plumbing).*?(expose|leak|break|damage)': 'Plumbing system damage requiring immediate attention',
        r'(expose|visible).*?(pipe|plumbing|wire)': 'Exposed infrastructure creating safety concern',
        r'(poor|bad).*?(condition|state)': 'Poor condition requiring maintenance work'
    }
    
    for pattern, replacement in patterns.items():
        if re.search(pattern, description, re.IGNORECASE):
            return replacement
    
    # If nothing matches but description exists, create generic maintenance issue
    if len(description.strip()) > 5:
        return "Property maintenance issue identified requiring professional assessment and repair"
    
    return "Property condition requiring inspection and maintenance evaluation"


def clean_generated_text(text: str) -> str:
    """Clean up AI-generated text"""
    # Remove common AI artifacts
    text = re.sub(r'^(Description:|Here\'s|Here is|The description is:)\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\n+', ' ', text)
    text = text.strip()
    
    # Ensure it ends with punctuation
    if text and not text[-1] in '.!?':
        text += '.'
    
    return text


def format_en_list(items: List[str], default: str) -> str:
    """Format English list with natural conjunctions"""
    filtered = [item for item in items if item]
    if not filtered:
        return default
    if len(filtered) == 1:
        return filtered[0]
    if len(filtered) == 2:
        return f"{filtered[0]} and {filtered[1]}"
    return f"{', '.join(filtered[:-1])}, and {filtered[-1]}"


def ensure_sentence(text: str) -> str:
    """Ensure text is a properly terminated sentence"""
    text = text.strip()
    if not text:
        return text
    if text[-1] not in '.!?':
        text += '.'
    return text[0].upper() + text[1:]


def craft_conversational_description(ai_text: str, fallback: str, analysis: Dict[str, Any]) -> str:
    """Blend AI output with analysis to create conversational sentences"""
    components = analysis.get("components", [])
    problems = analysis.get("problems", [])
    component_phrase = format_en_list(components, "the area shown in the photo")
    problem_phrase = format_en_list(problems, "a visible issue")
    
    severity_level = analysis.get("severity_level") or analysis.get("severity") or "katamtaman"
    severity_sentence_map = {
        "mataas": "It already feels urgent and could pose a safety risk if ignored",
        "katamtaman": "It's starting to worsen, so a prompt inspection would really help",
        "mababa": "It is still manageable, but I would like to fix it before it spreads"
    }
    severity_sentence = ensure_sentence(severity_sentence_map.get(severity_level, "It would help to inspect this area so the damage does not spread"))
    
    observation_sentence = ensure_sentence(f"The photo clearly shows {problem_phrase} affecting {component_phrase}")
    cleaned_ai = clean_generated_text(ai_text) if ai_text else ""
    detail_sentence = ""
    if cleaned_ai and cleaned_ai.lower() not in observation_sentence.lower():
        detail_sentence = ensure_sentence(cleaned_ai)
    
    fallback_sentence = ""
    if not detail_sentence and fallback:
        fallback_sentence = ensure_sentence(fallback)
    
    call_to_action = ensure_sentence("Please help schedule a repair so it does not get worse")
    
    sentences = [observation_sentence]
    for candidate in [detail_sentence, fallback_sentence, severity_sentence, call_to_action]:
        if candidate and candidate.lower() not in [s.lower() for s in sentences]:
            sentences.append(candidate)
    
    return " ".join(sentences).strip()


async def translate_to_tagalog(text: str) -> str:
    """
    Translate English maintenance description to Tagalog
    Uses multiple translation strategies
    """
    try:
        # Strategy 1: Hugging Face Translation API
        if HF_TOKEN:
            translated = await translate_with_hf_api(text)
            if translated:
                return ensure_natural_tagalog(translated)
        
        # Strategy 2: Use LibreTranslate (free service)
        translated = await translate_with_libretranslate(text)
        if translated:
            return ensure_natural_tagalog(translated)
        
        # Strategy 3: Use MyMemory Translation API (free)
        translated = await translate_with_mymemory(text)
        if translated:
            return ensure_natural_tagalog(translated)
        
        # Strategy 4: Rule-based translation for common phrases
        translated = rule_based_tagalog_translation(text)
        if translated:
            return ensure_natural_tagalog(translated)
        
        # Fallback: Return original with naturalized adjustments
        return ensure_natural_tagalog(text)
        
    except Exception as e:
        logger.error(f"Translation failed: {e}")
        return ensure_natural_tagalog(text)


async def translate_with_hf_api(text: str) -> str:
    """Translate using Hugging Face API"""
    try:
        headers = {"Authorization": f"Bearer {HF_TOKEN}"}
        api_url = "https://api-inference.huggingface.co/models/Helsinki-NLP/opus-mt-en-tl"
        
        payload = {"inputs": text}
        
        async with aiohttp.ClientSession() as session:
            async with session.post(api_url, headers=headers, json=payload, timeout=30) as response:
                if response.status == 200:
                    result = await response.json()
                    if isinstance(result, list) and len(result) > 0:
                        return result[0].get('translation_text', text)
                        
    except Exception as e:
        logger.warning(f"HF translation failed: {e}")
        return None


async def translate_with_libretranslate(text: str) -> str:
    """Translate using LibreTranslate (free service)"""
    try:
        # Try different LibreTranslate instances
        endpoints = [
            "https://libretranslate.com/translate",
            "https://translate.argosopentech.com/translate",
            "https://libretranslate.de/translate"
        ]
        
        for endpoint in endpoints:
            try:
                payload = {
                    "q": text,
                    "source": "en",
                    "target": "tl",
                    "format": "text"
                }
                
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        endpoint,
                        json=payload,
                        headers={"Content-Type": "application/json"},
                        timeout=15
                    ) as response:
                        if response.status == 200:
                            result = await response.json()
                            return result.get('translatedText', '')
            except Exception as e:
                logger.warning(f"LibreTranslate endpoint {endpoint} failed: {e}")
                continue
                
        return None
    except Exception as e:
        logger.warning(f"LibreTranslate failed: {e}")
        return None


async def translate_with_mymemory(text: str) -> str:
    """Translate using MyMemory API (free)"""
    try:
        url = "https://api.mymemory.translated.net/get"
        params = {
            "q": text,
            "langpair": "en|tl"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=15) as response:
                if response.status == 200:
                    result = await response.json()
                    translation = result.get('responseData', {}).get('translatedText', '')
                    if translation and translation != text:
                        return translation
        return None
    except Exception as e:
        logger.warning(f"MyMemory translation failed: {e}")
        return None


def rule_based_tagalog_translation(text: str) -> str:
    """
    Rule-based translation for common maintenance terms
    Provides natural, conversational Tagalog
    """
    
    # Common maintenance phrases (English -> Natural Tagalog)
    translations = {
        # Problems - more natural terms
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
        'breach': 'sirado',
        'discoloration': 'kupas',
        'wear': 'gasgas',
        
        # Components - more natural terms
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
        'structure': 'istruktura',
        'fixture': 'kagamitan',
        'system': 'sistema',
        'component': 'parte',
        
        # Severity - more natural expressions
        'severe': 'malala',
        'serious': 'seryoso',
        'major': 'malaki',
        'significant': 'malaki',
        'extensive': 'malawak',
        'notable': 'kapansin-pansin',
        
        # Actions - more natural verbs
        'repair': 'kumpunihin',
        'fix': 'ayusin',
        'replace': 'palitan',
        'inspect': 'tingnan',
        'inspection': 'pagsusuri',
        'maintenance': 'pag-aayos',
        'attention': 'ating pansin',
        'immediate': 'kaagad',
        'urgent': 'madalian',
        'prompt': 'agaran',
        'scheduled': 'nakatakda',
        'recommended': 'irerekomenda',
        'professional': 'eksperto',
        'assessment': 'pagtasa',
        
        # Descriptors - more natural phrasing
        'requires': 'kailangan',
        'requiring': 'nangangailangan',
        'observed': 'napansin',
        'detected': 'nakita',
        'identified': 'natukoy',
        'issue': 'problema',
        'problem': 'sira',
        'property': 'bahay',
        'prevent': 'maiwasan',
        'further': 'lalong',
        'water': 'tubig',
        'infiltration': 'tagas',
        'biological': 'amag',
        'growth': 'dami',
        'present': 'mayroon',
        'metal': 'bakal',
        'structural': 'istruktura',
        'surface': 'ibabaw',
        'degradation': 'pagsira',
        'patching': 'pagsasaayos',
        'reattachment': 'pagkakabit',
        'loose': 'maluwag',
        'detached': 'kalas',
        'moisture-related': 'may kinalaman sa tubig'
    }
    
    # Translate word by word with natural phrasing
    text_lower = text.lower()
    translated = text
    
    # Common phrase replacements for more natural Tagalog
    phrase_replacements = {
        r'\bmaintenance issue\b': 'problema sa bahay',
        r'\brequires attention\b': 'kailangan ng atensyon',
        r'\bneeds repair\b': 'kailangan ayusin',
        r'\bprofessional assessment\b': 'tingnan ng eksperto',
        r'\bwater damage\b': 'sira mula sa tubig',
        r'\bstructural damage\b': 'sira sa istruktura',
        r'\belectrical problem\b': 'problema sa kuryente',
        r'\bplumbing issue\b': 'problema sa tubig',
        r'\bsafety hazard\b': 'delikado',
        r'\bimmediate action\b': 'kaagad na aksyon',
        r'\bprompt attention\b': 'agad na atensyon',
        r'\bproperty maintenance\b': 'pag-aayos ng bahay',
        r'\bbuilding defect\b': 'depekto ng bahay',
        r'\bcomponent failure\b': 'nasirang parte',
        r'\bsurface degradation\b': 'sira sa ibabaw',
        r'\bmoisture infiltration\b': 'pasok ng tubig',
        r'\bprofessional repair\b': 'pagkukumpuni ng eksperto'
    }
    
    # Apply phrase replacements first
    for english_phrase, tagalog_phrase in phrase_replacements.items():
        translated = re.sub(english_phrase, tagalog_phrase, translated, flags=re.IGNORECASE)
    
    # Then apply word-by-word translation
    for english, tagalog in translations.items():
        # Use word boundaries to avoid partial matches
        pattern = r'\b' + re.escape(english) + r'\b'
        translated = re.sub(pattern, tagalog, translated, flags=re.IGNORECASE)
    
    # Post-processing for more natural Tagalog
    natural_improvements = {
        r'\bkailangan ng kumpuni\b': 'kailangan kumpunihin',
        r'\bkailangan ng ayos\b': 'kailangan ayusin',
        r'\bproblema sa problema\b': 'problema',
        r'\bsira na sira\b': 'sira',
        r'\bdelikado na delikado\b': 'delikado',
        r'\bmadalian na madalian\b': 'madalian',
        r'\bkaagad na kaagad\b': 'kaagad',
        r'\bagaran na agaran\b': 'agaran'
    }
    
    for pattern, improvement in natural_improvements.items():
        translated = re.sub(pattern, improvement, translated, flags=re.IGNORECASE)
    
    return translated


def ensure_natural_tagalog(text: str) -> str:
    """Polish translated text to sound natural in Tagalog"""
    if not text:
        return text
    
    polished = rule_based_tagalog_translation(text)
    
    replacements = {
        r'\bmaintenance\b': 'pagpapanatili',
        r'\bissue\b': 'problema',
        r'\bproblem\b': 'suliranin',
        r'\bcomponent\b': 'bahagi',
        r'\bsystem\b': 'sistema',
        r'\bplease\b': 'pakiusap',
        r'\bmanager\b': 'tagapamahala',
        r'\bdamage\b': 'sira',
        r'\brepair\b': 'pag-aayos',
        r'\bcheck\b': 'suriin',
        r'\binspect\b': 'siyasatin',
        r'\bhelp\b': 'tulong',
        r'\btenant\b': 'nangungupahan',
        r'\barea\b': 'bahagi',
        r'\bsevere\b': 'malala',
        r'\burgent\b': 'agaran',
        r'\bplease help\b': 'pakiusap tulungan',
        r'\band\b': 'at'
    }
    
    for pattern, replacement in replacements.items():
        polished = re.sub(pattern, replacement, polished, flags=re.IGNORECASE)
    
    polished = re.sub(r'\s+', ' ', polished).strip()
    if not polished:
        return polished
    
    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', polished) if s.strip()]
    normalized_sentences = []
    for sentence in sentences:
        if not sentence:
            continue
        sentence = sentence[0].upper() + sentence[1:] if len(sentence) > 1 else sentence.upper()
        if sentence and sentence[-1] not in '.!?':
            sentence += '.'
        normalized_sentences.append(sentence)
    
    return " ".join(normalized_sentences)


def format_tl_list(items: List[str]) -> str:
    """Format Tagalog list with natural conjunctions"""
    filtered_items = [item for item in items if item]
    if not filtered_items:
        return ""
    if len(filtered_items) == 1:
        return filtered_items[0]
    return f"{', '.join(filtered_items[:-1])} at {filtered_items[-1]}"


def build_tenant_conversation(tagalog_context: str, analysis: Dict[str, Any]) -> str:
    """Create conversational Tagalog narrative from tenant perspective"""
    components = format_tl_list(analysis.get("components", []))
    problems = format_tl_list(analysis.get("problems", []))
    locations = format_tl_list(analysis.get("locations", []))
    severity = analysis.get("severity_level", "katamtaman")
    
    severity_map = {
        "mataas": "Delikado na ito para sa amin kaya umaasa akong maagapan agad.",
        "katamtaman": "Hindi pa naman emergency pero gusto ko sanang maipasilip sa lalong madaling panahon.",
        "mababa": "Kayang tiisin sandali pero mas mabuti nang maagapan bago lumala."
    }
    
    sentence_parts = [
        "Magandang araw po. Ako ang nangungupahan sa unit at nais kong i-report ang makikita sa litrato.",
        f"Sa kuha, mapapansin ninyo na {tagalog_context.strip()}",
    ]
    
    if components:
        sentence_parts.append(f"Apektado ang bahagi ng {components}.")
    if problems:
        sentence_parts.append(f"Pinakamalinaw na sira ay {problems}.")
    if locations:
        sentence_parts.append(f"Nangyayari ito sa {locations}.")
    
    sentence_parts.append(severity_map.get(severity, severity_map["katamtaman"]))
    sentence_parts.append("Pakitulungan naman po kaming maayos ito habang malinaw pa sa litrato. Maraming salamat.")
    
    return " ".join(segment for segment in sentence_parts if segment).strip()


async def generate_tagalog_outputs(basic_description: str, expanded_description: str, analysis: Dict[str, Any]) -> Dict[str, str]:
    """Prepare Tagalog translations and conversational narrative"""
    tagalog_basic = await translate_to_tagalog(basic_description)
    tagalog_expanded = await translate_to_tagalog(expanded_description)
    tenant_voice = build_tenant_conversation(tagalog_expanded, analysis)
    
    return {
        "tagalog_basic": tagalog_basic,
        "tagalog_expanded": tagalog_expanded,
        "tenant_voice": tenant_voice
    }

# IMAGE PROCESSING FUNCTIONS

def enhanced_image_processing(image: Image.Image) -> Image.Image:
    """Enhanced image preprocessing for better analysis"""
    try:
        # Enhance image quality
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(1.2)
        
        enhancer = ImageEnhance.Sharpness(image)
        image = enhancer.enhance(1.1)
        
        enhancer = ImageEnhance.Brightness(image)
        image = enhancer.enhance(1.05)
        
        return image
    except Exception as e:
        logger.warning(f"Image enhancement failed: {e}")
        return image


def multi_model_caption_generation(image: Image.Image) -> str:
    """Generate captions using multiple models for better accuracy"""
    
    captions = []
    
    # Strategy 1: BLIP with different prompts
    blip_prompts = [
        "maintenance issue damage repair",
        "property inspection problem",
        "a photo of",
        "what is wrong with this"
    ]
    
    for prompt in blip_prompts:
        try:
            if prompt == "a photo of":
                inputs = processor_blip(image, return_tensors="pt")
            else:
                inputs = processor_blip(image, prompt, return_tensors="pt")
            
            if torch.cuda.is_available():
                inputs = {k: v.to("cuda") for k, v in inputs.items()}
            
            with torch.no_grad():
                out = model_blip.generate(
                    **inputs,
                    max_length=100,
                    num_beams=5,
                    temperature=0.8,
                    do_sample=True,
                    early_stopping=True
                )
            
            caption = processor_blip.decode(out[0], skip_special_tokens=True)
            if is_valid_caption(caption, prompt):
                captions.append(caption)
                
        except Exception as e:
            logger.warning(f"BLIP captioning with prompt '{prompt}' failed: {e}")
    
    # Strategy 2: BLIP-2 for more detailed analysis
    try:
        if processor_blip2 is not None and model_blip2 is not None:
            prompt = "Question: What maintenance issues can you see? Answer:"
            inputs = processor_blip2(image, prompt, return_tensors="pt")
            
            if torch.cuda.is_available():
                inputs = {k: v.to("cuda") for k, v in inputs.items()}
            
            with torch.no_grad():
                out = model_blip2.generate(**inputs, max_length=100)
            
            caption = processor_blip2.decode(out[0], skip_special_tokens=True)
            # Extract just the answer part
            if "Answer:" in caption:
                caption = caption.split("Answer:")[-1].strip()
            captions.append(caption)
        else:
            logger.info("BLIP-2 not available, skipping")
            
    except Exception as e:
        logger.warning(f"BLIP-2 captioning failed: {e}")
    
    # Select the best caption
    if captions:
        # Prefer longer, more descriptive captions
        best_caption = max(captions, key=lambda x: len(x.split()))
        return enhance_description(best_caption)
    else:
        raise Exception("All captioning strategies failed")


def is_valid_caption(caption: str, prompt: str) -> bool:
    """Less strict caption validation"""
    if not caption or len(caption.strip()) < 10:  # Reduced from 15
        return False
    
    caption_lower = caption.lower()
    
    # Don't reject just because of prompt words
    # Instead, check for meaningful content
    maintenance_indicators = [
        'crack', 'leak', 'break', 'damage', 'stain', 'rust', 'mold',
        'hole', 'tear', 'wear', 'wall', 'ceiling', 'floor', 'pipe',
        'wire', 'paint', 'surface', 'structure', 'issue', 'problem'
    ]
    
    valid_words = sum(1 for word in maintenance_indicators if word in caption_lower)
    return valid_words >= 1  # At least one maintenance-related word


def enhance_description(description: str) -> str:
    """Enhanced description improvement"""
    if not description:
        return "Unable to analyze image content"
    
    # Clean up common issues
    cleanup_patterns = [
        (r'\b(this is a picture of|there is a|this image shows|this is an image of|you can see|in this photo|the image shows|we can see)\b', ''),
        (r'\s+', ' '),
    ]
    
    for pattern, replacement in cleanup_patterns:
        description = re.sub(pattern, replacement, description, flags=re.IGNORECASE)
    
    description = description.strip()
    
    # Ensure proper capitalization and punctuation
    if description:
        description = description[0].upper() + description[1:]
        if not description.endswith(('.', '!', '?')):
            description += '.'
    
    return description


async def analyze_with_hf_api_advanced(image_data: bytes, filename: str) -> str:
    """Advanced Hugging Face API analysis with multiple endpoints"""
    
    if not HF_TOKEN:
        raise Exception("HF_API_KEY not configured")
    
    # Try multiple endpoints
    endpoints = [
        ("https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large", {}),
        ("https://api-inference.huggingface.co/models/Salesforce/blip2-opt-2.7b", {"parameters": {"max_length": 100}}),
    ]
    
    for endpoint, params in endpoints:
        try:
            response = requests.post(
                endpoint,
                headers={"Authorization": f"Bearer {HF_TOKEN}"},
                data=image_data,
                json=params,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                caption = result[0]['generated_text']
                enhanced_caption = enhance_description(caption)
                logger.info(f"HF API success for {filename} from {endpoint}: {enhanced_caption}")
                return enhanced_caption
                
        except Exception as e:
            logger.warning(f"HF API endpoint {endpoint} failed for {filename}: {e}")
            continue
    
    raise Exception("All Hugging Face API endpoints failed")


def enhance_analysis_with_context(description: str) -> dict:
    """Enhanced maintenance content analysis"""
    
    maintenance_patterns = {
        'structural': ['wall', 'ceiling', 'floor', 'foundation', 'beam', 'drywall', 'door', 'doorknob', 'knob', 'handle'],
        'plumbing': ['pipe', 'leak', 'faucet', 'sink', 'toilet', 'drain', 'water', 'exposed', 'plumbing'],
        'electrical': ['wire', 'outlet', 'switch', 'breaker', 'electrical', 'circuit', 'wiring'],
        'problems': ['broken', 'cracked', 'damaged', 'leaking', 'stained', 'corroded', 'old', 'dilapidated', 'worn', 'exposed', 'missing', 'hole', 'deteriorated', 'rusted', 'peeling'],
        'severity': ['large', 'major', 'severe', 'significant', 'extensive', 'serious', 'bad', 'poor']
    }
    
    analysis = {
        "components": [],
        "problems": [],
        "severity_indicators": [],
        "confidence": "low",
        "risk_level": "low",
        "maintenance_priority": "low",
        "isMaintenanceRelated": False,
        "contextual_analysis": "",
        "locations": []
    }
    
    description_lower = description.lower()
    
    for category, keywords in maintenance_patterns.items():
        found = [kw for kw in keywords if kw in description_lower]
        if found:
            if category in ['structural', 'plumbing', 'electrical']:
                analysis["components"].extend(found)
            elif category == 'problems':
                analysis["problems"].extend(found)
            elif category == 'severity':
                analysis["severity_indicators"].extend(found)
    
    # Remove duplicates
    analysis["components"] = list(set(analysis["components"]))
    analysis["problems"] = list(set(analysis["problems"]))
    analysis["severity_indicators"] = list(set(analysis["severity_indicators"]))
    
    # Enhanced scoring - MORE SENSITIVE TO ISSUES
    score = len(analysis["components"]) * 2 + len(analysis["problems"]) * 3 + len(analysis["severity_indicators"]) * 2
    
    # Lower thresholds to catch more issues
    if score >= 6:
        analysis.update({"confidence": "high", "risk_level": "high", "maintenance_priority": "urgent", "severity_level": "mataas"})
    elif score >= 3:
        analysis.update({"confidence": "medium", "risk_level": "medium", "maintenance_priority": "medium", "severity_level": "katamtaman"})
    elif score >= 1:
        analysis.update({"confidence": "medium", "risk_level": "low", "maintenance_priority": "low", "severity_level": "mababa"})
    else:
        analysis.update({"severity_level": "mababa"})
    
    # If ANY problem is found, it's maintenance related
    analysis["isMaintenanceRelated"] = len(analysis["problems"]) > 0 or len(analysis["components"]) > 0
    analysis["contextual_analysis"] = f"Found {len(analysis['problems'])} issues affecting {len(analysis['components'])} components"
    
    return analysis


# REQUEST ANALYSIS FUNCTIONS (NEW)

async def summarize_request_with_ai(text: str) -> str:
    """Summarize maintenance request using AI"""
    try:
        # Try Hugging Face first
        if HF_TOKEN:
            summary = await summarize_with_huggingface(text)
            if summary:
                return summary
        
        # Try OpenAI if available
        if OPENAI_API_KEY:
            summary = await summarize_with_openai(text)
            if summary:
                return summary
        
        # Fallback to rule-based summarization
        return rule_based_summarization(text)
        
    except Exception as e:
        logger.warning(f"AI summarization failed: {e}")
        return rule_based_summarization(text)

async def summarize_with_huggingface(text: str) -> str:
    """Summarize using Hugging Face API"""
    try:
        headers = {"Authorization": f"Bearer {HF_TOKEN}"}
        
        # Use a model good for summarization
        api_url = "https://api-inference.huggingface.co/models/facebook/bart-large-cnn"
        
        prompt = f"""
        Summarize this maintenance request into a clear, concise description (2-3 sentences):
        
        "{text}"
        
        Summary:
        """
        
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": 150,
                "temperature": 0.7,
                "top_p": 0.9,
                "do_sample": True,
                "return_full_text": False
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(api_url, headers=headers, json=payload, timeout=30) as response:
                if response.status == 200:
                    result = await response.json()
                    if isinstance(result, list) and len(result) > 0:
                        summary = result[0].get('generated_text', '')
                        return clean_summary_text(summary)
                    
    except Exception as e:
        logger.warning(f"Hugging Face summarization failed: {e}")
        return None

async def summarize_with_openai(text: str) -> str:
    """Summarize using OpenAI API"""
    try:
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        prompt = f"""
        Please summarize this maintenance request into a clear, concise description (2-3 sentences). 
        Focus on the main issue, affected components, and required action:
        
        "{text}"
        """
        
        payload = {
            "model": "gpt-3.5-turbo",
            "messages": [
                {"role": "system", "content": "You are a professional maintenance request summarizer. Create concise, clear summaries that capture the essential information."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 150,
            "temperature": 0.7
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    summary = result['choices'][0]['message']['content'].strip()
                    return clean_summary_text(summary)
                    
    except Exception as e:
        logger.warning(f"OpenAI summarization failed: {e}")
        return None

def rule_based_summarization(text: str) -> str:
    """Rule-based fallback for summarization"""
    # Simple summarization logic
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if s.strip()]
    
    if len(sentences) <= 3:
        return text
    
    # Take first 2-3 sentences as summary
    summary_sentences = sentences[:min(3, len(sentences))]
    summary = '. '.join(summary_sentences) + '.'
    
    # If summary is too long, truncate
    if len(summary) > 200:
        summary = summary[:197] + '...'
    
    return summary

def clean_summary_text(text: str) -> str:
    """Clean up summary text"""
    # Remove common AI artifacts
    text = re.sub(r'^(Summary:|Here\'s a summary:|The summary is:|In summary:)\s*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\n+', ' ', text)
    text = text.strip()
    
    # Ensure it ends with punctuation
    if text and not text[-1] in '.!?':
        text += '.'
    
    return text

async def classify_urgency_with_ai(text: str) -> int:
    """Classify urgency level using AI (1-4 scale)"""
    try:
        # Try Hugging Face first
        if HF_TOKEN:
            urgency = await classify_urgency_with_huggingface(text)
            if urgency:
                return urgency
        
        # Try OpenAI if available
        if OPENAI_API_KEY:
            urgency = await classify_urgency_with_openai(text)
            if urgency:
                return urgency
        
        # Fallback to rule-based urgency classification
        return rule_based_urgency_classification(text)
        
    except Exception as e:
        logger.warning(f"AI urgency classification failed: {e}")
        return rule_based_urgency_classification(text)

async def classify_urgency_with_huggingface(text: str) -> int:
    """Classify urgency using Hugging Face API"""
    try:
        headers = {"Authorization": f"Bearer {HF_TOKEN}"}
        
        prompt = f"""
        Analyze this maintenance request and classify its urgency level:
        1 - Low (cosmetic, non-urgent)
        2 - Medium (should be addressed soon)
        3 - High (requires prompt attention)
        4 - Critical (emergency, safety hazard)
        
        Request: "{text}"
        
        Respond with ONLY the number (1, 2, 3, or 4):
        """
        
        api_url = "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1"
        
        payload = {
            "inputs": prompt,
            "parameters": {
                "max_new_tokens": 10,
                "temperature": 0.3,
                "do_sample": False,
                "return_full_text": False
            }
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(api_url, headers=headers, json=payload, timeout=30) as response:
                if response.status == 200:
                    result = await response.json()
                    if isinstance(result, list) and len(result) > 0:
                        response_text = result[0].get('generated_text', '').strip()
                        # Extract number from response
                        numbers = re.findall(r'\b[1-4]\b', response_text)
                        if numbers:
                            return int(numbers[0])
                    
    except Exception as e:
        logger.warning(f"Hugging Face urgency classification failed: {e}")
        return None

async def classify_urgency_with_openai(text: str) -> int:
    """Classify urgency using OpenAI API"""
    try:
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        
        prompt = f"""
        Analyze this maintenance request and classify its urgency level. Respond with ONLY the number:
        1 - Low (cosmetic, non-urgent)
        2 - Medium (should be addressed soon) 
        3 - High (requires prompt attention)
        4 - Critical (emergency, safety hazard)
        
        Request: "{text}"
        """
        
        payload = {
            "model": "gpt-3.5-turbo",
            "messages": [
                {"role": "system", "content": "You are a maintenance urgency classifier. Respond with ONLY the number (1, 2, 3, or 4)."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 5,
            "temperature": 0.1
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            ) as response:
                if response.status == 200:
                    result = await response.json()
                    response_text = result['choices'][0]['message']['content'].strip()
                    numbers = re.findall(r'\b[1-4]\b', response_text)
                    if numbers:
                        return int(numbers[0])
                    
    except Exception as e:
        logger.warning(f"OpenAI urgency classification failed: {e}")
        return None

def rule_based_urgency_classification(text: str) -> int:
    """Rule-based urgency classification as fallback"""
    text_lower = text.lower()
    
    # Critical urgency indicators (level 4)
    critical_keywords = [
        'gas leak', 'electrical spark', 'fire', 'flood', 'no power', 
        'broken window', 'no lock', 'no heat', 'no water', 'raw sewage',
        'exposed wire', 'structural collapse', 'flooding', 'sparking',
        'smoke', 'burning', 'short circuit', 'electrocution', 'emergency'
    ]
    
    # High urgency indicators (level 3)
    high_keywords = [
        'leak', 'electrical', 'not working', 'broken', 'clog', 'overflow',
        'pest', 'mold', 'no hot water', 'water damage', 'exposed pipe',
        'major', 'severe', 'serious', 'extensive', 'flood', 'burst'
    ]
    
    # Medium urgency indicators (level 2)
    medium_keywords = [
        'slow', 'drip', 'minor', 'cosmetic', 'paint', 'scratch',
        'loose', 'stain', 'sticking', 'noisy', 'peeling', 'small',
        'squeak', 'stuck', 'difficult'
    ]
    
    # Check for critical urgency
    if any(keyword in text_lower for keyword in critical_keywords):
        return 4
    
    # Check for high urgency
    if any(keyword in text_lower for keyword in high_keywords):
        return 3
    
    # Check for medium urgency
    if any(keyword in text_lower for keyword in medium_keywords):
        return 2
    
    # Default to medium urgency
    return 2

async def generate_comprehensive_analysis(text: str, summary: str, urgency_level: int) -> Dict[str, Any]:
    """Generate comprehensive analysis of the maintenance request"""
    
    # Use your existing analyzer for detailed analysis
    basic_analysis = enhance_analysis_with_context(text.lower())
    
    # Map urgency level to text
    urgency_map = {
        1: "Low",
        2: "Medium", 
        3: "High",
        4: "Critical"
    }
    
    # Generate comprehensive report using your existing analyzer
    comprehensive_report = advanced_analyzer.generate_maintenance_report_tagalog(summary, basic_analysis)
    
    return {
        "summary": summary,
        "urgency_level": urgency_level,
        "urgency_text": urgency_map.get(urgency_level, "Medium"),
        "components_identified": basic_analysis.get("components", []),
        "problems_detected": basic_analysis.get("problems", []),
        "severity_assessment": basic_analysis.get("severity_level", "mababa"),
        "risk_level": basic_analysis.get("risk_level", "low"),
        "maintenance_priority": basic_analysis.get("maintenance_priority", "low"),
        "comprehensive_report": comprehensive_report,
        "confidence_score": basic_analysis.get("confidence", "medium")
    }

async def fallback_request_analysis(data: dict) -> JSONResponse:
    """Fallback analysis when AI services fail"""
    user_text = data.get("userText", "")
    image_descriptions = data.get("imageDescriptions", [])
    
    combined_text = user_text + " " + " ".join(image_descriptions)
    
    # Simple fallback summarization
    summary = rule_based_summarization(combined_text)
    
    # Simple fallback urgency classification
    urgency_level = rule_based_urgency_classification(combined_text)
    
    return JSONResponse({
        "success": True,
        "summary": summary,
        "urgencyLevel": urgency_level,
        "comprehensiveAnalysis": {
            "summary": summary,
            "urgency_level": urgency_level,
            "urgency_text": ["Low", "Medium", "High", "Critical"][urgency_level - 1],
            "components_identified": [],
            "problems_detected": [],
            "severity_assessment": "mababa",
            "risk_level": "low",
            "maintenance_priority": "low",
            "confidence_score": "low",
            "fallback_used": True
        },
        "fallback": True,
        "timestamp": datetime.now().isoformat()
    })


# FASTAPI APP SETUP

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await load_models()
    yield
    # Shutdown would go here

app = FastAPI(
    title="Advanced Maintenance Analysis API - Enhanced Tagalog System",
    description="Pinakamataas na antas ng sistema para sa pag-generate ng maintenance content mula sa mga larawan at deskripsyon",
    version="3.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def load_models():
    """Load all required models when the application starts"""
    global processor_blip, model_blip, processor_blip2, model_blip2
    
    try:
        logger.info("Loading BLIP model...")
        processor_blip = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-large")
        model_blip = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-large")
        
        logger.info("Loading BLIP-2 model...")
        try:
            processor_blip2 = Blip2Processor.from_pretrained("Salesforce/blip2-opt-2.7b")
            model_blip2 = Blip2ForConditionalGeneration.from_pretrained("Salesforce/blip2-opt-2.7b")
            logger.info("BLIP-2 model loaded successfully!")
        except Exception as e:
            logger.warning(f"BLIP-2 model failed to load: {e}")
            logger.info("Continuing with BLIP model only")
            processor_blip2 = None
            model_blip2 = None
        
        # Move models to GPU if available
        if torch.cuda.is_available():
            model_blip = model_blip.to("cuda")
            if model_blip2:
                model_blip2 = model_blip2.to("cuda")
            logger.info("Models moved to GPU")
        else:
            logger.info("Using CPU for inference")
            
        logger.info("All models loaded successfully!")
        
    except Exception as e:
        logger.error(f"Error loading models: {e}")
        raise e


# MIDDLEWARE

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = datetime.now()
    logger.info(f"Incoming request: {request.method} {request.url}")
    
    response = await call_next(request)
    
    process_time = (datetime.now() - start_time).total_seconds()
    logger.info(f"Response status: {response.status_code} - Process time: {process_time:.2f}s")
    
    return response


# API ENDPOINTS

@app.get("/")
async def root():
    return {
        "message": "Advanced Maintenance Analysis API is running!",
        "version": "3.0.0",
        "features": [
            "Multi-model image analysis",
            "AI-powered description expansion",
            "Tagalog content generation", 
            "Maintenance report generation",
            "Cost estimation",
            "Safety recommendations",
            "Repair steps guidance",
            "Request summarization",
            "Urgency classification"
        ]
    }


@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "models_loaded": model_blip is not None,
        "blip2_loaded": model_blip2 is not None,
        "timestamp": datetime.now().isoformat()
    }


@app.post("/analyze-image-advanced")
async def analyze_image_advanced(file: UploadFile = File(...)):
    """
    Advanced image analysis with AI expansion and Tagalog translation
    """
    try:
        # Validate file
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="File must be an image")
        
        logger.info(f"Advanced processing of image: {file.filename}")
        
        # Read and process image
        image_data = await file.read()
        image = Image.open(io.BytesIO(image_data))
        
        # Validate image size
        if image.size[0] < 100 or image.size[1] < 100:
            raise HTTPException(status_code=400, detail="Image is too small for analysis")
        
        # Convert to RGB if necessary
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Enhanced image processing
        enhanced_image = enhanced_image_processing(image)
        
        # Step 1: Generate basic description
        try:
            basic_description = multi_model_caption_generation(enhanced_image)
        except Exception as local_error:
            logger.warning(f"Local model processing failed: {local_error}")
            basic_description = await analyze_with_hf_api_advanced(image_data, file.filename)
        
        logger.info(f"Basic description: {basic_description}")
        
        # Step 2: Analyze for maintenance context
        basic_analysis = enhance_analysis_with_context(basic_description.lower())
        
        # Step 3: Expand description with AI for maintenance context
        expanded_description = await expand_description_with_ai(basic_description, basic_analysis)
        logger.info(f"Expanded description: {expanded_description}")
        
        # Step 4: Translate descriptions and craft tenant narrative in Tagalog
        tagalog_outputs = await generate_tagalog_outputs(basic_description, expanded_description, basic_analysis)
        tenant_voice_description = tagalog_outputs["tenant_voice"]
        logger.info(f"Tenant voice description: {tenant_voice_description}")
        
        # Step 5: Generate comprehensive report
        comprehensive_report = advanced_analyzer.generate_maintenance_report_tagalog(
            expanded_description, 
            basic_analysis
        )
        
        logger.info(f"Advanced analysis completed for {file.filename}")
        
        return JSONResponse({
            "success": True,
            "description": tenant_voice_description,
            "maintenance_issue": tenant_voice_description,
            "tenant_voice_description": tenant_voice_description,
            "narrative_perspective": "tenant",
            "original_description": tagalog_outputs["tagalog_basic"],
            "original_description_english": basic_description,
            "expanded_description": tagalog_outputs["tagalog_expanded"],
            "expanded_description_english": expanded_description,
            "tagalog_description": tagalog_outputs["tagalog_basic"],
            "tagalog_expanded_description": tagalog_outputs["tagalog_expanded"],
            "comprehensive_report": comprehensive_report,
            "analysis": basic_analysis,
            "isMaintenanceRelated": basic_analysis["isMaintenanceRelated"],
            "processing_level": "advanced_with_ai_expansion",
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Advanced image analysis failed: {e}")
        return JSONResponse({
            "success": False,
            "error": str(e),
            "processing_level": "advanced",
            "timestamp": datetime.now().isoformat()
        }, status_code=500)


@app.post("/analyze-multiple-images")
async def analyze_multiple_images(files: List[UploadFile] = File(...)):
    """Advanced analysis of multiple images"""
    results = []
    
    for file in files:
        try:
            # Process each file
            image_data = await file.read()
            image = Image.open(io.BytesIO(image_data))
            
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            enhanced_image = enhanced_image_processing(image)
            
            try:
                basic_description = multi_model_caption_generation(enhanced_image)
            except Exception as local_error:
                logger.warning(f"Local processing failed for {file.filename}: {local_error}")
                basic_description = await analyze_with_hf_api_advanced(image_data, file.filename)
            
            basic_analysis = enhance_analysis_with_context(basic_description.lower())
            expanded_description = await expand_description_with_ai(basic_description, basic_analysis)
            tagalog_outputs = await generate_tagalog_outputs(basic_description, expanded_description, basic_analysis)
            tenant_voice_description = tagalog_outputs["tenant_voice"]
            comprehensive_report = advanced_analyzer.generate_maintenance_report_tagalog(expanded_description, basic_analysis)
            
            results.append({
                "filename": file.filename,
                "success": True,
                "description": tenant_voice_description,
                "maintenance_issue": tenant_voice_description,
                "tenant_voice_description": tenant_voice_description,
                "narrative_perspective": "tenant",
                "original_description": tagalog_outputs["tagalog_basic"],
                "original_description_english": basic_description,
                "expanded_description": tagalog_outputs["tagalog_expanded"],
                "expanded_description_english": expanded_description,
                "tagalog_description": tagalog_outputs["tagalog_basic"],
                "tagalog_expanded_description": tagalog_outputs["tagalog_expanded"],
                "comprehensive_report": comprehensive_report,
                "analysis": basic_analysis,
                "isMaintenanceRelated": basic_analysis["isMaintenanceRelated"]
            })
            
        except Exception as e:
            logger.error(f"Failed to process {file.filename}: {e}")
            results.append({
                "filename": file.filename,
                "success": False,
                "error": str(e)
            })
    
    return {"results": results}


@app.post("/analyze-request")
async def analyze_request(data: dict = Body(...)):
    """
    Analyze maintenance request text for summarization and urgency classification
    """
    try:
        user_text = data.get("userText", "")
        image_descriptions = data.get("imageDescriptions", [])
        
        if not user_text and not image_descriptions:
            return JSONResponse({
                "success": False,
                "error": "No content provided for analysis"
            }, status_code=400)
        
        logger.info(f"Analyzing request: {user_text[:100]}... with {len(image_descriptions)} image descriptions")
        
        # Combine user text and image descriptions
        combined_text = user_text
        if image_descriptions:
            combined_text += " " + " ".join(image_descriptions)
        
        # Step 1: Summarize the request using AI
        summary = await summarize_request_with_ai(combined_text)
        
        # Step 2: Classify urgency using AI
        urgency_level = await classify_urgency_with_ai(combined_text)
        
        # Step 3: Generate comprehensive analysis
        comprehensive_analysis = await generate_comprehensive_analysis(combined_text, summary, urgency_level)
        
        logger.info(f"Request analysis completed - Urgency: {urgency_level}")
        
        return JSONResponse({
            "success": True,
            "summary": summary,
            "urgencyLevel": urgency_level,
            "comprehensiveAnalysis": comprehensive_analysis,
            "processing_level": "advanced_request_analysis",
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Request analysis failed: {e}")
        # Fallback analysis
        return await fallback_request_analysis(data)


@app.post("/generate-maintenance-plan")
async def generate_maintenance_plan(data: dict = Body(...)):
    """Generate comprehensive maintenance plan"""
    try:
        descriptions = data.get("descriptions", [])
        user_context = data.get("user_context", "")
        
        if not descriptions and not user_context:
            return JSONResponse({"error": "No content provided"}, status_code=400)
        
        # Combine all descriptions
        combined_text = " ".join(descriptions) + " " + user_context
        
        # Generate comprehensive plan using advanced analyzer
        basic_analysis = enhance_analysis_with_context(combined_text.lower())
        plan = advanced_analyzer.generate_maintenance_report_tagalog(combined_text, basic_analysis)
        
        return JSONResponse({
            "success": True,
            "maintenance_plan": plan,
            "summary": f"Generated comprehensive plan for {len(descriptions)} issues",
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Maintenance plan generation failed: {e}")
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=port,
        log_config=None
    )