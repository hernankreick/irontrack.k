// Transpila (sin modificar) archivos del repo a un espejo en scratchpad, para montar componentes reales en Chromium.
import fs from 'node:fs'; import path from 'node:path'; import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require(process.env.TYPESCRIPT_MODULE || '/opt/node-tools/node_modules/typescript');
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../../..'); const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'out');
const done = new Set();
function resolveRel(from, sp){ let p = path.resolve(path.dirname(from), sp); if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  for (const e of ['.jsx','.js','/index.jsx','/index.js']) if (fs.existsSync(p+e)) return p+e; throw new Error('no resuelve '+sp+' desde '+from); }
function outPath(src){ const rel = path.relative(REPO, src); return path.join(OUT, rel.endsWith('.css') ? rel : rel.replace(/\.(jsx|js)$/, '.js')); }
function build(src){
  if (done.has(src)) return; done.add(src);
  const dst = outPath(src); fs.mkdirSync(path.dirname(dst), { recursive: true });
  if (src.endsWith('.css')) { fs.copyFileSync(src, dst); return; }
  let code = fs.readFileSync(src, 'utf8');
  const deps = [];
  code = code.replace(/((?:import|export)\s[^'";]*?from\s*|import\s*)(['"])(\.{1,2}\/[^'"]+)\2/g, (m, pre, q, sp) => {
    const abs = resolveRel(src, sp); deps.push(abs);
    let rel = path.relative(path.dirname(dst), outPath(abs)); if (!rel.startsWith('.')) rel = './' + rel;
    if (abs.endsWith('.css')) return `import ${q}data:text/javascript;base64,${Buffer.from(`const l=document.createElement('link');l.rel='stylesheet';l.href='/out/${path.relative(REPO, abs)}';document.head.appendChild(l);`).toString("base64")}${q}`;
    return pre + q + rel + q;
  });
  const res = ts.transpileModule(code, { compilerOptions: { jsx: ts.JsxEmit.React, jsxFactory: '__h', jsxFragmentFactory: '__F', target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, allowJs: true }, fileName: src.replace(/\.js$/, '.jsx') });
  const out = (/[<]/.test(code) && /\.jsx$/.test(src) ? "import { createElement as __h, Fragment as __F } from 'react';\n" : "import { createElement as __h, Fragment as __F } from 'react';\n") + res.outputText;
  fs.writeFileSync(dst, out);
  deps.forEach(build);
}
fs.rmSync(OUT, { recursive: true, force: true });
for (const e of process.argv.slice(2)) build(path.resolve(REPO, e));
// shims de React desde los UMD del repo
const R = require(REPO + '/node_modules/react'); const RD = require(REPO + '/node_modules/react-dom');
const sh = (g, keys) => `const M=window.${g};export default M;` + keys.filter(k => /^[A-Za-z_$][\w$]*$/.test(k)).map(k => `export const ${k}=M.${k};`).join('');
fs.mkdirSync(OUT + '/shims', { recursive: true });
fs.writeFileSync(OUT + '/shims/react.js', sh('React', Object.keys(R)));
fs.writeFileSync(OUT + '/shims/react-dom.js', sh('ReactDOM', Object.keys(RD)));
console.log('transpilados', done.size);
