import { PDFDocument } from "pdf-lib";
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from "fs";
import { resolve, dirname, basename, extname, join } from "path";
import * as p from "@clack/prompts";

function mkfile(path, data) {
    let mkdir = data !== undefined;

    if(mkdir) {
        const targetDir = dirname(path);

        if(!existsSync(targetDir)) {
            mkdirSync(targetDir, { recursive: true });
        }
    }

    writeFileSync(path, data);

    return data;
}


async function convertJpegToPdf(inputPath) {
    const absoluteInputPath = resolve(inputPath);
    
    if (!existsSync(absoluteInputPath)) {
        p.cancel(`File not found: ${absoluteInputPath}`);
        throw new Error(`File not found: ${absoluteInputPath}`);
    }

    const stats = statSync(absoluteInputPath);
    if (stats.isDirectory()) {
        p.cancel(`Path is a directory, not a file: ${absoluteInputPath}`);
        throw new Error(`Path is a directory, not a file: ${absoluteInputPath}`);
    }

    // Generate output path early to check if it exists
    const inputDir = dirname(absoluteInputPath);
    const inputBaseName = basename(absoluteInputPath, extname(absoluteInputPath));
    const outputPath = join(inputDir, `${inputBaseName}.pdf`);
    
    if (existsSync(outputPath)) {
        const shouldOverwrite = await p.confirm({
            message: `Output file already exists: ${outputPath}`,
            initialValue: false,
        });
        
        if (p.isCancel(shouldOverwrite) || !shouldOverwrite) {
            p.cancel('Operation cancelled');
            throw new Error('Operation cancelled by user');
        }
    }

    const spinner = p.spinner();
    spinner.start('Reading JPEG file...');

    const jpegBytes = readFileSync(absoluteInputPath);
    const pdfDoc = await PDFDocument.create();
    
    let jpegImage;
    try {
        spinner.message('Processing image...');
        jpegImage = await pdfDoc.embedJpg(jpegBytes);
    } catch (error) {
        spinner.stop('Failed to process JPEG');
        p.cancel(`Failed to read JPEG image. The file may not be a valid JPEG format: ${error.message}`);
        throw new Error(`Failed to read JPEG image. The file may not be a valid JPEG format: ${error.message}`);
    }
    
    spinner.message('Creating PDF...');
    const jpegDims = jpegImage.scale(1);
    const page = pdfDoc.addPage([jpegDims.width, jpegDims.height]);

    page.drawImage(jpegImage, {
        x: 0,
        y: 0,
        width: jpegDims.width,
        height: jpegDims.height,
    });
    
    const pdfBytes = await pdfDoc.save();
    
    spinner.message('Writing PDF file...');
    mkfile(outputPath, pdfBytes);
    spinner.stop('PDF created successfully');
    
    p.success(`Successfully converted to ${outputPath}`);
    
    return outputPath;
}

async function main() {
    p.intro('🖼️  JPEG to PDF Converter');
    
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        p.cancel('No file path provided');
        p.note('bun run main.js <jpeg-file-path>', 'Usage');
        p.note('bun run main.js /path/to/image.jpg', 'Example');
        process.exit(1);
    }
    
    const inputPath = args[0];
    
    try {
        await convertJpegToPdf(inputPath);
        p.outro('Conversion complete! ✨');
    } catch (error) {
        // Error already handled in convertJpegToPdf with clack prompts
        process.exit(1);
    }
}

main().catch(console.error);
