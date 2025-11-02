import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const prisma = new PrismaClient();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const userId = parseInt(session.user.id);
    const partnerId = parseInt(resolvedParams.partnerId);

    if (isNaN(partnerId)) {
      return NextResponse.json({ error: 'Invalid partner ID' }, { status: 400 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const all = searchParams.get('all') === 'true';
    const skip = (page - 1) * limit;

    // Handle all messages request (for MessageInfo component)
    if (all) {
      console.log('working...')
      const allMessages = await prisma.messages.findMany({
        where: {
          OR: [
            { senderID: userId, receiverID: partnerId },
            { senderID: partnerId, receiverID: userId }
          ]
        },
        include: {
          sender: {
            select: {
              userID: true,
              firstName: true,
              lastName: true,
              role: true
            }
          },
          receiver: {
            select: {
              userID: true,
              firstName: true,
              lastName: true,
              role: true
            }
          }
        },
        orderBy: {
          dateSent: 'desc'
        }
      });

      const formattedMessages = allMessages.map(message => ({
        messageID: message.messageID,
        senderID: message.senderID,
        receiverID: message.receiverID,
        message: message.message,
        dateSent: message.dateSent.toISOString(),
        read: message.read,
        sender: message.sender,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileType: message.fileType,
        fileSize: message.fileSize ? parseInt(message.fileSize) : null
      }));

      return NextResponse.json({
        messages: formattedMessages,
        totalCount: allMessages.length
      });
    }

    // Get total count for pagination
    const totalCount = await prisma.messages.count({
      where: {
        OR: [
          { senderID: userId, receiverID: partnerId },
          { senderID: partnerId, receiverID: userId }
        ]
      }
    });

    // Get messages with pagination
    const messages = await prisma.messages.findMany({
      where: {
        OR: [
          { senderID: userId, receiverID: partnerId },
          { senderID: partnerId, receiverID: userId }
        ]
      },
      include: {
        sender: {
          select: {
            userID: true,
            firstName: true,
            lastName: true,
            role: true
          }
        },
        receiver: {
          select: {
            userID: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      },
      orderBy: {
        dateSent: 'desc' // Newest first for pagination
      },
      skip,
      take: limit
    });

    // Format messages (oldest first for display)
    const formattedMessages = messages.reverse().map(message => ({
      messageID: message.messageID,
      senderID: message.senderID,
      receiverID: message.receiverID,
      message: message.message,
      dateSent: message.dateSent.toISOString(),
      read: message.read,
      sender: message.sender,
      fileUrl: message.fileUrl,
      fileName: message.fileName,
      fileType: message.fileType,
      fileSize: message.fileSize ? parseInt(message.fileSize) : null
    }));

    const hasMore = totalCount > skip + limit;

    return NextResponse.json({
      messages: formattedMessages,
      hasMore,
      totalCount
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}