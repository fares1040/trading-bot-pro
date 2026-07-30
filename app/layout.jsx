// app/layout.jsx
export const metadata = {
  title: 'منصة سنايبر | Trading Bot Pro',
  description: 'منصة رصد تدفق السيولة والفرص في السوق الأمريكي',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'سنايبر',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
      </body>
    </html>
  );
}
