import React, { useState, useRef, useEffect } from 'react'
import { HiOutlineChevronLeft } from 'react-icons/hi';
import { HiOutlinePlus } from 'react-icons/hi2';
import { useSession } from 'next-auth/react';

interface SubmitProps {
    submitNewRequest: (newRequest: boolean) => void;
    onSubmissionStatus?: (submitting: boolean) => void;
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

const SubmitNewRequest = ({ submitNewRequest, onSubmissionStatus }: SubmitProps) => {
    const { data: session, status } = useSession();
    const [formData, setFormData] = useState<MaintenanceRequest>({
        title: '',
        description: '',
        images: []
    });
    const [errors, setErrors] = useState<Partial<MaintenanceRequest>>({});
    const [loading, setLoading] = useState(false);
    const [aiResults, setAiResults] = useState<AIAnalysisResult[]>([]);
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Effect to update description when images change
    useEffect(() => {
        updateDescriptionFromAI();
    }, [aiResults, formData.images.length]);

    const updateDescriptionFromAI = async () => {
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
    };

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
        <div className='h-full w-full flex flex-col relative'>
            <div className='flex items-center justify-between px-5 pr-3 pt-3 pb-2 overflow-hidden mb-2'>
                <button
                    type="button"
                    className='text-3xl pr-1 font-bold hover:text-[#8884d8] focus:text-[#8884d8] ease-out duration-200'
                    onClick={() => submitNewRequest(false)}
                    disabled={loading}
                >
                    <HiOutlineChevronLeft />
                </button>
                <h2 className='text-xl font-medium w-full'>Submit New Request</h2>
            </div>
            <div className='h-full w-full flex flex-col gap-3 px-5 pb-5'>
                {/* Title Input */}
                <span className='w-full flex flex-col gap-1'>
                    <h3 className='font-light'>Title *</h3>
                    <input
                        type="text"
                        className={`w-full rounded-lg border py-3 px-5 font-medium ${
                            errors.title ? 'border-red-500' : 'border-customViolet/50'
                        }`}
                        placeholder="Brief title of your request"
                        value={formData.title}
                        onChange={(e) => handleInputChange('title', e.target.value)}
                        disabled={loading}
                    />
                    {errors.title && (
                        <p className="text-red-500 text-sm">{errors.title}</p>
                    )}
                </span>

                {/* Media Upload */}
                <div className='w-full flex flex-col mt-5'>
                    <h3 className='font-medium text-lg'>Media *</h3>
                    <p className='font-light'>Attach images of the stated issue (max 5 files, 10MB each). AI will automatically analyze images.</p>
                    
                    {errors.images && (
                        <p className="text-red-500 text-sm mt-1">At least one image is required</p>
                    )}
                    
                    <div className='grid grid-cols-5 w-full gap-3 mt-3'>
                        {/* Upload Button */}
                        <button
                            type="button"
                            className='col-span-1 h-16 aspect-square flex items-center justify-center rounded-lg bg-customViolet/30 text-white text-3xl ring-0 ring-[#8884d8] hover:bg-customViolet/70 focus:ring-4 focus:bg-customViolet ease-out duration-200 disabled:opacity-50'
                            onClick={triggerFileInput}
                            disabled={loading || formData.images.length >= 5}
                        >
                            <HiOutlinePlus />
                        </button>

                        {/* Image Previews with AI Confidence Badges */}
                        {formData.images.map((image, index) => {                      
                            return (
                                <div key={index} className="col-span-1 h-16 aspect-square bg-neutral-100 rounded-lg relative group">
                                    <img
                                        src={URL.createObjectURL(image)}
                                        alt={`Preview ${index + 1}`}
                                        className="w-full h-full object-cover rounded-lg"
                                    />
                                    <button
                                        type="button"
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => removeImage(index)}
                                        disabled={loading}
                                    >
                                        ×
                                    </button>
                                </div>
                            );
                        })}

                        {/* Empty slots */}
                        {Array.from({ length: 5 - formData.images.length - 1 }).map((_, index) => (
                            <div key={`empty-${index}`} className="col-span-1 h-16 aspect-square bg-neutral-100 rounded-lg border-2 border-dashed border-gray-300" />
                        ))}
                    </div>

                    {/* AI Status Indicator */}
                    {formData.images.length > 0 && (
                        <div className="mt-2 text-sm text-gray-600">
                            {isAutoGenerating || loading ? (
                                <span className="text-blue-600">Analyzing images and updating description...</span>
                            ) : (
                                <span className="text-green-600">Analysis complete</span>
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
                <span className='w-full flex flex-col gap-1 mt-5'>
                    <textarea
                        className={`resize-none border rounded-lg py-3 px-5 min-h-52 font-medium ${
                            errors.description ? 'border-red-500' : 'border-customViolet/50'
                        } ${isAutoGenerating ? 'bg-gray-100' : ''}`}
                        placeholder={
                            formData.images.length === 0 
                                ? "Describe your concern in detail..."
                                : "AI will automatically generate description based on your images. You can modify or add details..."
                        }
                        value={formData.description}
                        onChange={handleDescriptionChange}
                        disabled={loading}
                    />
                    {errors.description && (
                        <p className="text-red-500 text-sm">{errors.description}</p>
                    )}
                    
                    {/* Description Help Text */}
                    <div className="text-xs text-gray-500">
                        {formData.images.length > 0 ? (
                            <span>
                                Co-Living AI will automatically enhance your description based on image analysis. 
                                You can edit the generated text or add more details.
                            </span>
                        ) : (
                            <span>
                                Add images first to get AI-powered description suggestions.
                            </span>
                        )}
                    </div>
                </span>

                {/* Submit Button */}
                <div className='mt-auto w-full'>
                    <button
                        type="button"
                        className='w-full rounded-lg bg-customViolet/30 py-3 text-customViolet text-lg hover:bg-customViolet/70 focus:bg-customViolet focus:text-white ease-out duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
                        onClick={handleSubmit}
                        disabled={loading || isAutoGenerating}
                    >
                        {loading ? 'Submitting...' : 
                         isAutoGenerating ? 'AI Processing...' : 
                         'Submit Request'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default SubmitNewRequest;