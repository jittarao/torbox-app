import Script from 'next/script';

export function RybbitHeadScripts() {
  const siteId = process.env.RYBBIT_SITE_ID?.trim();
  if (!siteId) {
    return null;
  }

  const scriptSrc =
    process.env.RYBBIT_SCRIPT_SRC?.trim() || '/analytics/script.js';

  const boot = `(function(){try{window.__TBM_RYBBIT__=1;var el=document.createElement("script");el.src=${JSON.stringify(scriptSrc)};el.async=true;el.setAttribute("data-site-id",${JSON.stringify(siteId)});document.head.appendChild(el);}catch(e){}})();`;

  return (
    <Script
      id="tbm-rybbit-boot"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: boot }}
    />
  );
}
