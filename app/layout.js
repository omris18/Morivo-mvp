export const metadata = {
  title: "Morivo",
  description: "Experience Operating System",
  applicationName: "Morivo",
  icons: { icon: "/morivo-icon.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Morivo" },
  other: { "mobile-web-app-capable": "yes" },
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#faf6ed",
};
import "./globals.css";
import "./morivo-refinement.css";
import "./experience-guidance.css";
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
