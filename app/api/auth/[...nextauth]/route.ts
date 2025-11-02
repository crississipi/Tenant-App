import NextAuth, { AuthOptions, DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { JWT } from "next-auth/jwt";
import { Session } from "next-auth";

const prisma = new PrismaClient();

// Extend the built-in session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      firstName: string | null;
      lastName: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
    firstName: string | null;
    lastName: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user?: {
      id: string;
      name?: string | null;
      role: string;
      firstName: string | null;
      lastName: string | null;
    };
  }
}

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.username || !credentials?.password) return null;

          const user = await prisma.users.findUnique({
            where: { username: credentials.username },
          });

          if (!user) return null;

          const isValid = await bcrypt.compare(credentials.password, user.password);
          if (!isValid) return null;

          // Return user object with firstName and lastName
          return { 
            id: user.userID.toString(), 
            name: user.username,
            email: user.email || undefined,
            role: user.role,
            firstName: user.firstName || null,
            lastName: user.lastName || null,
          };
        } catch (err) {
          console.error("Error in authorize:", err);
          return null;
        }
      }
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      },
    },
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: any }) {
      // Add user data to token on initial sign in
      if (user) {
        token.user = {
          id: user.id,
          name: user.name,
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      // Add user data from token to session
      if (token.user) {
        session.user = {
          ...session.user,
          id: token.user.id,
          role: token.user.role,
          firstName: token.user.firstName,
          lastName: token.user.lastName,
        };
      }
      return session;
    },
    async redirect({ url, baseUrl }: { url: string; baseUrl: string }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };