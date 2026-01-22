import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import Providers from "./api/providers";
import OnlineStatusTracker from "./components/OnlineStatusTracker";

const poppins = Poppins({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Co-Living for Tenant",
  description: "Web App for Tenants",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${poppins} antialiased h-[100vh] w-[100vw] flex`}
      >
        <Providers> {/* Wrap with SessionProvider */}
          <OnlineStatusTracker />
          {children}
        </Providers>
      </body>
    </html>
  );
}
