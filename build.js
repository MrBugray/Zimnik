// Bundles everything into one offline HTML file: dist/index.html
const fs = require('fs'), path = require('path');
const root = __dirname, src = path.join(root, 'src');
let html = fs.readFileSync(path.join(src, 'template.html'), 'utf8');
const font = w => fs.readFileSync(path.join(root, 'node_modules/@fontsource/barlow-condensed/files', `barlow-condensed-latin-${w}-normal.woff2`)).toString('base64');
const planck = fs.readFileSync(path.join(root, 'node_modules/planck/dist/planck.min.js'), 'utf8').replace(/\/\/# sourceMappingURL=.*$/m, '');
const files = fs.readdirSync(src).filter(f => /^\d\d_.*\.js$/.test(f)).sort();
const game = '(function(){\n' + files.map(f => '// ---- ' + f + '\n' + fs.readFileSync(path.join(src, f), 'utf8')).join('\n') + '\n})();';
html = html.replace('{{FONT500}}', font(500)).replace('{{FONT600}}', font(600)).replace('{{FONT700}}', font(700));
html = html.split('{{PLANCK}}').join(planck.replace(/<\/script>/g, '<\\/script>'));
html = html.replace('{{GAME}}', () => game);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'index.html'), html);
// artifact variant: the host wraps the page in its own document skeleton
let art = html.replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '').replace(/<\/html>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '').replace(/<meta name="theme-color"[^>]*>\s*/i, '');
art = art.replace('<style>', '<style>html,body{height:100%;margin:0;background:#0d0b09}');
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), art);
console.log('dist/index.html', (html.length / 1024).toFixed(0) + ' KB', files.join(' '));
