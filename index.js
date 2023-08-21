import 'dotenv/config';
// Import the NFTStorage class and File constructor from the 'nft.storage' package
import { NFTStorage, File } from 'nft.storage';

// The 'mime' npm package helps us set the correct file type on our File objects
import mime from 'mime';

// The 'fs' builtin module on Node.js provides access to the file system
import fs from 'fs/promises';

// The 'path' module provides helpers for manipulating filesystem paths
import path from 'path';
import {
  logCross,
  logError,
  logSuccess,
  logTick,
  logInfo,
} from './consoleLogger.js';
import { readFromJsonFile, saveToJsonFile } from './jsonFileHelper.js';

const UPLOAD_FOLDER = './uploads';

async function main() {
  console.log(process.env.NFT_STORAGE_API_KEY);
  const { error, results } = await preUploadCheck();
  if (error) {
    logError('Pre-upload check failed');
    return;
  }
  logSuccess('Pre-upload check Succeeded');
  logSuccess('Beginning upload...');
  const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });
  console.log(results);
  const keys = Object.keys(results);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const item = results[key];
    logInfo(`Attempting '${item.imageFile}' (${i + 1} of ${keys.length})`);
    const image = await fileFromPath(`${UPLOAD_FOLDER}/${item.imageFile}`);
    const metadata = await readFromJsonFile(
      `${UPLOAD_FOLDER}/${item.jsonFile}`
    );

    const uploadItem = { image, ...metadata };
    const uploadResults = await nftStorage.store(uploadItem);
    console.log(uploadResults);
  }
}

async function fileFromPath(filePath) {
  const content = await fs.readFile(filePath);
  const type = mime.getType(filePath);
  return new File([content], path.basename(filePath), { type });
}

async function preUploadCheck() {
  //looks at all files in the directory and checks if that for every file that is an image, there is a corresponding json file of the smae name
  try {
    const files = await fs.readdir(UPLOAD_FOLDER);
    if (files.length === 0) {
      console.info('No files to upload');
      return false;
    }
    const knownImageExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
    const fileResults = {};
    files.forEach((file) => {
      const extension = path.extname(file);
      const baseName = path.basename(file, extension);
      let item = fileResults[baseName];
      if (knownImageExtensions.includes(extension.toLowerCase())) {
        item = { ...item, imageFile: file };
      } else if (extension === '.json') {
        item = { ...item, jsonFile: file };
      } else {
        item = { ...item, other: file };
      }

      fileResults[baseName] = item;
      //console.log(file);
      //console.log(path.extname(file));
      //console.log(mime.getType(file));
    });
    let failCount = 0;
    for (const [key, value] of Object.entries(fileResults)) {
      if (value.other) {
        logCross(`${value.other} is unexpected file type`);
        failCount++;
      } else if (value.imageFile && !value.jsonFile) {
        logCross(`${value.imageFile} has no matching json`);
        failCount++;
      } else if (!value.imageFile && value.jsonFile) {
        logCross(`${value.jsonFile} has no matching image`);
        failCount++;
      } else if (value.imageFile && value.jsonFile) {
        logTick(`'${key}' both image and json`);
      } else {
        // Shouldn't ever get here...but...YOU NEVER KNOW!!
        logCross(`${key} has no image or json`);
        failCount++;
      }
    }
    if (failCount > 0) {
      logError('PRE-CHECK FAILED');
      logError(
        `Out of ${files.length} files, ${failCount} ${
          failCount === 1 ? 'has' : 'have'
        } issues that should be addressed before upload`
      );
      return { error: true };
    }
    return { results: fileResults };
  } catch (err) {
    logError('Error in preUploadCheck: ', err);
  }
}

main();
