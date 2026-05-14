export function RybbitHeadScripts() {
  const siteId = process.env.RYBBIT_SITE_ID?.trim();
  if (!siteId) {
    return null;
  }

  const scriptSrc =
    process.env.RYBBIT_SCRIPT_SRC?.trim() || '/analytics/script.js';

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: 'window.__TBM_RYBBIT__=1' }}
      />
      <script
        defer
        src={scriptSrc}
        {...{ 'data-site-id': siteId }}
      />
    </>
  );
}
