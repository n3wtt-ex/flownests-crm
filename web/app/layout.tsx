import "./globals.css";

export const metadata = {
  title: 'CRM UI',
  description: 'Minimal CRM UI shell',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="tr"
      data-theme="light"
      suppressHydrationWarning
    >
      <body>
        <script
          dangerouslySetInnerHTML={{__html: `
            try {
              var t = localStorage.getItem('crm-theme');
              if (t) document.documentElement.setAttribute('data-theme', t);
              // hydrate-safe theme toggler
              window.addEventListener('click', function(e){
                var el = e.target;
                if (el && el.closest && el.closest('[data-theme-toggle]')) {
                  var root = document.documentElement;
                  var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
                  root.setAttribute('data-theme', next);
                  try { localStorage.setItem('crm-theme', next); } catch {}
                }
              });
            } catch {}
          `}}
        />
        <div className="container">
          <nav className="topnav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <a href="/crm" className="link-primary">
              CRM / Kanban
            </a>
            <span
              role="button"
              tabIndex={0}
              data-theme-toggle
              style={{ border: '1px solid var(--border)', background: 'var(--panel)', color: 'var(--text)', borderRadius: 999, padding: '6px 10px', cursor: 'pointer', userSelect: 'none' }}
            >
              Theme
            </span>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
