import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { isOnline } = body;

    if (typeof isOnline !== 'boolean') {
      return NextResponse.json({ message: 'Invalid status value' }, { status: 400 });
    }

    // Update user's online status
    await prisma.users.update({
      where: { userID: parseInt(session.user.id) },
      data: { isOnline }
    });

    return NextResponse.json({ 
      message: 'Status updated successfully',
      isOnline 
    });
    
  } catch (error) {
    console.error('Status update error:', error);
    return NextResponse.json(
      { error: 'Internal server error during status update' },
      { status: 500 }
    );
  }
}
