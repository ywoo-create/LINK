import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import * as tar from "tar";

const MODEL_ARCHIVES = [
  "https://storage.googleapis.com/tfhub-tfjs-modules/google/tfjs-model/yamnet/tfjs/1.tar.gz",
  "https://tfhub.dev/google/tfjs-model/yamnet/tfjs/1?tfjs-format=compressed"
];

const CLASS_MAP =
  "https://raw.githubusercontent.com/tensorflow/models/master/research/audioset/yamnet/yamnet_class_map.csv";

const projectRoot = process.cwd();
const publicModel = path.join(projectRoot, "public", "model");

async function download(url, destination) {
  console.log(`Downloading: ${url}`);

  const response = await fetch(url, {
    redirect: "follow"
  });

  if (!response.ok || !response.body) {
    throw new Error(
      `Download failed (${response.status}): ${url}`
    );
  }

  await fs.mkdir(path.dirname(destination), {
    recursive: true
  });

  const fileStream = fsSync.createWriteStream(destination);
  await pipeline(
    Readable.fromWeb(response.body),
    fileStream
  );
}

async function findFile(directory, filename) {
  const entries = await fs.readdir(directory, {
    withFileTypes: true
  });

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isFile() && entry.name === filename) {
      return fullPath;
    }

    if (entry.isDirectory()) {
      const found = await findFile(fullPath, filename);
      if (found) return found;
    }
  }

  return null;
}

async function main() {
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "soundalert-yamnet-")
  );

  const archivePath = path.join(tempRoot, "yamnet.tar.gz");
  const extractPath = path.join(tempRoot, "extracted");

  await fs.mkdir(extractPath, { recursive: true });

  try {
    let modelDownloaded = false;
    let lastError = null;

    for (const url of MODEL_ARCHIVES) {
      try {
        await download(url, archivePath);
        modelDownloaded = true;
        break;
      } catch (error) {
        lastError = error;
        console.warn(`Model download source failed: ${url}`);
      }
    }

    if (!modelDownloaded) {
      throw lastError ?? new Error("YAMNet model download failed.");
    }

    console.log("Extracting YAMNet TensorFlow.js model...");
    await tar.x({
      file: archivePath,
      cwd: extractPath
    });

    const modelJson = await findFile(
      extractPath,
      "model.json"
    );

    if (!modelJson) {
      throw new Error(
        "압축파일 안에서 model.json을 찾지 못했습니다."
      );
    }

    const modelDirectory = path.dirname(modelJson);

    await fs.rm(publicModel, {
      recursive: true,
      force: true
    });

    await fs.mkdir(publicModel, {
      recursive: true
    });

    await fs.cp(modelDirectory, publicModel, {
      recursive: true
    });

    await download(
      CLASS_MAP,
      path.join(
        publicModel,
        "assets",
        "yamnet_class_map.csv"
      )
    );

    console.log("");
    console.log("YAMNet model prepared successfully.");
    console.log(`Output: ${publicModel}`);
  } finally {
    await fs.rm(tempRoot, {
      recursive: true,
      force: true
    });
  }
}

main().catch((error) => {
  console.error("");
  console.error("YAMNet model preparation failed.");
  console.error(error);
  process.exit(1);
});
