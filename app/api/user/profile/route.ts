import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    const user = await prisma.users.findUnique({
      where: { userID: userId },
      include: {
        property: {
          select: {
            name: true,
            rent: true,
            address: true
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get ALL user's images from Resource table using referenceType = "Users" and referenceId = userID
    const resources = await prisma.resource.findMany({
      where: {
        referenceId: userId,
        referenceType: "Users"
      },
      orderBy: {
        createdAt: 'asc' // Get in creation order
      }
    });

    // First image is profile picture, next two are credentials
    const profilePicture = resources[0]?.url || null;
    const credentialImages = resources.slice(1, 3); // Get images 2 and 3

    // Calculate residency period
    let residencyPeriod = '0 yrs';
    if (user.created_at) {
      const createdDate = new Date(user.created_at);
      const now = new Date();
      const diffYears = now.getFullYear() - createdDate.getFullYear();
      residencyPeriod = `${diffYears} yrs`;
    }

    // Calculate age from birthday
    let age: number | undefined;
    if (user.bday) {
      const birthDate = new Date(user.bday);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    const userData = {
      id: user.userID,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      middleInitial: user.middleInitial,
      sex: user.sex,
      bday: user.bday ? new Date(user.bday).toISOString().split('T')[0] : null,
      age: age,
      email: user.email,
      firstNumber: user.firstNumber,
      secondNumber: user.secondNumber,
      unit: user.property?.name || 'Unit 101',
      rent: user.property?.rent ? `₱${user.property.rent.toLocaleString()}` : '₱2,500.00',
      residencyPeriod: residencyPeriod,
      profilePicture: profilePicture,
      credentialImages: credentialImages.map(img => ({
        url: img.url,
        fileName: img.fileName,
        resourceId: img.resourceId
      })),
      allImages: resources, // Keep all images for reference
      created_at: user.created_at
    };

    return NextResponse.json(userData);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      middleInitial,
      sex,
      bday,
      email,
      firstNumber,
      secondNumber
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return NextResponse.json(
        { error: 'First name, last name, and email are required' },
        { status: 400 }
      );
    }

    // Calculate age from birthday
    let age: number | undefined;
    if (bday) {
      const birthDate = new Date(bday);
      const today = new Date();
      age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
    }

    const updatedUser = await prisma.users.update({
      where: { userID: parseInt(session.user.id) },
      data: {
        firstName,
        lastName,
        middleInitial,
        sex,
        bday: bday ? new Date(bday) : null,
        email,
        firstNumber,
        secondNumber
      },
      include: {
        property: {
          select: {
            name: true,
            rent: true
          }
        }
      }
    });

    // Get ALL updated resources
    const resources = await prisma.resource.findMany({
      where: {
        referenceId: parseInt(session.user.id),
        referenceType: "Users"
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    const profilePicture = resources[0]?.url || null;
    const credentialImages = resources.slice(1, 3);

    // Calculate residency period
    let residencyPeriod = '0 yrs';
    if (updatedUser.created_at) {
      const createdDate = new Date(updatedUser.created_at);
      const now = new Date();
      const diffYears = now.getFullYear() - createdDate.getFullYear();
      residencyPeriod = `${diffYears} yrs`;
    }

    const userData = {
      id: updatedUser.userID,
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      middleInitial: updatedUser.middleInitial,
      sex: updatedUser.sex,
      bday: updatedUser.bday ? new Date(updatedUser.bday).toISOString().split('T')[0] : null,
      age: age,
      email: updatedUser.email,
      firstNumber: updatedUser.firstNumber,
      secondNumber: updatedUser.secondNumber,
      unit: updatedUser.property?.name || 'Unit 101',
      rent: updatedUser.property?.rent ? `₱${updatedUser.property.rent.toLocaleString()}` : '₱2,500.00',
      residencyPeriod: residencyPeriod,
      profilePicture: profilePicture,
      credentialImages: credentialImages.map(img => ({
        url: img.url,
        fileName: img.fileName,
        resourceId: img.resourceId
      }))
    };

    return NextResponse.json(userData);
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}