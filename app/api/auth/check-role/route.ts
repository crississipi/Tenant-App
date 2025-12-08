import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const LANDLORD_APP_URL = process.env.NEXT_PUBLIC_LANDLORD_APP_URL || "http://localhost:3000";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const user = await prisma.users.findUnique({
      where: { username },
      select: {
        userID: true,
        username: true,
        password: true,
        role: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const role = user.role?.toLowerCase();

    if (role === 'tenant') {
      return NextResponse.json({
        success: true,
        allowLogin: true,
        role: user.role,
        user: {
          id: user.userID,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      });
    } else if (role === 'landlord' || role === 'admin') {
      return NextResponse.json({
        success: true,
        allowLogin: false,
        role: user.role,
        redirectUrl: LANDLORD_APP_URL,
        message: 'This account is for landlords or admins. Redirecting to landlord portal...',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Account role not recognized' },
        { status: 403 }
      );
    }
  } catch (error) {
    console.error('Error checking user role (tenant app):', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred while checking credentials' },
      { status: 500 }
    );
  }
}
