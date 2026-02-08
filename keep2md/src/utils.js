import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname } from "path";

export function mkfile(path, data) {
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
