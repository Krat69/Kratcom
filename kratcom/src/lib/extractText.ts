// Extracción de texto de documentos EN EL PROPIO DISPOSITIVO. El fichero se
// lee con FileReader/ArrayBuffer y, en el caso de PDF, con pdf.js ejecutado
// localmente (se importa en diferido para no engordar el bundle inicial).
// El documento original nunca se sube a ningún servidor.

const TEXT_EXTENSIONS = ['txt', 'md', 'csv', 'json', 'log', 'xml'];
const HTML_EXTENSIONS = ['html', 'htm'];

export class UnsupportedFileError extends Error {
  constructor(extension: string) {
    super(
      `Formato .${extension} no soportado todavía. Usa PDF o texto (.txt, .md, .csv, .html), ` +
        'o pega el contenido directamente: en ambos casos se procesa solo en tu dispositivo.'
    );
    this.name = 'UnsupportedFileError';
  }
}

async function extractPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => ('str' in item ? item.str : '')).join(' '));
  }
  await doc.destroy();
  return pages.join('\n\n').replace(/[ \t]+/g, ' ').trim();
}

function extractHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

export async function extractText(file: File): Promise<string> {
  const extension = (file.name.split('.').pop() ?? '').toLowerCase();

  if (extension === 'pdf' || file.type === 'application/pdf') {
    return extractPdf(file);
  }
  if (HTML_EXTENSIONS.includes(extension) || file.type === 'text/html') {
    return extractHtml(await file.text());
  }
  if (TEXT_EXTENSIONS.includes(extension) || file.type.startsWith('text/')) {
    return (await file.text()).trim();
  }
  throw new UnsupportedFileError(extension || file.type || 'desconocido');
}
