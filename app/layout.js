import './globals.css'

export const metadata = {
  title: "VEFILM Director's Lens Pro",
  description: "AI cinematography system by Pedro Feria Pino — describe a shot, get three takes",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
