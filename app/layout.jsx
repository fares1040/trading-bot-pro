import PwaRegister from '@/components/PwaRegister';

export const metadata = {
  title: 'HUNTER AI | Intelligence Command Center',
  description: 'منصة استخبارات ورادار فرص الأسهم والخيارات',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HUNTER AI',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
