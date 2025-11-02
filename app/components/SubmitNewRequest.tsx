import React, { useState, useRef } from 'react'
import { HiOutlineChevronLeft } from 'react-icons/hi';
import { HiOutlinePlus } from 'react-icons/hi2';
import { useSession } from 'next-auth/react';

interface SubmitProps {
    submitNewRequest: (newRequest: boolean) => void;
}

interface MaintenanceRequest {
    title: string;
    description: string;
    images: File[];
}

const SubmitNewRequest = ({ submitNewRequest }: SubmitProps) => {
    const { data: session, status } = useSession();
    const [formData, setFormData] = useState<MaintenanceRequest>({
        title: '',
        description: '',
        images: []
    });
    const [errors, setErrors] = useState<Partial<MaintenanceRequest>>({});
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    // ... rest of your component code remains the same
    const handleInputChange = (field: keyof MaintenanceRequest, value: string | File[]) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field as keyof Partial<MaintenanceRequest>]) {
            setErrors(prev => ({ ...prev, [field]: undefined }));
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const validFiles = files.filter(file => {
            const isValidType = file.type.startsWith('image/') || file.type.startsWith('video/');
            const isValidSize = file.size <= 10 * 1024 * 1024;
            return isValidType && isValidSize;
        });

        if (validFiles.length + formData.images.length > 5) {
            alert('Maximum 5 files allowed');
            return;
        }

        setFormData(prev => ({
            ...prev,
            images: [...prev.images, ...validFiles]
        }));
    };

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
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
            newErrors.images = ['At least one image is required'] as any;
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

        try {
            const formDataToSend = new FormData();
            formDataToSend.append('title', formData.title);
            formDataToSend.append('description', formData.description);
            formDataToSend.append('userId', session.user.id);

            formData.images.forEach((image) => {
                formDataToSend.append(`images`, image);
            });

            const response = await fetch('/api/maintenance', {
                method: 'POST',
                body: formDataToSend,
            });

            const result = await response.json();

            if (response.ok) {
                alert('Maintenance request submitted successfully!');
                setFormData({ title: '', description: '', images: [] });
                submitNewRequest(false);
            } else {
                alert(result.message || 'Failed to submit request');
            }
        } catch (error) {
            console.error('Error submitting request:', error);
            alert('An error occurred while submitting your request');
        } finally {
            setLoading(false);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
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

                {/* Description Textarea */}
                <span className='w-full flex flex-col gap-1'>
                    <h3 className='font-light'>Description *</h3>
                    <textarea
                        className={`resize-none border rounded-lg py-3 px-5 min-h-40 font-medium ${
                            errors.description ? 'border-red-500' : 'border-customViolet/50'
                        }`}
                        placeholder="Describe your concern in detail..."
                        value={formData.description}
                        onChange={(e) => handleInputChange('description', e.target.value)}
                        disabled={loading}
                    />
                    {errors.description && (
                        <p className="text-red-500 text-sm">{errors.description}</p>
                    )}
                </span>

                {/* Media Upload */}
                <div className='w-full flex flex-col mt-5'>
                    <h3 className='font-medium text-lg'>Media *</h3>
                    <p className='font-light'>Attach images or videos of the stated issue (max 5 files, 10MB each).</p>
                    
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

                        {/* Image Previews */}
                        {formData.images.map((image, index) => (
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
                        ))}

                        {/* Empty slots */}
                        {Array.from({ length: 5 - formData.images.length - 1 }).map((_, index) => (
                            <div key={`empty-${index}`} className="col-span-1 h-16 aspect-square bg-neutral-100 rounded-lg border-2 border-dashed border-gray-300" />
                        ))}
                    </div>

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*,video/*"
                        multiple
                        className="hidden"
                        disabled={loading || formData.images.length >= 5}
                    />
                </div>

                {/* Submit Button */}
                <div className='mt-auto w-full'>
                    <button
                        type="button"
                        className='w-full rounded-lg bg-customViolet/30 py-3 text-customViolet text-lg hover:bg-customViolet/70 focus:bg-customViolet focus:text-white ease-out duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? 'Submitting...' : 'Submit Request'}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default SubmitNewRequest;