import * as p from "@clack/prompts";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { basename, dirname, extname, join, resolve } from "path";
import { PDFDocument, PDFImage } from "pdf-lib";
import sanitizeOsFilename from "sanitize-filename";
import z from "zod";
import { defineCommand, type Manifest, run } from "cheloni";
import dedent from "dedent";

// #region Utils

function mkfile(path: string, data: Buffer | Uint8Array | string | undefined) {
    if (data === undefined) {
        return data;
    }

    const targetDir = dirname(path);

    if(!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
    }

    writeFileSync(path, data);

    return data;
}

async function sanitizeFilename(filePath: string, normalizeFilename: boolean = false) {
    const dir = dirname(filePath);
    const filename = basename(filePath);
    const ext = extname(filename);
    const nameWithoutExt = basename(filename, ext);
    
    let sanitizedName = sanitizeOsFilename(nameWithoutExt);

    if (normalizeFilename) {
        sanitizedName = nameWithoutExt
            .normalize('NFD') // Decompose characters (é -> e + ´)
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks (accents)
            .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
            .replace(/_{2,}/g, '_') // Collapse multiple underscores
            .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
    }

    return join(dir, sanitizedName + ext);
}

// #endregion

// #region Services

interface PdfMetadata {
    title?: string;
    author?: string;
    subject?: string;
    language?: string;
    keywords?: string;
}

async function createPdfDocument(
    inputBaseName: string,
    metadata: PdfMetadata
) {
    const pdfDoc = await PDFDocument.create();
    
    // Set PDF metadata for compliance
    pdfDoc.setCreator('custom jpeg2pdf converter');
    pdfDoc.setProducer('pdf-lib');
    pdfDoc.setCreationDate(new Date());
    pdfDoc.setModificationDate(new Date());

    pdfDoc.setTitle(metadata.title || inputBaseName, { showInWindowTitleBar: true });
    if(metadata.author) {
        pdfDoc.setAuthor(metadata.author);
    }
    if(metadata.subject) {
        pdfDoc.setSubject(metadata.subject);
    }
    if (metadata.language) {
        pdfDoc.setLanguage(metadata.language);
    }
    if (metadata.keywords) {
        // Keywords can be a string or array of strings
        const keywordArray = metadata.keywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
        pdfDoc.setKeywords(keywordArray);
    }

    return pdfDoc;
}

async function readJpegImage(spinner: ReturnType<typeof p.spinner>, absoluteInputPath: string, pdfDoc: PDFDocument) {
    const jpegBytes = readFileSync(absoluteInputPath);
    
    let jpegImage: PDFImage;
    try {
        spinner.message('Processing image...');
        jpegImage = await pdfDoc.embedJpg(jpegBytes);
    } catch (error) {
        spinner.stop('Failed to process JPEG');
        const errorMessage = error instanceof Error ? error.message : String(error);
        p.cancel(`Failed to read JPEG image. The file may not be a valid JPEG format: ${errorMessage}`);
        process.exit(1);
    }

    return jpegImage;
}

async function createJpegPdfPage(spinner: ReturnType<typeof p.spinner>, pdfDoc: PDFDocument, absoluteInputPath: string) {
    spinner.start('Reading JPEG file...');
    const jpegImage = await readJpegImage(spinner, absoluteInputPath, pdfDoc);
    
    const jpegDims = jpegImage.scale(1);
    spinner.message(`Creating PDF page with dimensions ${jpegDims.width}x${jpegDims.height}...`);
    const page = pdfDoc.addPage([jpegDims.width, jpegDims.height]);

    spinner.message('Drawing image on PDF page...');
    page.drawImage(jpegImage, {
        x: 0,
        y: 0,
        width: jpegDims.width,
        height: jpegDims.height,
    });
}

async function convertAndSavePdf(pdfDoc: PDFDocument, absoluteInputPath: string, outputPath: string) {
    const spinner = p.spinner();

    await createJpegPdfPage(spinner, pdfDoc, absoluteInputPath);
    
    spinner.message('Saving PDF...');
    const pdfBytes = await pdfDoc.save();
    
    spinner.message('Writing PDF file...');
    mkfile(outputPath, pdfBytes);

    spinner.stop('PDF created successfully');
}

