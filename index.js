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
        // Keep original case for section name
        currentSection = sectionMatch[1].trim();
        currentData = {};
        continue;
      }

      const kvMatch = trimmed.match(/^([^=]+)=(.*)$/);
      if (kvMatch) {
        const key = kvMatch[1].trim();
        let value = kvMatch[2].trim();
        
        // Strip quotes only when they match at both ends
        value = this.stripMatchingQuotes(value);
        
        if (currentSection === null) {
          console.warn(`Skipping global key "${key}" outside any section.`);
          continue;
        }
        // Keep original case for key name
        currentData[key] = value;
      } else {
        console.warn(`Skipping malformed line: "${line}"`);
      }
    }

    if (currentSection !== null) {
      onSectionParsed(currentSection, currentData);
    }
  }

  /**
   * Strips quotes only when they match at both ends.
   * @param {string} value - The value to process.
   * @returns {string} Value with matching quotes stripped.
   */
  stripMatchingQuotes(value) {
    if (value.length < 2) return value;
    
    const first = value[0];
    const last = value[value.length - 1];
    
    // Check if quotes match at both ends
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
    
    return value;
  }

  /**
   * Updates or adds a key-value pair under a section directly in the file.
   * Matches section/key case-insensitively and preserves original casing.
   * @param {string} filePath - Path to the INI file.
   * @param {string} section - Section name (case-insensitive).
   * @param {string} key - Key name (case-insensitive).
   * @param {string} value - Value to write.
   * @param {object} options - Options object.
   * @param {boolean} options.quote - Whether to wrap value in quotes. If not specified, auto-determines based on value type.
   */
  async setValue(filePath, section, key, value, options = {}) {
    const encoding = await this.detectEncoding(filePath);
    const tmpPath = filePath + ".tmp";

    const readStream = fs
      .createReadStream(filePath)
      .pipe(iconv.decodeStream(encoding));
    const rl = readline.createInterface({ input: readStream });

    let currentSection = null;
    let currentSectionMatched = false;
    let targetSectionFound = false;
    let keyMatched = false;
    let lines = [];

    const targetSection = section.toLowerCase();
    const targetKey = key.toLowerCase();

    // Function to format the value based on quote option
    const formatValue = (val) => {
      let shouldQuote = options.quote;
      
      // Auto-determine quoting if not explicitly specified
      if (shouldQuote === undefined || shouldQuote === null) {
        const stringValue = String(val);
        // Don't quote if it's a simple number (integer or decimal) or boolean-like value
        shouldQuote = !/^(\d+(\.\d+)?|true|false)$/i.test(stringValue);
        
        // Also don't quote if the value contains no spaces and no special characters that would need quoting
        if (shouldQuote && !/[\s"'=\[\];#]/.test(stringValue)) {
          shouldQuote = false;
        }
      }
      
      return shouldQuote ? `"${val}"` : val;
    };

    try {
      for await (const line of rl) {
        const trimmed = line.trim();
        let outputLine = line;

        const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
        if (sectionMatch) {
          // If we were in a matched section but didn't find the key, add it before moving to the next section
          if (currentSectionMatched && !keyMatched) {
            lines.push(`${key}=${formatValue(value)}`);
            keyMatched = true;
          }

          currentSection = sectionMatch[1].trim();
          const currentSectionLower = currentSection.toLowerCase();
          currentSectionMatched = currentSectionLower === targetSection;
          
          if (currentSectionMatched) {
            targetSectionFound = true;
            keyMatched = false; // Reset for this section
          }
        } else if (currentSectionMatched) {
          const keyValMatch = trimmed.match(/^([^=]+)=(.*)$/);
          if (keyValMatch) {
            const existingKey = keyValMatch[1].trim();
            const existingKeyLower = existingKey.toLowerCase();
            if (existingKeyLower === targetKey) {
              outputLine = `${existingKey}=${formatValue(value)}`; // preserve original key case
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

      // Close the readline interface to free up resources
      rl.close();

      // After processing all lines, if we were in a matched section but didn't find the key, add it
      if (currentSectionMatched && !keyMatched) {
        lines.push(`${key}=${formatValue(value)}`);
        keyMatched = true;
      }

      // Only add a new section if we never found a matching section
      if (!targetSectionFound) {
        // Add empty line before new section if file doesn't end with empty line
        if (lines.length > 0 && lines[lines.length - 1].trim() !== "") {
          lines.push("");
        }
        lines.push(`[${section}]`);
        lines.push(`${key}=${formatValue(value)}`);
      }

      const resultText = lines.join("\n") + "\n"; // ensure newline at end
      
      // Write the file using the same encoding as the original file
      await this.writeFileWithEncoding(tmpPath, resultText, encoding);
      await fsp.rename(tmpPath, filePath);
    } catch (err) {
      console.error(`Failed to write INI file "${filePath}":`, err.message);
      if (await this.fileExists(tmpPath)) {
        await fsp.unlink(tmpPath); // clean up temp file
      }
      throw err; // Re-throw to let caller handle the error
    }
  }

  /**
   * Detect file encoding by sampling the first bytes.
   * @param {string} filePath - Path to the file.
   * @param {number} sampleSize - Number of bytes to sample.
   * @returns {Promise<string>} Detected encoding or fallback.
   */
  async detectEncoding(filePath, sampleSize = 4096) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(filePath, { start: 0, end: sampleSize - 1 });
      const chunks = [];

      readStream.on("data", (chunk) => chunks.push(chunk));
      readStream.on("end", () => {
        const buffer = Buffer.concat(chunks);
        // Fallback to Windows-1252 for legacy INI files
        const encoding = chardet.detect(buffer) || "windows-1252";
        resolve(encoding);
      });
      readStream.on("error", (err) => {
        console.warn("Encoding detection failed, defaulting to windows-1252:", err);
        resolve("windows-1252");
      });
    });
  }

  /**
   * Write file with proper encoding handling.
   * @param {string} filePath - Path to write to.
   * @param {string} content - Content to write.
   * @param {string} encoding - Encoding to use.
   */
  async writeFileWithEncoding(filePath, content, encoding) {
    try {
      const normalizedEncoding = encoding.toLowerCase();
      
      // Handle UTF-8 and ASCII with Node.js built-in support
      if (normalizedEncoding === 'utf-8' || normalizedEncoding === 'utf8' || normalizedEncoding === 'ascii') {
        await fsp.writeFile(filePath, content, 'utf8');
        return;
      }
      
      // Handle UTF-16LE specifically (requires BOM)
      if (normalizedEncoding === 'utf-16le' || normalizedEncoding === 'utf16le') {
        const encoded = iconv.encode(content, 'utf16le');
        await fsp.writeFile(filePath, encoded);
        return;
      }
      
      // Handle UTF-16BE specifically (requires BOM)
      if (normalizedEncoding === 'utf-16be' || normalizedEncoding === 'utf16be') {
        const encoded = iconv.encode(content, 'utf16be');
        await fsp.writeFile(filePath, encoded);
        return;
      }
      
      // For other encodings, use iconv-lite
      const encoded = iconv.encode(content, encoding);
      await fsp.writeFile(filePath, encoded);
      
    } catch (err) {
      console.warn(`Failed to write with encoding ${encoding}, falling back to UTF-8:`, err);
      await fsp.writeFile(filePath, content, 'utf8');
    }
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