// pdf-parse ne fournit pas de types pour son point d'entrée interne.
declare module 'pdf-parse/lib/pdf-parse.js' {
  interface PdfParseOptions {
    pagerender?: (pageData: any) => Promise<string> | string;
    max?: number;
  }
  interface PdfParseResult {
    numpages: number;
    text: string;
    info: unknown;
  }
  function pdfParse(data: Buffer, options?: PdfParseOptions): Promise<PdfParseResult>;
  export default pdfParse;
}
