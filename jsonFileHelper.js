import fs from 'fs/promises';
import { logError, logTick } from './consoleLogger.js';

// Function to read the JSON file
export async function readFromJsonFile(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath));
  } catch (error) {
    logError(`Error reading file from disk: ${error}`);
    return null;
  }
}

// Function to write a JSON object to the file
export async function saveToJsonFile(filePath, obj) {
  try {
    await fs.writeFile(filePath, JSON.stringify(obj));
    logTick('File written successfully');
  } catch (error) {
    logError(`Error writing file to disk: ${error}`);
  }
}

function checkIsJsonFile(filePath) {
  if (!filePath.endsWith('.json')) {
    throw new Error('Not a JSON file');
  }
}
