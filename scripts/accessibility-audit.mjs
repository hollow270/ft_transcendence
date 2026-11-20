import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const rootDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDirectory = join(rootDirectory, 'frontend', 'src');
const minimumTextContrast = 4.5;

const failures = [];
let passedChecks = 0;

function check(description, passed, detail = '') {
  if (passed) {
    passedChecks += 1;
    console.log('PASS  ' + description);
    return;
  }
  failures.push(description + (detail ? ' (' + detail + ')' : ''));
  console.log('FAIL  ' + description + (detail ? ' (' + detail + ')' : ''));
}

function channelLuminance(value) {
  const channel = value / 255;
  return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.replace('#', '');
  const [red, green, blue] = [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16));
  return 0.2126 * channelLuminance(red) + 0.7152 * channelLuminance(green) + 0.0722 * channelLuminance(blue);
}

function contrastRatio(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(tsx|css)$/.test(entry.name) ? [path] : [];
  });
}

const configModule = await import(pathToFileURL(join(rootDirectory, 'frontend', 'tailwind.config.js')).href);
const { slate, blue } = configModule.default.theme.extend.colors;
const ink = configModule.default.theme.extend.colors.ink;

const textColors = { 'slate-200': slate[200], 'slate-300': slate[300], 'slate-400': slate[400], 'slate-500': slate[500], 'slate-600': slate[600] };
const backgrounds = { ink, 'slate-950': slate[950], 'slate-900': slate[900] };

console.log('Colour contrast (minimum ' + minimumTextContrast + ':1)');
for (const [textName, textColor] of Object.entries(textColors)) {
  for (const [backgroundName, backgroundColor] of Object.entries(backgrounds)) {
    const ratio = contrastRatio(textColor, backgroundColor);
    check(textName + ' on ' + backgroundName + ' is ' + ratio.toFixed(2) + ':1', ratio >= minimumTextContrast);
  }
}

for (const shade of [600, 700]) {
  const buttonRatio = contrastRatio('#FFFFFF', blue[shade]);
  check('white text on blue-' + shade + ' is ' + buttonRatio.toFixed(2) + ':1', buttonRatio >= minimumTextContrast);
}

const linkRatio = contrastRatio(blue[400], slate[900]);
check('blue-400 links on slate-900 are ' + linkRatio.toFixed(2) + ':1', linkRatio >= minimumTextContrast);

const verdictColors = { MALICIOUS: '#FB7185', SUSPICIOUS: '#FBBF24', HARMLESS: '#34D399', UNKNOWN: '#8792B0' };
for (const [name, color] of Object.entries(verdictColors)) {
  const ratio = contrastRatio(color, slate[900]);
  check('verdict colour ' + name + ' on slate-900 is ' + ratio.toFixed(2) + ':1', ratio >= 3);
}

console.log('\nMarkup rules');
const files = sourceFiles(sourceDirectory);
const tsxFiles = files.filter((file) => file.endsWith('.tsx'));
const contents = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));

const indexHtml = readFileSync(join(rootDirectory, 'frontend', 'index.html'), 'utf8');
check('document language is declared', /<html[^>]*\slang="en"/.test(indexHtml));

const allSource = [...contents.values()].join('\n');
check('skip link targets the main landmark', allSource.includes('href="#main-content"') && allSource.includes('id="main-content"'));

const pageFiles = tsxFiles.filter((file) => file.includes(join('src', 'pages')));
const nestedMains = pageFiles.filter((file) => file.includes('Page.tsx') && !/Legal|Landing|Auth/.test(file) && /<main[\s>]/.test(contents.get(file)));
check('app pages do not add a second main landmark', nestedMains.length === 0, nestedMains.map((file) => relative(sourceDirectory, file)).join(', '));

const unlabeledControls = [];
const imagesWithoutAlt = [];
const dialogsWithoutName = [];
const errorsWithoutRole = [];
for (const file of tsxFiles) {
  const source = contents.get(file);
  const name = relative(sourceDirectory, file);

  for (const match of source.matchAll(/<(input|select|textarea)\b[^>]*?>/gs)) {
    const tag = match[0];
    const line = source.slice(0, match.index).split('\n').length;
    const before = source.slice(Math.max(0, match.index - 400), match.index);
    const insideLabel = before.lastIndexOf('<label') > before.lastIndexOf('</label>');
    const hasId = /\sid=/.test(tag) && new RegExp('htmlFor="' + (tag.match(/\sid="([^"]+)"/)?.[1] ?? '__none__') + '"').test(source);
    if (!/aria-label|aria-labelledby|type="hidden"/.test(tag) && !insideLabel && !hasId) {
      unlabeledControls.push(name + ':' + line);
    }
  }

  for (const match of source.matchAll(/<img\b[^>]*?>/gs)) {
    if (!/\salt=/.test(match[0])) imagesWithoutAlt.push(name + ':' + source.slice(0, match.index).split('\n').length);
  }

  for (const match of source.matchAll(/<[a-z]+\b[^>]*role="dialog"[^>]*>/gs)) {
    if (!/aria-label/.test(match[0])) dialogsWithoutName.push(name);
  }

  for (const match of source.matchAll(/<div\b[^>]*border-red-900 bg-red-950[^>]*>/gs)) {
    if (!/role="alert"/.test(match[0])) errorsWithoutRole.push(name + ':' + source.slice(0, match.index).split('\n').length);
  }
}

check('every form control has an accessible name', unlabeledControls.length === 0, unlabeledControls.join(', '));
check('every image has alternative text', imagesWithoutAlt.length === 0, imagesWithoutAlt.join(', '));
check('every dialog has a name', dialogsWithoutName.length === 0, dialogsWithoutName.join(', '));
check('every error message is announced to screen readers', errorsWithoutRole.length === 0, errorsWithoutRole.join(', '));

const stylesheet = contents.get(join(sourceDirectory, 'index.css'));
check('keyboard focus is visibly styled', /:focus-visible\s*{[^}]*outline/.test(stylesheet));
check('reduced motion preference is honoured', stylesheet.includes('prefers-reduced-motion: reduce'));
check('white text is never placed on blue-500', !/bg-blue-500[^"']*text-white|text-white[^"']*bg-blue-500/.test(allSource) && !/hover:bg-blue-500/.test(allSource));
check('no single-key shortcut remains', !/event\.key === '\/'/.test(allSource));

const lowContrastLeftovers = ['#5a6483', '#66708e', '#4a5370'].filter((hex) => new RegExp(hex, 'i').test(stylesheet));
check('stylesheet has no leftover low-contrast greys', lowContrastLeftovers.length === 0, lowContrastLeftovers.join(', '));

console.log('\n' + passedChecks + ' checks passed, ' + failures.length + ' failed');
if (failures.length > 0) {
  process.exit(1);
}
