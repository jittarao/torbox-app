import fs from 'fs';
import path from 'path';

const adminRoot = 'src/app/[locale]/admin';

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (entry.name === 'page.js') processPage(full);
  }
}

function processPage(pagePath) {
  const content = fs.readFileSync(pagePath, 'utf8');
  if (!content.startsWith("'use client'")) return;

  const dir = path.dirname(pagePath);
  const baseName = path.basename(dir === adminRoot ? 'login' : dir.split('/').pop());
  const clientName =
    dir === adminRoot
      ? 'AdminLoginPageClient.js'
      : `Admin${baseName.charAt(0).toUpperCase()}${baseName.slice(1)}PageClient.js`;

  const clientPath = path.join(dir, clientName);

  let clientContent = content;
  const defaultMatch = content.match(/export default function (\w+)/);
  const fnName = defaultMatch?.[1] || 'AdminPage';
  const clientFnName = fnName.endsWith('Client') ? fnName : `${fnName}Client`;

  if (clientContent.includes('window.location.pathname.split')) {
    clientContent = clientContent.replace(
      /const locale = window\.location\.pathname\.split\('\/'\)\[1\] \|\| 'en';/g,
      "const locale = useParams()?.locale || 'en';"
    );
    if (!clientContent.includes('useParams')) {
      clientContent = clientContent.replace(
        "import { useRouter } from 'next/navigation';",
        "import { useRouter, useParams } from 'next/navigation';"
      );
    }
  }

  clientContent = clientContent.replace(
    `export default function ${fnName}`,
    `export default function ${clientFnName}`
  );

  fs.writeFileSync(clientPath, clientContent);

  const importPath = `./${clientName.replace(/\.js$/, '')}`;
  const serverPage = `import ${clientFnName} from '${importPath}';\n\nexport default function Page() {\n  return <${clientFnName} />;\n}\n`;
  fs.writeFileSync(pagePath, serverPage);
  console.log('Refactored', pagePath, '->', clientPath);
}

walk(adminRoot);
