import fs from 'fs';
import path from 'path';

const src = fs.readFileSync('src/components/icons.js', 'utf8');
const iconDir = 'src/components/icons';
fs.mkdirSync(iconDir, { recursive: true });

const blocks = src.split(/(?=^const \w+ = )/m).filter((b) => b.trim());
const exportBlock = blocks.pop();
const names = [];

for (const block of blocks) {
  const m = block.match(/^const (\w+) = /);
  if (!m) continue;
  const name = m[1];
  const exportName = name.replace(/Icon$/, '');
  names.push({ name, exportName });
  fs.writeFileSync(
    path.join(iconDir, `${exportName}.js`),
    `${block.trim()}\n\nexport default ${name};\n`
  );
}

const indexLines = [
  '/** Tree-shakeable named icon exports; default object kept for legacy imports. */',
  ...names.map(({ name, exportName }) => `import ${name} from './${exportName}';'`),
];
// fix typo in import lines
const imports = names
  .map(({ name, exportName }) => `import ${name} from './${exportName}';`)
  .join('\n');
const iconEntries = names.map(({ name, exportName }) => `  ${exportName}: ${name},`).join('\n');
const reexports = names
  .map(({ exportName }) => `export { default as ${exportName} } from './${exportName}';`)
  .join('\n');

const indexContent = `/** Tree-shakeable named icon exports; default object kept for legacy imports. */
${imports}

const Icons = {
${iconEntries}
};

export default Icons;
${reexports}
`;

fs.writeFileSync(path.join(iconDir, 'index.js'), indexContent);
fs.writeFileSync(
  'src/components/icons.js',
  "export { default } from './icons/index';\nexport * from './icons/index';\n"
);
console.log(`Split ${names.length} icons`);
