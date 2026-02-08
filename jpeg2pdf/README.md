# jpeg2pdf

A Bun.js script to convert JPEG images to PDF files.

## Features

* Converts JPEG images to PDF format
* Preserves image dimensions
* Outputs PDF in the same directory as the input file

## Requirements

- [Bun](https://bun.sh/) runtime

## Installation

```bash
cd scripts/jpeg2pdf
bun install
```

## Usage

```bash
bun run main.js <jpeg-file-path>
```

### Example

```bash
bun run main.js /path/to/image.jpg
```

This will create a PDF file at `/path/to/image.pdf` in the same directory as the input JPEG file.

## How it works

The script:
1. Reads the JPEG file from the provided path
2. Creates a new PDF document
3. Embeds the JPEG image in the PDF
4. Sets the PDF page size to match the image dimensions
5. Saves the PDF with the same name as the input file (with `.pdf` extension)

---

This project was created using `bun init` in bun v1.3.5. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
