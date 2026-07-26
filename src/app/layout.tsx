import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Treatment Tech",
  description: "Plataforma clínica y administrativa para programas DUI/SUD.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
