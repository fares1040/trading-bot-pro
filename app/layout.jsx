export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ backgroundColor: '#000', color: '#fff', margin: 0, fontFamily: 'sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
