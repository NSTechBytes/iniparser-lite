const IniParser = require("../index");
const parser = new IniParser();
const filePath = "test/test.ini";

// Parse with callback
parser.parseFile(filePath, (section, data) => {
  console.log(`[${section}]`, data);
});

// Update (case-insensitive section/key matching, preserve case in file)
parser.setValue(filePath, "SeTTinGs", "LanGuaGe", "FR")
  .then(() => console.log("Updated successfully."))
  .catch(console.error);
