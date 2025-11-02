import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route'; // Updated import path
import { PrismaClient } from '@prisma/client';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { message: 'Unauthorized' },
                { status: 401 }
            );
        }

        const formData = await request.formData();
        
        // Extract form data
        const title = formData.get('title') as string;
        const description = formData.get('description') as string;
        const userId = formData.get('userId') as string;
        const images = formData.getAll('images') as File[];

        // Validation
        if (!title || !description || images.length === 0) {
            return NextResponse.json(
                { message: 'All fields are required including at least one image' },
                { status: 400 }
            );
        }

        if (title.length < 5) {
            return NextResponse.json(
                { message: 'Title must be at least 5 characters long' },
                { status: 400 }
            );
        }

        if (description.length < 10) {
            return NextResponse.json(
                { message: 'Description must be at least 10 characters long' },
                { status: 400 }
            );
        }

        if (images.length > 5) {
            return NextResponse.json(
                { message: 'Maximum 5 images allowed' },
                { status: 400 }
            );
        }

        // Validate file types and sizes
        for (const image of images) {
            if (!image.type.startsWith('image/') && !image.type.startsWith('video/')) {
                return NextResponse.json(
                    { message: 'Only image and video files are allowed' },
                    { status: 400 }
                );
            }

            if (image.size > 10 * 1024 * 1024) { // 10MB
                return NextResponse.json(
                    { message: 'File size must be less than 10MB' },
                    { status: 400 }
                );
            }
        }

        // Get user's property
        const user = await prisma.users.findUnique({
            where: { userID: parseInt(userId) },
            include: { property: true }
        });

        if (!user || !user.propertyId) {
            return NextResponse.json(
                { message: 'User property not found' },
                { status: 400 }
            );
        }

        // Create maintenance record
        const maintenance = await prisma.maintenance.create({
            data: {
                userID: parseInt(userId),
                propertyId: user.propertyId,
                rawRequest: description,
                processedRequest: description, // Initially same as raw request
                status: 'pending',
                dateIssued: new Date(),
            }
        });

        // Handle file uploads
        const uploadedFiles: string[] = [];

        for (const image of images) {
            const bytes = await image.arrayBuffer();
            const buffer = Buffer.from(bytes);

            // Create uploads directory if it doesn't exist
            const uploadsDir = join(process.cwd(), 'public', 'uploads', 'maintenance');
            if (!existsSync(uploadsDir)) {
                await mkdir(uploadsDir, { recursive: true });
            }

            // Generate unique filename
            const timestamp = Date.now();
            const fileExtension = image.name.split('.').pop();
            const fileName = `maintenance_${maintenance.maintenanceID}_${timestamp}_${Math.random().toString(36).substring(7)}.${fileExtension}`;
            const filePath = join(uploadsDir, fileName);

            // Save file
            await writeFile(filePath, buffer);

            // Create resource record
            const resource = await prisma.resource.create({
                data: {
                    referenceId: maintenance.maintenanceID,
                    referenceType: 'Maintenance',
                    url: `/uploads/maintenance/${fileName}`,
                    fileName: image.name,
                }
            });

            uploadedFiles.push(resource.url);
        }

        // Create documentation record
        await prisma.documentation.create({
            data: {
                maintenanceID: maintenance.maintenanceID,
                documentation: JSON.stringify({
                    uploadedFiles,
                    originalFilenames: images.map(img => img.name)
                }),
                dateIssued: new Date(),
            }
        });

        return NextResponse.json({
            message: 'Maintenance request submitted successfully',
            maintenanceId: maintenance.maintenanceID
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating maintenance request:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(
                { message: 'Unauthorized' },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId') || session.user.id;

        const maintenanceRequests = await prisma.maintenance.findMany({
            where: {
                userID: parseInt(userId as string)
            },
            include: {
                property: true,
                documentations: true
            },
            orderBy: {
                dateIssued: 'desc'
            }
        });

        return NextResponse.json({ maintenanceRequests });
    } catch (error) {
        console.error('Error fetching maintenance requests:', error);
        return NextResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
        );
    }
}