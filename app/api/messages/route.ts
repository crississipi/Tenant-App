import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const prisma = new PrismaClient();

// GET /api/messages - Get all conversations for the current user with landlords only
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    // Get all unique conversations with landlords only
    const conversations = await prisma.messages.findMany({
      where: {
        OR: [
          { senderID: userId },
          { receiverID: userId }
        ]
      },
      include: {
        sender: {
          select: {
            userID: true,
            firstName: true,
            lastName: true,
            isOnline: true,
            role: true // Include role to filter
          }
        },
        receiver: {
          select: {
            userID: true,
            firstName: true,
            lastName: true,
            isOnline: true,
            role: true // Include role to filter
          }
        }
      },
      orderBy: {
        dateSent: 'desc'
      }
    });

    // Filter conversations to only include landlords and group by conversation partner
    const conversationMap = new Map();
    
    conversations.forEach(message => {
      // Determine who is the partner (the other person in the conversation)
      const partnerId = message.senderID === userId ? message.receiverID : message.senderID;
      const partner = message.senderID === userId ? message.receiver : message.sender;
      
      // ✅ Only include conversations with landlords
      if (partner.role === 'landlord') {
        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            partner: {
              userID: partner.userID,
              name: `${partner.firstName} ${partner.lastName}`,
              isOnline: partner.isOnline,
              role: partner.role
            },
            lastMessage: message.fileUrl 
              ? `Sent a file: ${message.fileName}` 
              : message.message,
            timestamp: message.dateSent,
            unreadCount: 0,
            lastMessageSender: message.senderID === userId ? 'You' : partner.firstName
          });
        }
      }
    });

    // Count unread messages for each conversation with landlords
    for (const [partnerId, conversation] of conversationMap) {
      const unreadCount = await prisma.messages.count({
        where: {
          senderID: partnerId,
          receiverID: userId,
          read: false
        }
      });
      
      conversation.unreadCount = unreadCount;
      conversationMap.set(partnerId, conversation);
    }

    const conversationList = Array.from(conversationMap.values());

    return NextResponse.json(conversationList);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/messages - Send a new message (with optional file)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { receiverID, message, fileUrl, fileName, fileType, fileSize } = await request.json();
    
    // Validate that either message or file is provided
    if (!receiverID || (!message && !fileUrl)) {
      return NextResponse.json(
        { error: 'Receiver ID and either message or file are required' },
        { status: 400 }
      );
    }

    // Validate file data if file is provided
    if (fileUrl && !fileName) {
      return NextResponse.json(
        { error: 'File name is required when file URL is provided' },
        { status: 400 }
      );
    }

    const newMessage = await prisma.messages.create({
      data: {
        senderID: parseInt(session.user.id),
        receiverID: parseInt(receiverID),
        message: message || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
        fileSize: fileSize ? fileSize.toString() : null,
        dateSent: new Date(),
        read: false
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
      }
    });

    return NextResponse.json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}