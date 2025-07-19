# iniparser-lite

A robust, streaming INI file parser for Node.js with automatic encoding detection and case-insensitive operations.

## Features

- **Streaming Parser**: Memory-efficient parsing of large INI files
- **Automatic Encoding Detection**: Supports UTF-8, UTF-16, Windows-1252, and more
- **Case-Insensitive Operations**: Find and modify sections/keys regardless of case
- **Preserves Original Casing**: Maintains original section and key names when updating
- **Smart Value Quoting**: Automatic quote handling with configurable quoting behavior
- **Robust Error Handling**: Graceful handling of malformed lines and encoding issues
- **Section-by-Section Processing**: Process INI files section by section with callbacks

## Installation

```bash
npm install iniparser-lite
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

### Setting Values

```javascript
const IniParser = require('iniparser-lite');

const parser = new IniParser();

// Update or add a key-value pair (case-insensitive)
await parser.setValue('config.ini', 'Database', 'host', 'localhost');
await parser.setValue('config.ini', 'database', 'PORT', '5432'); // Case doesn't matter

// Control quoting behavior (new feature)
await parser.setValue('config.ini', 'Settings', 'count', '42', { quote: false }); // No quotes
await parser.setValue('config.ini', 'Settings', 'name', 'MyApp', { quote: true }); // Force quotes
await parser.setValue('config.ini', 'Settings', 'enabled', 'true'); // Auto-quoting (no quotes for boolean/numeric)
```

### Example INI File

```ini
[Database]
host=localhost
port=5432
username="admin"
password='secret123'

[Application]
name=MyApp
version=1.0.0
debug=true
count=42
enabled=1
```

## API Reference

### `parseFile(filePath, onSectionParsed)`

Streams and parses INI sections with a callback.

**Parameters:**
- `filePath` (string): Path to the INI file
- `onSectionParsed` (function): Callback function called for each section
  - `section` (string): Section name
  - `data` (object): Key-value pairs in the section

**Returns:** Promise

### `setValue(filePath, section, key, value, options)`

Updates or adds a key-value pair under a section directly in the file.

**Parameters:**
- `filePath` (string): Path to the INI file
- `section` (string): Section name (case-insensitive)
- `key` (string): Key name (case-insensitive)
- `value` (string): Value to write
- `options` (object, optional): Configuration options
  - `quote` (boolean): Control quoting behavior
    - `true`: Always add quotes around the value
    - `false`: Never add quotes around the value
    - `undefined` (default): Auto-quote based on value type

**Returns:** Promise

## Features in Detail

### Encoding Detection

The parser automatically detects file encoding using the first 4KB of the file. Supported encodings include:
- UTF-8
- UTF-16 (LE/BE)
- Windows-1252 (default fallback)
- ASCII
- And more via `chardet` library

### Case-Insensitive Operations

Operations are case-insensitive for matching but preserve original casing:

```javascript
// Original file has [Database] and Host=localhost
await parser.setValue('config.ini', 'database', 'host', 'newhost');
// Result: [Database] section with Host=newhost (original casing preserved)
```

### Smart Value Quoting

The parser now includes intelligent quoting behavior for INI values:

#### Auto-Quoting (Default Behavior)
When no quoting option is specified, the parser automatically determines whether to quote values:

```javascript
// These values are written WITHOUT quotes (numeric/boolean detection)
await parser.setValue('config.ini', 'Settings', 'port', '8080');     // → port=8080
await parser.setValue('config.ini', 'Settings', 'count', '42');      // → count=42
await parser.setValue('config.ini', 'Settings', 'enabled', 'true');  // → enabled=true
await parser.setValue('config.ini', 'Settings', 'disabled', 'false'); // → disabled=false
await parser.setValue('config.ini', 'Settings', 'flag', '1');        // → flag=1
await parser.setValue('config.ini', 'Settings', 'off', '0');         // → off=0

// String values are typically written with quotes when they contain spaces or special characters
await parser.setValue('config.ini', 'Settings', 'name', 'My Application'); // → name="My Application"
await parser.setValue('config.ini', 'Settings', 'path', '/usr/bin');       // → path=/usr/bin
```

#### Manual Quoting Control
You can explicitly control quoting behavior:

```javascript
// Force quotes around any value
await parser.setValue('config.ini', 'Settings', 'version', '1.0', { quote: true });
// Result: version="1.0"

// Prevent quotes around any value  
await parser.setValue('config.ini', 'Settings', 'title', 'My App', { quote: false });
// Result: title=My App
```

### Quote Handling During Parsing

Values are automatically cleaned of matching quotes during parsing:

```ini
key1="value"     # Parsed as: value
key2='value'     # Parsed as: value  
key3="value'     # Parsed as: "value' (non-matching quotes)
key4=unquoted    # Parsed as: unquoted
```

### Error Handling

The parser gracefully handles:
- Malformed lines (logs warnings and continues)
- Encoding detection failures (falls back to Windows-1252)
- Global keys outside sections (logs warnings and skips)
- File system errors (propagates with proper cleanup)

## Requirements

- Node.js 12.0.0 or higher
- Dependencies: `chardet`, `iconv-lite`

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request