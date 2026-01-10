import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET: Fetch all notifications for the current user (tenant or landlord)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';

    // Fetch notifications for the user, ordered by createdAt desc
    const notifications = await prisma.notification.findMany({
      where: { 
        userId,
        ...(unreadOnly ? { isRead: false } : {})
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    // Check if user has no notifications
    if (notifications.length === 0) {
      return NextResponse.json({
        success: true,
        notifications: [],
        unreadCount: 0,
        message: 'No notifications yet. You\'re all caught up!'
      });
    }

    // Format notifications for frontend
    const formattedNotifications = notifications.map(n => ({
      notificationId: n.notificationId,
      type: n.type,
      message: n.message,
      relatedId: n.relatedId,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
      date: new Date(n.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
      }) + ' • ' + new Date(n.createdAt).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }));

    // Get unread count
    const unreadCount = await prisma.notification.count({
      where: { 
        userId,
        isRead: false 
      }
    });

    return NextResponse.json({
      success: true,
      notifications: formattedNotifications,
      unreadCount
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Mark notification(s) as read
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const body = await request.json();
    const { notificationId, markAllAsRead } = body;

    if (markAllAsRead) {
      // Mark all notifications as read for this user
      await prisma.notification.updateMany({
        where: { 
          userId,
          isRead: false 
        },
        data: { isRead: true }
      });

      return NextResponse.json({ 
        success: true, 
        message: 'All notifications marked as read' 
      });
    }

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    // Mark specific notification as read (ensure it belongs to the user)
    const notification = await prisma.notification.findFirst({
      where: { 
        notificationId: parseInt(notificationId),
        userId 
      }
    });

    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      );
    }

    await prisma.notification.update({
      where: { notificationId: parseInt(notificationId) },
      data: { isRead: true }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Notification marked as read' 
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a notification or clear all read notifications
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get('notificationId');
    const clearRead = searchParams.get('clearRead') === 'true';

    if (clearRead) {
      // Delete all read notifications for this user
      await prisma.notification.deleteMany({
        where: { 
          userId,
          isRead: true 
        }
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Read notifications cleared' 
      });
    }

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    // Delete specific notification (ensure it belongs to the user)
    const notification = await prisma.notification.findFirst({
      where: { 
        notificationId: parseInt(notificationId),
        userId 
      }
    });

    if (!notification) {
      return NextResponse.json(
        { success: false, error: 'Notification not found' },
        { status: 404 }
      );
    }

    await prisma.notification.delete({
      where: { notificationId: parseInt(notificationId) }
    });

    return NextResponse.json({ 
      success: true, 
      message: 'Notification deleted' 
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
