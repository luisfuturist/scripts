# keep2md

`keep2md` is a script designed to facilitate the conversion of Google Keep notes into markdown files.

## Features

* Generates multiple markdown files;
* Automatically renames duplicate files to avoid conflicts.

## Requirements

- Node.js version 21.5.0 or higher.
- NPM version 10.2.4 or higher.

## Installation

To get started, follow these simple steps:

```bash
git clone https://github.com/luisfuturist/keep2md.git
cd keep2md/
npm install
```

## Important Notes

- A [Google Service account](https://cloud.google.com/iam/docs/service-account-overview) is required for authorization. [Create Service Account Key page](https://console.cloud.google.com/apis/credentials/serviceaccountkey).
- Remember to configure the `keep2md.config.js` file according to your needs.
- **Title Constraints**: Unfortunately, `keep2md` does not support notes with empty titles.

## How to use?

1. Select and copy the desired Google Keep notes to a new Google Doc. Click "Copy to Google Docs" to transfer the selected notes into a single document.
2. Create a file named `.env` in the project directory if it doesn't exist.
3. Obtain the document ID from the Google Doc URL.
4. Add the following lines to the `.env` file, replacing `<id>` with the copied document ID and <name>.json with your actual service account key file name.

    ```bash
    DOCUMENT_ID=<id>
    GOOGLE_SERVICE_ACCOUNT_KEY_FILE_PATH="secrets/<>.json"
    ```
5. Add your Google Service account as reader to the document.
6. Run the script: npm run start to begin the conversion process.
