import * as tf from "@tensorflow/tfjs";
import { SOUND_RULES, TARGET_LABELS } from "./rules.js";

const TARGET_SAMPLE_RATE = 16000;
const MODEL_PATH = `${import.meta.env.BASE_URL}model/model.json`;
const CLASS_MAP_PATH = `${import.meta.env.BASE_URL}model/assets/yamnet_class_map.csv`;

let model = null;
let classNames = null;
let targetIndexes = null;

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];

    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === "," && !quoted) {
      values.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  values.push(current);
  return values;
}

async function loadClassNames() {
  const response = await fetch(CLASS_MAP_PATH);
  if (!response.ok) {
    throw new Error(`YAMNet class map을 불러오지 못했습니다. (${response.status})`);
  }

  const text = await response.text();
  const lines = text.trim().split(/\r?\n/).slice(1);

  const names = [];
  for (const line of lines) {
    const [index, , displayName] = parseCsvLine(line);
    names[Number(index)] = displayName;
  }
  return names;
}

export async function loadYamnet() {
  if (model && classNames && targetIndexes) {
    return { model, classNames, targetIndexes };
  }

  await tf.ready();

  // WebGL을 사용할 수 있으면 브라우저 GPU를 활용합니다.
  try {
    if (tf.getBackend() !== "webgl") {
      await tf.setBackend("webgl");
      await tf.ready();
    }
  } catch {
    // WebGL 사용이 불가능한 기기에서는 TensorFlow.js가 가능한 backend를 사용합니다.
  }

  const [loadedModel, loadedNames] = await Promise.all([
    tf.loadGraphModel(MODEL_PATH),
    loadClassNames()
  ]);

  model = loadedModel;
  classNames = loadedNames;

  targetIndexes = new Map();
  classNames.forEach((name, index) => {
    if (TARGET_LABELS.has(name)) {
      targetIndexes.set(name, index);
    }
  });

  const missing = [...TARGET_LABELS].filter((label) => !targetIndexes.has(label));
  if (missing.length) {
    console.warn("YAMNet class map에서 찾지 못한 규칙 라벨:", missing);
  }

  return { model, classNames, targetIndexes };
}

function linearResample(input, inputRate, outputRate = TARGET_SAMPLE_RATE) {
  if (inputRate === outputRate) return new Float32Array(input);

  const ratio = inputRate / outputRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let i = 0; i < outputLength; i += 1) {
    const sourceIndex = i * ratio;
    const left = Math.floor(sourceIndex);
    const right = Math.min(left + 1, input.length - 1);
    const fraction = sourceIndex - left;
    output[i] = input[left] * (1 - fraction) + input[right] * fraction;
  }

  return output;
}

async function browserResample(input, inputRate) {
  if (inputRate === TARGET_SAMPLE_RATE) return new Float32Array(input);

  try {
    const outputLength = Math.ceil(
      input.length * TARGET_SAMPLE_RATE / inputRate
    );

    const offline = new OfflineAudioContext(
      1,
      outputLength,
      TARGET_SAMPLE_RATE
    );

    const buffer = offline.createBuffer(1, input.length, inputRate);
    buffer.copyToChannel(input, 0);

    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(offline.destination);
    source.start(0);

    const rendered = await offline.startRendering();
    return new Float32Array(rendered.getChannelData(0));
  } catch {
    return linearResample(input, inputRate);
  }
}

function preprocess(waveform) {
  const output = new Float32Array(waveform.length);

  let mean = 0;
  for (let i = 0; i < waveform.length; i += 1) {
    mean += waveform[i];
  }
  mean /= Math.max(1, waveform.length);

  let peak = 0;
  for (let i = 0; i < waveform.length; i += 1) {
    const value = waveform[i] - mean;
    output[i] = value;
    peak = Math.max(peak, Math.abs(value));
  }

  if (peak > 1) {
    for (let i = 0; i < output.length; i += 1) {
      output[i] /= peak;
    }
  }

  return output;
}

function rms(waveform) {
  if (!waveform.length) return 0;
  let sum = 0;
  for (let i = 0; i < waveform.length; i += 1) {
    sum += waveform[i] * waveform[i];
  }
  return Math.sqrt(sum / waveform.length);
}

function getScoreTensor(output) {
  const tensors = Array.isArray(output)
    ? output
    : output instanceof tf.Tensor
      ? [output]
      : Object.values(output);

  // YAMNet scores의 마지막 차원은 521입니다.
  const scoreTensor = tensors.find(
    (tensor) => tensor?.shape?.[tensor.shape.length - 1] === 521
  );

  if (!scoreTensor) {
    tensors.forEach((tensor) => tensor?.dispose?.());
    throw new Error("YAMNet scores 출력을 찾지 못했습니다.");
  }

  return { scoreTensor, tensors };
}

function aggregateFrameScores(frameValues) {
  if (!frameValues.length) return 0;

  const mean =
    frameValues.reduce((sum, value) => sum + value, 0) / frameValues.length;
  const max = Math.max(...frameValues);
  const presence =
    frameValues.filter((value) => value >= 0.35).length / frameValues.length;

  // 순간적인 경적/벨도 놓치지 않으면서 한 frame의 오인식을 완화합니다.
  return Math.max(
    0,
    Math.min(1, mean * 0.45 + max * 0.35 + presence * 0.20)
  );
}

export async function analyzeWaveform(nativeWaveform, nativeSampleRate) {
  const { model: loadedModel, targetIndexes: indexes } = await loadYamnet();

  let waveform = await browserResample(nativeWaveform, nativeSampleRate);
  waveform = preprocess(waveform);

  if (waveform.length < TARGET_SAMPLE_RATE) {
    return { silent: true, targetScores: {} };
  }

  if (rms(waveform) < 0.003) {
    return { silent: true, targetScores: {} };
  }

  const input = tf.tensor1d(waveform, "float32");
  let output;

  try {
    output = loadedModel.predict(input);
    const { scoreTensor, tensors } = getScoreTensor(output);
    const matrix = await scoreTensor.array();

    const targetScores = {};
    for (const [label, index] of indexes.entries()) {
      const values = matrix.map((row) => Number(row[index] ?? 0));
      targetScores[label] = aggregateFrameScores(values);
    }

    tensors.forEach((tensor) => tensor?.dispose?.());
    input.dispose();

    return {
      silent: false,
      targetScores
    };
  } catch (error) {
    input.dispose();

    if (Array.isArray(output)) {
      output.forEach((tensor) => tensor?.dispose?.());
    } else if (output && typeof output === "object") {
      Object.values(output).forEach((tensor) => tensor?.dispose?.());
    }

    throw error;
  }
}

export function getModelInfo() {
  return {
    targetSampleRate: TARGET_SAMPLE_RATE,
    ruleCount: SOUND_RULES.length,
    modelLoaded: Boolean(model)
  };
}
