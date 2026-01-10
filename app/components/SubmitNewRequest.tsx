import React, { useState, useRef, useEffect, useCallback } from 'react'
import { HiOutlineChevronLeft } from 'react-icons/hi';
import { HiOutlinePlus } from 'react-icons/hi2';
import { useSession } from 'next-auth/react';

interface SubmitProps {
    submitNewRequest: (newRequest: boolean) => void;
    onSubmissionStatus?: (submitting: boolean) => void;
    initialImages?: File[];
}

interface MaintenanceRequest {
    title: string;
    description: string;
    images: File[];
}

interface AIAnalysisResult {
    success: boolean;
    description: string;
    maintenance_issue: string;
    analysis: any;
    isMaintenanceRelated: boolean;
    comprehensive_report?: any;
    confidence_score?: number;
}

const SubmitNewRequest = ({ submitNewRequest, onSubmissionStatus, initialImages = [] }: SubmitProps) => {
    const { data: session, status } = useSession();
    const [formData, setFormData] = useState<MaintenanceRequest>({
        title: '',
        description: '',
        images: initialImages
    });
    const [errors, setErrors] = useState<Partial<MaintenanceRequest>>({});
    const [loading, setLoading] = useState(false);
    const [aiResults, setAiResults] = useState<AIAnalysisResult[]>([]);
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial AI analysis for pre-filled images
    useEffect(() => {
        if (initialImages.length > 0 && aiResults.length === 0) {
            const analyzeInitialImages = async () => {
                try {
                    setLoading(true);
                    const aiFormData = new FormData();
                    initialImages.forEach(file => aiFormData.append('files', file));

                    const aiRes = await fetch('/api/analyze-image', {
                        method: 'POST',
                        body: aiFormData,
                    });

                    if (aiRes.ok) {
                        const aiData = await aiRes.json();
                        setAiResults(aiData.results || []);
                    }
                } catch (error) {
                    console.error('Error analyzing initial images:', error);
                } finally {
                    setLoading(false);
                }
            };
            analyzeInitialImages();
        }
    }, [initialImages, aiResults.length]);

    const updateDescriptionFromAI = useCallback(async () => {
        if (formData.images.length === 0) {
            // If no images, clear AI-generated content but keep user input
            if (formData.description.startsWith('AI Analysis:')) {
                setFormData(prev => ({
                    ...prev,
                    description: ''
                }));
            }
            return;
        }

        if (aiResults.length === 0) return;

        setIsAutoGenerating(true);

        try {
            const successfulResults = aiResults.filter(r => r.success);
            
            if (successfulResults.length > 0) {
                // Build AI-enhanced description
                const aiDescriptions = successfulResults.map(r => r.description);
                const maintenanceIssues = successfulResults.map(r => r.maintenance_issue);
                
                // Get confidence scores
                const confidenceScores = successfulResults
                    .filter(r => r.confidence_score)
                    .map(r => (r.confidence_score! * 100).toFixed(0));
                
                const avgConfidence = confidenceScores.length > 0 
                    ? Math.round(confidenceScores.reduce((a, b) => Number(a) + Number(b), 0) / confidenceScores.length)
                    : null;

                let aiEnhancedDescription = '';

                if (formData.description.trim() === '' || formData.description.startsWith('AI Analysis:')) {
                    // If no user description or it's AI-generated, create full AI description
                    aiEnhancedDescription = `${aiDescriptions.join(' ')}`;
                } else {
                    // If user has written something, append AI insights
                    aiEnhancedDescription = `${aiDescriptions.join(' ')}`;
                }

                // Auto-generate title when still blank by taking key phrases
                const shouldGenerateTitle = formData.title.trim().length === 0;
                let generatedTitle = formData.title;
                if (shouldGenerateTitle) {
                    const candidateText = aiEnhancedDescription || maintenanceIssues.join(' ');
                    const fallback = successfulResults[0]?.maintenance_issue || successfulResults[0]?.description || 'Maintenance Issue';
                    generatedTitle = buildTitleFromDescription(candidateText || fallback);
                }

                setFormData(prev => ({
                    ...prev,
                    title: generatedTitle,
                    description: aiEnhancedDescription
                }));
            }
        } catch (error) {
            console.error('Error updating description from AI:', error);
        } finally {
            setIsAutoGenerating(false);
        }
    }, [formData.images.length, aiResults, formData.description, formData.title]);

    const buildTitleFromDescription = (text: string): string => {
        if (!text) return 'Maintenance Issue';
        const sanitized = text
            .replace(/[^a-zA-Z0-9\s-]/g, '')
            .trim()
            .split(/\s+/)
            .slice(0, 6)
            .join(' ');

        if (sanitized.length === 0) return 'Maintenance Issue';

        const capitalized = sanitized[0].toUpperCase() + sanitized.slice(1);
        return capitalized.endsWith('.') ? capitalized.slice(0, -1) : capitalized;
    };

    // Effect to update description when images change
    useEffect(() => {
        updateDescriptionFromAI();
    }, [updateDescriptionFromAI]);

    // Safety check for session loading
    if (status === "loading") {
        return (
            <div className="h-full w-full flex items-center justify-center">
                <p>Loading...</p>
            </div>
        );
    }

    // Safety check for unauthenticated users
    if (!session) {
        return (
            <div className="h-full w-full flex flex-col items-center justify-center">
                <p className="text-red-500 mb-4">You must be logged in to submit a request</p>
                <button 
                    onClick={() => submitNewRequest(false)}
                    className="px-4 py-2 bg-customViolet text-white rounded"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const handleInputChange = (field: keyof MaintenanceRequest, value: string | File[]) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field as keyof Partial<MaintenanceRequest>]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Validate files
        const validFiles = files.filter(file => {
            const isValidType = file.type.startsWith('image/');
            const isValidSize = file.size <= 10 * 1024 * 1024;
            return isValidType && isValidSize;
        });

        if (validFiles.length + formData.images.length > 5) {
            alert('Maximum of 5 images allowed.');
            return;
        }

        if (validFiles.length === 0) {
            alert('No valid images found (only images under 10MB allowed).');
            return;
        }

        try {
            setLoading(true);

            // Analyze images using the enhanced analyze-image API
            const aiFormData = new FormData();
            validFiles.forEach(file => aiFormData.append('files', file));

            const aiRes = await fetch('/api/analyze-image', {
                method: 'POST',
                body: aiFormData,
            });

            if (!aiRes.ok) {
                throw new Error(`AI analysis failed: ${aiRes.status}`);
            }

            const aiData = await aiRes.json();
            const { results } = aiData;

            // Store AI results for submission and description generation
            setAiResults(prev => [...prev, ...results]);

            // Update form data with validated images
            setFormData(prev => ({
                ...prev,
                images: [...prev.images, ...validFiles]
            }));

            // Show confidence scores
            const confidenceScores = results
                .filter((r: AIAnalysisResult) => r.success && r.confidence_score)
                .map((r: AIAnalysisResult) => r.confidence_score);
            
            if (confidenceScores.length > 0) {
                const avgConfidence = (confidenceScores.reduce((a: number, b: number) => a + b, 0) / confidenceScores.length * 100).toFixed(1);
                alert(`✅ ${validFiles.length} image(s) analyzed successfully! AI Confidence: ${avgConfidence}%`);
            } else {
                alert(`✅ ${validFiles.length} image(s) analyzed successfully!`);
            }

        } catch (err: any) {
            console.error('Error uploading images:', err);
            alert(`❌ Upload failed: ${err.message}`);
            
            // Even if AI fails, still add the images but without AI analysis
            setFormData(prev => ({
                ...prev,
                images: [...prev.images, ...validFiles]
            }));
        } finally {
            setLoading(false);
        }
    };

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
        setAiResults(prev => prev.filter((_, i) => i !== index));
    };

    const validateForm = (): boolean => {
        const newErrors: Partial<MaintenanceRequest> = {};

        if (!formData.title.trim()) {
            newErrors.title = 'Title is required';
        } else if (formData.title.length < 5) {
            newErrors.title = 'Title must be at least 5 characters';
        }

        if (!formData.description.trim()) {
            newErrors.description = 'Description is required';
        } else if (formData.description.length < 10) {
            newErrors.description = 'Description must be at least 10 characters';
        }

        if (formData.images.length === 0) {
            // Fix: Create a proper error object that matches the type
            newErrors.images = [] as File[]; // This indicates there's an error with images
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validateForm()) {
            return;
        }

        if (!session?.user?.id) {
            alert('You must be logged in to submit a request');
            return;
        }

        setLoading(true);
        onSubmissionStatus?.(true);

        try {
            // Save the raw request immediately
            const rawRequest = formData.description;

            // Step 1: Process the request through AI for summarization and urgency classification
            const requestAnalysis = await fetch('/api/analyze-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    title: formData.title,
                    userText: rawRequest,
                    imageDescriptions: aiResults.filter(r => r.success).map(r => r.description)
                }),
            });

            let processedRequest = rawRequest; // fallback to original
            let urgency = 'medium'; // default urgency

            if (requestAnalysis.ok) {
                const analysisResult = await requestAnalysis.json();
                processedRequest = analysisResult.summary || rawRequest;
                urgency = getUrgencyLevel(analysisResult.urgencyLevel || 2);
            }

            // Step 2: Submit to maintenance API with optimized AI data
            const formDataToSend = new FormData();
            formDataToSend.append('title', formData.title);
            formDataToSend.append('rawRequest', rawRequest);
            formDataToSend.append('processedRequest', processedRequest);
            formDataToSend.append('urgency', urgency);
            formDataToSend.append('userId', session.user.id);

            // Include only essential AI analysis data
            if (aiResults.length > 0) {
                const essentialAiData = aiResults.map(result => ({
                    components: result.analysis?.components || [],
                    risk_level: result.analysis?.risk_level || 'medium',
                    maintenance_priority: result.analysis?.maintenance_priority || 'medium',
                }));
                
                formDataToSend.append('aiAnalysis', JSON.stringify(essentialAiData));
            }

            // Append images with unique names or as array
            formData.images.forEach((image, index) => {
                formDataToSend.append(`images`, image); // Keep same name for array handling
            });

            const response = await fetch('/api/maintenance', {
                method: 'POST',
                body: formDataToSend,
            });

            const result = await response.json();

            if (response.ok) {
                alert('Maintenance request submitted successfully!');
                setFormData({ title: '', description: '', images: [] });
                setAiResults([]);
                submitNewRequest(false);
            } else {
                alert(result.message || 'Failed to submit request');
            }
        } catch (error) {
            console.error('Error submitting request:', error);
            alert('An error occurred while submitting your request');
        } finally {
            setLoading(false);
            onSubmissionStatus?.(false);
        }
    };

    const getUrgencyLevel = (level: number): string => {
        switch (level) {
            case 1: return 'low';
            case 2: return 'medium';
            case 3: return 'high';
            case 4: return 'critical';
            default: return 'medium';
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        // Only update if not currently auto-generating from AI
        if (!isAutoGenerating) {
            handleInputChange('description', e.target.value);
        }
    };

    return (
        <div className='h-full w-full flex flex-col bg-gray-50 relative'>
            <div className='flex items-center justify-between px-6 py-6 bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-gray-100'>
                <button
                    type="button"
                    className='p-2 -ml-2 rounded-full hover:bg-gray-100 text-customViolet transition-all duration-300'
                    onClick={() => submitNewRequest(false)}
                    disabled={loading}
                >
                    <HiOutlineChevronLeft className='text-2xl' />
                </button>
                <h2 className='text-xl font-bold text-gray-800'>New Request</h2>
                <div className="w-8"></div> {/* Spacer for centering */}
            </div>

            <div className='flex-1 overflow-y-auto px-6 py-6 space-y-6'>
                {/* Title Input */}
                <div className='space-y-2'>
                    <label className='text-sm font-semibold text-gray-700 ml-1'>Title <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        className={`w-full rounded-2xl border bg-white py-4 px-5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-customViolet/20 transition-all ${
                            errors.title ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-customViolet'
                        }`}
                        placeholder="Brief title of your request"
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        disabled={loading}
                    />
                    {errors.title && (
                        <p className="text-red-500 text-xs ml-2 animate-in fade-in slide-in-from-top-1">{errors.title}</p>
                    )}
                </div>

                {/* Media Upload */}
                <div className='space-y-3'>
                    <div className="flex justify-between items-end">
                        <label className='text-sm font-semibold text-gray-700 ml-1'>Media <span className="text-red-500">*</span></label>
                        <span className="text-xs text-gray-400">Max 5 images</span>
                    </div>
                    
                    <div className='grid grid-cols-4 sm:grid-cols-5 gap-3'>
                        {/* Upload Button */}
                        <button
                            type="button"
                            className='aspect-square flex flex-col items-center justify-center rounded-[1.5rem] bg-white border-2 border-dashed border-customViolet/30 text-customViolet hover:bg-customViolet/5 hover:border-customViolet transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group'
                            onClick={triggerFileInput}
                            disabled={loading || formData.images.length >= 5}
                        >
                            <HiOutlinePlus className="text-2xl group-hover:scale-110 transition-transform" />
                        </button>

                        {/* Image Previews */}
                        {formData.images.map((image, index) => (
                            <div key={index} className="aspect-square relative group animate-in fade-in zoom-in-95 duration-300">
                                <img
                                    src={URL.createObjectURL(image)}
                                    alt={`Preview ${index + 1}`}
                                    className="w-full h-full object-cover rounded-[1.5rem] shadow-sm border border-gray-100"
                                />
                                <button
                                    type="button"
                                    className="absolute -top-2 -right-2 bg-white text-red-500 rounded-full w-6 h-6 flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-all hover:scale-110"
                                    onClick={() => removeImage(index)}
                                    disabled={loading}
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                    
                    {errors.images && (
                        <p className="text-red-500 text-xs ml-2 animate-in fade-in slide-in-from-top-1">At least one image is required</p>
                    )}

                    {/* AI Status Indicator */}
                    {formData.images.length > 0 && (
                        <div className={`text-xs px-4 py-2 rounded-[1.5rem] flex items-center gap-2 ${
                            isAutoGenerating || loading ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                            {isAutoGenerating || loading ? (
                                <>
                                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                    Analyzing images...
                                </>
                            ) : (
                                <>
                                    <span className="w-2 h-2 rounded-full bg-current"></span>
                                    Analysis complete
                                </>
                            )}
                        </div>
                    )}

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        multiple
                        className="hidden"
                        disabled={loading || formData.images.length >= 5}
                    />
                </div>

                {/* Description Textarea */}
                <div className='space-y-2'>
                    <label className='text-sm font-semibold text-gray-700 ml-1'>Description</label>
                    <div className="relative">
                        <textarea
                            className={`w-full min-h-[200px] rounded-[1.5rem] border bg-white py-4 px-5 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-customViolet/20 transition-all resize-none ${
                                errors.description ? 'border-red-300 focus:border-red-500' : 'border-gray-200 focus:border-customViolet'
                            } ${isAutoGenerating ? 'opacity-70' : ''}`}
                            placeholder={
                                formData.images.length === 0 
                                    ? "Describe your concern in detail..."
                                    : "AI will automatically generate description based on your images..."
                            }
                            value={formData.description}
                            onChange={handleDescriptionChange}
                            disabled={loading}
                        />
                        {isAutoGenerating && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-[1px] rounded-[1.5rem]">
                                <div className="flex items-center gap-2 text-customViolet font-medium text-sm">
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                    Generating description...
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {errors.description && (
                        <p className="text-red-500 text-xs ml-2 animate-in fade-in slide-in-from-top-1">{errors.description}</p>
                    )}
                    
                    <p className="text-xs text-gray-400 ml-2">
                        {formData.images.length > 0 
                            ? "Co-Living AI enhances your description based on image analysis."
                            : "Add images to get AI-powered description suggestions."
                        }
                    </p>
                </div>
            </div>

            {/* Submit Button */}
            <div className='p-6 bg-white border-t border-gray-100'>
                <button
                    type="button"
                    className='w-full py-4 bg-customViolet text-white text-lg font-semibold rounded-[1.5rem] shadow-lg shadow-customViolet/30 hover:shadow-customViolet/40 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2'
                    onClick={handleSubmit}
                    disabled={loading || isAutoGenerating}
                >
                    {loading ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            Submitting...
                        </>
                    ) : isAutoGenerating ? (
                        <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            AI Processing...
                        </>
                    ) : (
                        'Submit Request'
                    )}
                </button>
            </div>
        </div>
    )
}

export default SubmitNewRequest;