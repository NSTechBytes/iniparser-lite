"use strict";
const fs = require("fs");
const fsp = require("fs").promises;
const readline = require("readline");
const iconv = require("iconv-lite");
const chardet = require("chardet");

class IniParser {
  /**
   * Streams and parses INI sections with a callback.
   * @param {string} filePath - Path to the INI file.
   * @param {(section: string, data: object) => void} onSectionParsed - Callback for each section.
   */
  async parseFile(filePath, onSectionParsed) {
    const encoding = await this.detectEncoding(filePath);
    const stream = fs
      .createReadStream(filePath)
      .pipe(iconv.decodeStream(encoding));
    const rl = readline.createInterface({ input: stream });

    let currentSection = null;
    let currentData = {};

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("#"))
        continue;

      const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        if (currentSection !== null)
          onSectionParsed(currentSection, currentData);
        currentSection = sectionMatch[1].trim();
        currentData = {};
        continue;
      }

      const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1].trim();
        let value = kvMatch[2].trim().replace(/^["'](.*)["']$/, "$1");
        if (currentSection === null) {
          console.warn(`Skipping global key "${key}" outside any section.`);
          continue;
        }
        currentData[key.toLowerCase()] = value;
      } else {
        console.warn(`Skipping malformed line: "${line}"`);
      }
    }

    if (currentSection !== null) {
      onSectionParsed(currentSection, currentData);
    }
  }

  /**
   * Updates or adds a key-value pair under a section directly in the file.
   * Matches section/key case-insensitively and preserves original casing.
   * @param {string} filePath - Path to the INI file.
   * @param {string} section - Section name (case-insensitive).
   * @param {string} key - Key name (case-insensitive).
   * @param {string} value - Value to write.
   */
  async setValue(filePath, section, key, value) {
    const encoding = await this.detectEncoding(filePath);
    const tmpPath = filePath + ".tmp";

    const readStream = fs
      .createReadStream(filePath)
      .pipe(iconv.decodeStream(encoding));
    const rl = readline.createInterface({ input: readStream });

    let currentSection = null;
    let sectionMatched = false;
    let keyMatched = false;
    let lines = [];
    let errorOccurred = false;

    const targetSection = section.toLowerCase();
    const targetKey = key.toLowerCase();

    try {
      for await (const line of rl) {
        const trimmed = line.trim();
        let outputLine = line;

        const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
        if (sectionMatch) {
          if (sectionMatched && !keyMatched) {
            lines.push(`${key}="${value}"`);
            keyMatched = true;
          }

          currentSection = sectionMatch[1].trim();
          sectionMatched = currentSection.toLowerCase() === targetSection;
        } else if (sectionMatched) {
          const keyValMatch = trimmed.match(/^([^=]+)=(.*)$/);
          if (keyValMatch) {
            const existingKey = keyValMatch[1].trim();
            if (existingKey.toLowerCase() === targetKey) {
              outputLine = `${existingKey}="${value}"`; // preserve original key case
              keyMatched = true;
            }
          } else if (
            trimmed &&
            !trimmed.startsWith(";") &&
            !trimmed.startsWith("#")
          ) {
            console.warn(`Skipping malformed line: "${line}"`);
          }
        } else if (
          trimmed &&
          !trimmed.startsWith("[") &&
          !trimmed.startsWith(";") &&
          !trimmed.startsWith("#")
        ) {
          const keyValMatch = trimmed.match(/^([^=]+)=(.*)$/);
          if (!keyValMatch) {
            console.warn(`Skipping malformed global line: "${line}"`);
          }
        }

        lines.push(outputLine);
      }

      // Append key if section matched but key not found
      if (sectionMatched && !keyMatched) {
        lines.push(`${key}="${value}"`);
      }

      // If section not found, add both section and key
      if (!sectionMatched) {
        if (!lines[lines.length - 1].endsWith("\n")) lines.push(""); // ensure spacing
        lines.push(`[${section}]`);
        lines.push(`${key}="${value}"`);
      }

      const resultText = lines.join("\n") + "\n"; // ensure newline at end
      const encoded = iconv.encode(resultText, encoding);

      await fsp.writeFile(tmpPath, encoded);
      await fsp.rename(tmpPath, filePath);
    } catch (err) {
      errorOccurred = true;
      console.error("Failed to write INI file:", err);
      if (await this.fileExists(tmpPath)) {
        await fsp.unlink(tmpPath); // clean up temp file
      }
    }
  }

  /**
   * Detects the encoding of a file using chardet.
   * @param {string} filePath - File to analyze
   * @returns {Promise<string>} Normalized encoding
   */
  async detectEncoding(filePath) {
    const fd = await fsp.open(filePath, "r");
    const { buffer } = await fd.read(Buffer.alloc(1024), 0, 1024, 0);
    await fd.close();
    return (chardet.detect(buffer) || "utf-8")
      .toLowerCase()
      .replace(/[-_]/g, "");
  }

  /**
   * Checks if a file exists.
   * @param {string} filePath
   * @returns {Promise<boolean>}
   */
  async fileExists(filePath) {
    try {
      await fsp.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = IniParser;
