export const metadata = {
  title: "Morivo MVP",
  description: "Experience Operating System",
  applicationName: "Morivo",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Morivo" },
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#050b13",
};
import "./globals.css";
export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