async function getOutputPath(
    absoluteInputPath: string,
    title?: string,
    providedOutputPath?: string,
    normalizeFilename: boolean = false,
    force: boolean = false
) {
    // Generate default output path
    const inputDir = dirname(absoluteInputPath);
    const inputBaseName = basename(absoluteInputPath, extname(absoluteInputPath));
    const defaultOutputPath = join(inputDir, `${inputBaseName}.pdf`);
    
    // Use provided path, or title-based path, or default
    let outputPath: string;
    if (providedOutputPath) {
        outputPath = providedOutputPath;
    } else if (title) {
        // If title is provided, use it as filename in the same directory as input
        outputPath = join(inputDir, `${title}.pdf`);
    } else {
        outputPath = defaultOutputPath;
    }
    
    outputPath = await sanitizeFilename(outputPath, normalizeFilename);
    
    if (existsSync(outputPath) && !force) {
        const shouldOverwrite = await p.confirm({
            message: `Output file already exists. Overwrite? ${outputPath}`,
            initialValue: false,
        });
        
        if (p.isCancel(shouldOverwrite) || !shouldOverwrite) {
            p.cancel('Operation cancelled');
            process.exit(1);
        }
    }

    return outputPath;
}

async function validateInputPath(inputPath: string) {
    const absoluteInputPath = resolve(inputPath);
    
    if (!existsSync(absoluteInputPath)) {
        p.cancel(`File not found: ${absoluteInputPath}`);
        process.exit(1);
    }

    const stats = statSync(absoluteInputPath);
    if (stats.isDirectory()) {
        p.cancel(`Path is a directory, not a file: ${absoluteInputPath}`);
        process.exit(1);
    }

    return absoluteInputPath;
}

// #endregion

// #region Middleware

function introMiddleware() {
    p.intro('🖼️  JPEG to PDF Converter');
}

// #endregion

// #region Commands

const convertJpegToPdfCommand = defineCommand({
    middleware: [introMiddleware],
    paths: ['convert', 'c'],
    positional: z.string().meta({ description: 'The path to the JPEG file to convert' }),
    options: z.object({
        output: z.string().optional().meta({
            description: 'Output PDF path',
            alias: 'o'
        }),
        force: z.boolean().optional().meta({
            description: 'Force overwrite existing file',
            alias: 'f'
        }),
        title: z.string().optional().meta({
            description: 'PDF title',
            alias: 't',
        }),
        author: z.string().optional().meta({
            description: 'PDF author',
            alias: 'a',
        }),
        subject: z.string().optional().meta({
            description: 'PDF subject',
            alias: 's',
        }),
        language: z.string().optional().meta({
            description: 'PDF language (e.g., en-US, es-ES)',
            alias: 'l',
        }),
        keywords: z.string().optional().meta({
            description: 'PDF keywords (comma-separated)',
            alias: 'k',
        }),
        normalize: z.boolean().optional().meta({
            description: 'Normalize the filename',
            details: dedent`
                Normalize the filename by removing diacritical marks, replacing special characters with underscores, and collapsing multiple underscores.
            `,
            alias: 'n',
        }),
    }),
    handler: async ({ options, positional }) => {
        const absoluteInputPath = await validateInputPath(positional);
        const inputBaseName = basename(absoluteInputPath, extname(absoluteInputPath));
    
        const outputPath = await getOutputPath(absoluteInputPath, options.title, options.output, options.normalize, options.force);
        const pdfDoc = await createPdfDocument(inputBaseName, {
            title: options.title,
            author: options.author,
            subject: options.subject,
            language: options.language,
            keywords: options.keywords,
        });
    
        await convertAndSavePdf(pdfDoc, absoluteInputPath, outputPath);
        
        p.log.success(`Successfully converted to ${outputPath}`);
        
        p.outro('Conversion complete! ✨');
    },
});

// #endregion

// #region Main

const manifest: Manifest = {
    convertJpegToPdfCommand,
}

run({ manifest })

// #endregion
