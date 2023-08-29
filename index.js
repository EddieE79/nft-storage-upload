import 'dotenv/config';
// Import the NFTStorage class and File constructor from the 'nft.storage' package
import { NFTStorage, File } from 'nft.storage';

// The 'mime' npm package helps us set the correct file type on our File objects
import mime from 'mime';

// The 'fs' builtin module on Node.js provides access to the file system
import fs from 'fs/promises';

import { filesFromPaths } from 'files-from-path';

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
import { generateCountiresMetadata } from './metadataGenerator.js';

const UPLOAD_IMAGE_FOLDER = './uploads/images';
const UPLOAD_METADATA_FOLDER = './uploads/metadata';
const IMG_PROP_NAME = 'imageFiles';
const JSON_PROP_NAME = 'jsonFiles';

const JSON_FILES_PER_IMAGE = parseInt(process.env.JSON_FILES_PER_IMAGE);

async function main() {
  const { error, results } = await preUploadCheck();
  if (error) {
    logError('Pre-upload check failed');
    return;
  }
  logSuccess('Pre-upload check Succeeded');
  logSuccess('Beginning upload...');

  const imageCid = await uploadFolderItemsToNftStorage(UPLOAD_IMAGE_FOLDER);
  logTick(`Images uploaded successfully: Image CID: ${imageCid}`);

  await updateMetdataWithImageIpfs(imageCid, results);
  logTick(`Metadata updated with image ipfs`);

  const metaDataCid = await uploadFolderItemsToNftStorage(
    UPLOAD_METADATA_FOLDER
  );
  console.log(`Metadata uploaded successfully: Metadata CID: ${metaDataCid}`);

  await constructMetaIpfsArray(metaDataCid, results);
}

async function updateMetdataWithImageIpfs(cid, fileCheckResults) {
  const keys = Object.keys(fileCheckResults);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const item = fileCheckResults[key];
    const imgIpfs = `ipfs://${cid}/${item.imageFiles[0]}`;
    for (let j = 0; j < item.jsonFiles.length; j++) {
      const jsonFile = item.jsonFiles[j];
      const filePath = `${UPLOAD_METADATA_FOLDER}/${jsonFile}`;
      const metadata = await readFromJsonFile(filePath);
      metadata.image = imgIpfs;
      await saveToJsonFile(filePath, metadata);
    }
  }
}

async function constructMetaIpfsArray(cid, fileCheckResults) {
  const results = [];
  const keys = Object.keys(fileCheckResults);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const item = fileCheckResults[key];
    for (let j = 0; j < item.jsonFiles.length; j++) {
      const jsonFile = item.jsonFiles[j];
      const imgIpfs = `ipfs://${cid}/${jsonFile}`;
      results.push(imgIpfs);
    }
  }
  await saveToJsonFile('./results.json', { results });
}

async function uploadFolderItemsToNftStorage(folderPath) {
  const nftStorage = new NFTStorage({ token: process.env.NFT_STORAGE_KEY });
  const files = await filesFromPaths([folderPath], {
    pathPrefix: path.resolve(folderPath), // see the note about pathPrefix below
    hidden: true, // use the default of false if you want to ignore files that start with '.'
  });
  const cid = await nftStorage.storeDirectory(files);
  return cid;
}

async function fileFromPath(filePath) {
  const content = await fs.readFile(filePath);
  const type = mime.getType(filePath);
  return new File([content], path.basename(filePath), { type });
}

async function preUploadCheck() {
  //looks at all files in the directory and checks if that for every file that is an image, there is a corresponding json file of the smae name
  try {
    const knownImageExtensions = ['.png', '.jpg', '.jpeg', '.gif'];
    const imageItems = await getFileContent(
      UPLOAD_IMAGE_FOLDER,
      knownImageExtensions,
      IMG_PROP_NAME
    );
    const jsonItems = await getFileContent(
      UPLOAD_METADATA_FOLDER,
      ['.json'],
      JSON_PROP_NAME
    );
    console.log(imageItems);
    console.log(jsonItems);

    const mergedFiles = {};

    // Merge properties from object1
    for (const key in imageItems) {
      mergedFiles[key] = { ...mergedFiles[key], ...imageItems[key] };
    }

    // Merge properties from object2
    for (const key in jsonItems) {
      mergedFiles[key] = { ...mergedFiles[key], ...jsonItems[key] };
    }

    let failCount = 0;
    for (const [key, value] of Object.entries(mergedFiles)) {
      if (value.other) {
        logCross(`${value.other} is unexpected file type`);
        failCount++;
      } else if (value.imageFiles && !value.jsonFiles) {
        logCross(`${value.imageFiles} has no matching json`);
        failCount++;
      } else if (!value.imageFiles && value.jsonFiles) {
        logCross(`${value.jsonFiles} has no matching image`);
        failCount++;
      } else if (value.imageFiles.length > 1) {
        logCross(`${key} has more than one image file`);
        failCount++;
      } else if (value.jsonFiles.length !== JSON_FILES_PER_IMAGE) {
        logCross(
          `${key} expected to have ${JSON_FILES_PER_IMAGE} json files but has ${value.jsonFiles.length}`
        );
        failCount++;
      } else if (value.imageFiles && value.jsonFiles) {
        logTick(
          `'${key}' both 1 image file and ${JSON_FILES_PER_IMAGE} json file(s)`
        );
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
    return { results: mergedFiles, error: false };
  } catch (err) {
    logError('Error in preUploadCheck: ', err);
    return { results: null, error: true };
  }
}

async function getFileContent(fileFolder, allowedExtensions, propName) {
  try {
    const files = await fs.readdir(fileFolder);
    if (files.length === 0) {
      logInfo(`Directory '${fileFolder}' no has files`);
      return false;
    }
    const fileResults = {};
    files.forEach((file) => {
      const { code, extension } = getFilenameParts(file);

      let item = fileResults[code];
      if (!item) {
        item = {};
        item[propName] = [];
      }
      if (allowedExtensions.includes(extension)) {
        item[propName].push(file);
      } else {
        item[`non-${propName}`] = file;
      }
      fileResults[code] = item;
    });
    return fileResults;
  } catch (err) {
    console.log(err);
  }
}

function getFilenameParts(file) {
  const extension = path.extname(file);
  const baseName = path.basename(file, extension);
  //expect files to be called NZ_1.png and NZ_1.json
  // This way one image files can be mapped to multiple json files later on
  const code = baseName.split('_')[0];
  const extensionLowerCase = extension.toLowerCase();
  return { code, extension: extensionLowerCase };
}

//generateCountiresMetadata();
main();
