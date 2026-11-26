import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mijoz topish — CRM",
  description: "Mijoz topish, qo'ng'iroqlar, sotuvlar va qarzlar — bir joyda.",
  applicationName: "Mijoz topish",
  appleWebApp: { capable: true, title: "Mijoz topish", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efe7dd" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0906" },
  ],
};

// Applies the saved (or system) theme before first paint so glass never flashes the wrong mode.
const themeScript = `try{var s=JSON.parse(localStorage.getItem("acq:theme")||"null");s=s&&s.state;var t=s&&s.theme;if(!t)t="dark";var e=document.documentElement;if(t==="dark")e.classList.add("dark");if(s&&s.glassBlur){e.style.setProperty("--glass-blur",s.glassBlur+"px");e.style.setProperty("--ga",s.glassAlpha);e.style.setProperty("--gas",Math.min(.95,s.glassAlpha+.2))}}catch(e){}try{var l=JSON.parse(localStorage.getItem("acq:lang")||"null");l=l&&l.state&&l.state.lang;if(l)document.documentElement.lang=l==="tj"?"tg":l}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="ambient" aria-hidden="true">
          <div className="parallax">
            <div className="blob b1" />
            <div className="blob b2" />
            <div className="blob b3" />
            <div className="blob b4" />
          </div>
          <div className="grain" />
        </div>
        {children}
      </body>
    </html>
  );
}
