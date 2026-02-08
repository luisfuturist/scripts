import path from "path";
import { google } from "googleapis";
import fs from "fs";
import { mkfile } from "./utils.js";

import "dotenv/config";
import config from "../keep2md.config.js";

const escapeTitle = (title) => title
    .replaceAll("/", "-")
    .replaceAll("\n", "")
    .replaceAll(":", "- ")
    .replaceAll("?", "-q")
    .replaceAll(">", "-n");

async function fetchDocumentContent() {
    const SCOPES = [
        "https://www.googleapis.com/auth/documents",
    ].join(" ");

    const auth = await google.auth.getClient({
        keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE_PATH,
        scopes: SCOPES,
    });

    const docs = google.docs({ version: "v1", auth });
    const res = await docs.documents.get({ documentId: process.env.DOCUMENT_ID });

    return res.data.body.content;
}

function writeNotes(data, options) {
    fs.rmSync("./notes/", { recursive: true, force: true })

    if (data === undefined) {
        throw Error("Data is invalid");
    }

    let loadedTitles = [];
    let numberOfOccurancy = {};
    let noteAmount = 0;

    let prevTitle = undefined;
    let curTitle = undefined;
    let curContent = "";

    function saveNote(title) {
        if (loadedTitles.includes(title)) {
            if (!numberOfOccurancy[title]) {
                numberOfOccurancy[title] = 1;
            } else {
                numberOfOccurancy[title]++;
            }

            title = title + " " + numberOfOccurancy[title];
        } else {
            loadedTitles.push(title);
        }

        if (options.generateTitle) {
            curContent = "# " + title + "\n" + curContent;
        }

        mkfile(path.join(config.outDir, `notes/${title}.md`), curContent);

        noteAmount++;
    }

    for (let value of data) {
        if (typeof value === "object") {
            if (value.paragraph) {
                const elements = value.paragraph.elements;

                for (let element of elements) {
                    const text = element.textRun;
                    const isTitle = text?.textStyle?.bold === true
                        && text?.content !== "\n";

                    if (isTitle) {
                        prevTitle = curTitle;
                        curTitle = escapeTitle(text.content);

                        if (prevTitle !== undefined) {
                            saveNote(prevTitle);
                            curContent = "";
                        }
                    } else {
                        curContent += text?.content;
                    }
                }
            }
        }
    }

    saveNote(curTitle);

    return {
        noteAmount,
    };
}

function writeNotesFromResponseFile() {
    const dataPath = path.join(config.outDir, config.responseFile);
    const fileData = fs.readFileSync(dataPath, 'utf-8')

    let data = fileData && JSON.parse(fileData);

    return writeNotes(data, {
        generateTitle: true,
    });
}

async function main() {
    if (!config.cache) {
        const data = await fetchDocumentContent();

        mkfile(path.join(config.outDir, config.responseFile), JSON.stringify(data));
    }

    writeNotesFromResponseFile();
}

main();