import './globals.css'

export const metadata = {
  title: 'VEFILM Character Sheet Generator',
  description: 'AI-powered character consistency sheet generator by Pedro Feria Pino',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
