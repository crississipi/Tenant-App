// lib/notifications.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export type NotificationType = 
  | 'billing_created'
  | 'billing_reminder'
  | 'payment_received'
  | 'maintenance_request'
  | 'maintenance_fixed'
  | 'urgent_maintenance'
  | 'message_received';

interface CreateNotificationParams {
  userId: number;
  type: NotificationType;
  message: string;
  relatedId?: number;
}

/**
 * Create a notification for a user
 */
export async function createNotification({
  userId,
  type,
  message,
  relatedId
}: CreateNotificationParams) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        message,
        relatedId,
        isRead: false
      }
    });
    
    return { success: true, notification };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error };
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(notificationId: number) {
  try {
    await prisma.notification.update({
      where: { notificationId },
      data: { isRead: true }
    });
    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error };
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: number) {
  try {
    await prisma.notification.updateMany({
      where: { 
        userId,
        isRead: false 
      },
      data: { isRead: true }
    });
    return { success: true };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return { success: false, error };
  }
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadNotificationCount(userId: number) {
  try {
    const count = await prisma.notification.count({
      where: { 
        userId,
        isRead: false 
      }
    });
    return { success: true, count };
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return { success: false, count: 0, error };
  }
}
