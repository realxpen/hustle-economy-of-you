import type { Metadata } from "next";
import { AdminAccessGate, AdminAuthProvider } from "../components/admin-auth-provider";
import "./globals.css";

export const metadata: Metadata = { title: "Hustle Admin" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>
    <AdminAuthProvider><AdminAccessGate>{children}</AdminAccessGate></AdminAuthProvider>
  </body></html>;
}
