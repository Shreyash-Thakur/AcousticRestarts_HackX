import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const getFilePath = (name) => join(__dirname, `${name}.json`);

export function readDb(name, defaultValue = []) {
  const filePath = getFilePath(name);
  if (!existsSync(filePath)) {
    writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), "utf-8");
    return JSON.parse(JSON.stringify(defaultValue));
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf-8"));
  } catch {
    return JSON.parse(JSON.stringify(defaultValue));
  }
}

export function writeDb(name, data) {
  writeFileSync(getFilePath(name), JSON.stringify(data, null, 2), "utf-8");
}
