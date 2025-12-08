import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { broadcastToUser } from '../events/route';

const prisma = new PrismaClient();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;
const GITHUB_USERNAME = process.env.GITHUB_USERNAME!;
const GITHUB_REPO = process.env.GITHUB_REPO!;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { receiverID, message, file } = await request.json();

    if (!file || !receiverID) {
      return NextResponse.json(
        { error: 'File and receiver ID are required' },
        { status: 400 }
      );
    }

    if (!file.name || !file.content) {
      return NextResponse.json(
        { error: 'Invalid file data: missing name or content' },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const originalName = String(file.name).replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${originalName}`;
    const folderName = `messages/${session.user.id}`;
    const filePath = `${folderName}/${fileName}`;

    const githubApiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`;

    const githubResponse = await fetch(githubApiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Upload message file: ${fileName}`,
        content: String(file.content).replace(/\s/g, ''),
        branch: GITHUB_BRANCH,
      }),
    });

    const githubData = await githubResponse.json();

    if (!githubResponse.ok) {
      console.error('GitHub upload failed:', githubData);
      return NextResponse.json(
        { error: githubData?.message || `Failed to upload ${file.name} to GitHub.` },
        { status: 500 }
      );
    }

    const fileUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}/${filePath}`;

    const newMessage = await prisma.messages.create({
      data: {
        senderID: parseInt(session.user.id),
        receiverID: parseInt(receiverID),
        message: message || null,
        fileUrl: fileUrl,
        fileName: file.name,
        fileType: file.type || null,
        fileSize: file.size ? String(file.size) : null,
        dateSent: new Date(),
        read: false,
      },
      include: {
        sender: {
          select: {
            userID: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        receiver: {
          select: {
            userID: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });

    // Broadcast the new message to the receiver
    const messageData = {
      ...newMessage,
      files: newMessage.fileUrl ? [{
        url: newMessage.fileUrl,
        fileName: newMessage.fileName,
        fileType: newMessage.fileType,
        fileSize: newMessage.fileSize
      }] : []
    };

    broadcastToUser(receiverID.toString(), {
      type: 'new_message',
      data: messageData,
      senderID: session.user.id,
      receiverID: receiverID
    });

    return NextResponse.json({
      success: true,
      message: newMessage,
      fileUrl,
    });
  } catch (error) {
    console.error('Error uploading file in tenant messages/upload:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
