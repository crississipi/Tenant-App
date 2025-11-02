import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const prisma = new PrismaClient();

// GET /api/users - Get all users with landlord role (excluding current user)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ Only fetch users with landlord role
    const users = await prisma.users.findMany({
      where: {
        userID: {
          not: parseInt(session.user.id)
        },
        role: 'landlord' // Only get landlords
      },
      select: {
        userID: true,
        firstName: true,
        lastName: true,
        isOnline: true,
        role: true
      },
      orderBy: {
        firstName: 'asc'
      }
    });

    const usersWithFullName = users.map(user => ({
      ...user,
      name: `${user.firstName} ${user.lastName}`
    }));

    return NextResponse.json(usersWithFullName);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}