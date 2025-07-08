# iniparser-lite

A robust, streaming INI file parser for Node.js with automatic encoding detection and case-insensitive operations.

## Features

* **Streaming parser** - Memory efficient for large INI files
* **Automatic encoding detection** - Supports various text encodings
* **Case-insensitive operations** - Matches sections and keys regardless of case
* **Preserves original formatting** - Maintains original case and structure when updating
* **Safe file operations** - Uses temporary files to prevent data loss
* **Comprehensive error handling** - Graceful handling of malformed lines
* **Comment support** - Skips lines starting with `;` or `#`

## Installation

```bash
npm install iniparser-lite
```

## Dependencies

This module requires the following dependencies:

```bash
npm install iconv-lite chardet
```

## Usage

### Basic Parsing

```javascript
const IniParser = require('iniparser-lite');

const parser = new IniParser();

// Parse an INI file section by section
await parser.parseFile('config.ini', (section, data) => {
  console.log(`Section: ${section}`);
  console.log('Data:', data);
});
```

### Updating Values

```javascript
const IniParser = require('iniparser-lite');

const parser = new IniParser();

// Update or add a key-value pair
await parser.setValue('config.ini', 'database', 'host', 'localhost');
await parser.setValue('config.ini', 'database', 'port', '5432');
```

### Complete Example

```javascript
const IniParser = require('iniparser-lite');

async function main() {
  const parser = new IniParser();
  
  // Parse the entire file
  const sections = {};
  await parser.parseFile('app.ini', (section, data) => {
    sections[section] = data;
  });
  
  console.log('Parsed sections:', sections);
  
  // Update a configuration value
  await parser.setValue('app.ini', 'server', 'port', '8080');
  
  // Add a new section and key
  await parser.setValue('app.ini', 'logging', 'level', 'debug');
}

main().catch(console.error);
```

## API Reference

### `parseFile(filePath, onSectionParsed)`

Streams and parses INI sections with a callback function.

**Parameters:**

* `filePath` (string) - Path to the INI file
* `onSectionParsed` (function) - Callback function called for each section

  * `section` (string) - Section name
  * `data` (object) - Key-value pairs in the section (keys are lowercase)

**Returns:** `Promise<void>`

**Example:**

```javascript
await parser.parseFile('config.ini', (section, data) => {
  if (section === 'database') {
    console.log('Database config:', data);
  }
});
```

### `setValue(filePath, section, key, value)`

Updates or adds a key-value pair under a section directly in the file.

**Parameters:**

* `filePath` (string) - Path to the INI file
* `section` (string) - Section name (case-insensitive)
* `key` (string) - Key name (case-insensitive)
* `value` (string) - Value to write

**Returns:** `Promise<void>`

**Features:**

* Case-insensitive matching for sections and keys
* Preserves original casing in the file
* Creates section if it doesn't exist
* Uses temporary files for safe operations

**Example:**

```javascript
// Updates existing key or creates new one
await parser.setValue('config.ini', 'Database', 'HOST', 'localhost');
```

### `detectEncoding(filePath)`

Detects the encoding of a file using charset detection.

**Parameters:**

* `filePath` (string) - File to analyze

**Returns:** `Promise<string>` - Normalized encoding name

### `fileExists(filePath)`

Checks if a file exists.

**Parameters:**

* `filePath` (string) - Path to check

**Returns:** `Promise<boolean>`

## INI File Format

The parser supports standard INI file format:

```ini
; Comments start with semicolon
# Or with hash symbol

[section1]
key1=value1
key2="quoted value"
key3='single quoted'

[section2]
database_host=localhost
database_port=5432
```

### Supported Features

* **Sections**: `[section_name]`
* **Key-value pairs**: `key=value`
* **Comments**: Lines starting with `;` or `#`
* **Quoted values**: Single or double quotes (automatically stripped)
* **Global keys**: Keys outside sections (logged as warnings)

### Parser Behavior

* Keys are converted to lowercase for consistent access
* Original casing is preserved when updating files
* Malformed lines are skipped with warnings
* Global keys (outside sections) are skipped with warnings
* Empty lines and comments are ignored

## Error Handling

The parser includes comprehensive error handling:

* **Malformed lines**: Skipped with console warnings
* **Encoding detection**: Falls back to UTF-8 if detection fails
* **File operations**: Uses temporary files to prevent corruption
* **Global keys**: Logged as warnings but processing continues

## Performance

* **Memory efficient**: Streams large files without loading entirely into memory
* **Encoding aware**: Automatic detection prevents encoding issues
* **Safe updates**: Temporary file operations prevent data loss

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
