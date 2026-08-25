import { analyzeWaveform } from "./yamnet.js";
import {
  SOUND_RULES,
  findRuleByLabel,
  calculateDangerScore,
  getDangerLevel
} from "./rules.js";

function concatFloat32(current, chunk, maxLength) {
  const combinedLength = current.length + chunk.length;
  const outputLength = Math.min(combinedLength, maxLength);
  const output = new Float32Array(outputLength);

  if (combinedLength <= maxLength) {
    output.set(current, 0);
    output.set(chunk, current.length);
    return output;
  }

  const oldNeeded = Math.max(0, maxLength - chunk.length);
  if (oldNeeded > 0) {
    output.set(current.subarray(current.length - oldNeeded), 0);
  }

  const chunkStart = Math.max(0, chunk.length - maxLength);
  output.set(chunk.subarray(chunkStart), oldNeeded);
  return output;
}

function smoothHistory(history) {
  if (!history.length) return {};

  const weights =
    history.length === 1
      ? [1]
      : history.length === 2
        ? [0.4, 0.6]
        : [0.2, 0.3, 0.5];

  const recent = history.slice(-weights.length);
  const labels = new Set();

  recent.forEach((snapshot) => {
    Object.keys(snapshot).forEach((label) => labels.add(label));
  });

  const smoothed = {};
  for (const label of labels) {
    let value = 0;
    recent.forEach((snapshot, index) => {
      value += (snapshot[label] ?? 0) * weights[index];
    });
    smoothed[label] = value;
  }

  return smoothed;
}

function buildAnalysis(smoothedScores, persistenceState) {
  const ranked = Object.entries(smoothedScores)
    .sort((a, b) => b[1] - a[1]);

  const top5 = ranked.slice(0, 5).map(([label, confidence]) => ({
    label,
    confidence: Math.round(confidence * 10000) / 100
  }));

  // 같은 상황에 연결된 유사 라벨들은 하나의 이벤트로 묶습니다.
  // 예: Vehicle horn + Toot이 동시에 높아도 위험음 2개로 잘못 세지 않음.
  const bestBySituation = new Map();

  for (const [label, confidence] of ranked) {
    const rule = findRuleByLabel(label);
    if (!rule || confidence < rule.minConfidence) continue;

    const current = bestBySituation.get(rule.situation);
    if (!current || confidence > current.confidence) {
      bestBySituation.set(rule.situation, {
        label,
        confidence,
        rule
      });
    }
  }

  const candidates = [...bestBySituation.values()].sort(
    (a, b) =>
      b.rule.baseDanger * b.confidence -
      a.rule.baseDanger * a.confidence
  );

  if (!candidates.length) {
    persistenceState.key = null;
    persistenceState.count = 0;

    return {
      situation: "unknown",
      display_name: "일반 소리",
      danger_score: 0,
      danger_level: 1,
      color: "green",
      action: "특별한 조치가 필요하지 않습니다.",
      yamnet_label: ranked[0]?.[0] ?? "Unknown",
      yamnet_confidence: ranked.length
        ? Math.round(ranked[0][1] * 10000) / 100
        : 0,
      top5,
      persistence: 0
    };
  }

  const best = candidates[0];

  if (persistenceState.key === best.rule.situation) {
    persistenceState.count += 1;
  } else {
    persistenceState.key = best.rule.situation;
    persistenceState.count = 1;
  }

  const score = calculateDangerScore(
    best.rule.baseDanger,
    best.confidence,
    persistenceState.count,
    candidates.length
  );
  const { dangerLevel, color } = getDangerLevel(score);

  return {
    situation: best.rule.situation,
    display_name: best.rule.displayName,
    danger_score: score,
    danger_level: dangerLevel,
    color,
    action: best.rule.action,
    yamnet_label: best.label,
    yamnet_confidence: Math.round(best.confidence * 10000) / 100,
    top5,
    persistence: persistenceState.count
  };
}

export class AudioDetectionEngine {
  constructor({ onStatus, onAnalysis, onError }) {
    this.onStatus = onStatus;
    this.onAnalysis = onAnalysis;
    this.onError = onError;

    this.stream = null;
    this.audioContext = null;
    this.source = null;
    this.processor = null;

    this.windowBuffer = new Float32Array(0);
    this.samplesSinceAnalysis = 0;
    this.inferenceRunning = false;

    this.scoreHistory = [];
    this.persistenceState = { key: null, count: 0 };
    this.running = false;
  }

  async start() {
    if (this.running) return;

    this.onStatus?.("마이크 권한을 요청하는 중입니다...");

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    // 브라우저가 허용하면 처음부터 16 kHz context를 요청합니다.
    try {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
    } catch {
      this.audioContext = new AudioContext();
    }

    await this.audioContext.resume();

    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    const sampleRate = this.audioContext.sampleRate;
    const windowSamples = Math.round(sampleRate * 2);
    const hopSamples = Math.round(sampleRate * 1);

    this.windowBuffer = new Float32Array(0);
    this.samplesSinceAnalysis = 0;
    this.scoreHistory = [];
    this.persistenceState = { key: null, count: 0 };
    this.running = true;

    this.processor.onaudioprocess = (event) => {
      if (!this.running) return;

      const chunk = new Float32Array(
        event.inputBuffer.getChannelData(0)
      );

      this.windowBuffer = concatFloat32(
        this.windowBuffer,
        chunk,
        windowSamples
      );

      this.samplesSinceAnalysis += chunk.length;

      if (
        this.windowBuffer.length >= windowSamples &&
        this.samplesSinceAnalysis >= hopSamples &&
        !this.inferenceRunning
      ) {
        this.samplesSinceAnalysis = 0;
        const segment = new Float32Array(this.windowBuffer);
        this.runInference(segment, sampleRate);
      }
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.onStatus?.("실시간 감지 중");
  }

  async runInference(segment, sampleRate) {
    this.inferenceRunning = true;

    try {
      const inference = await analyzeWaveform(segment, sampleRate);

      if (inference.silent) {
        this.scoreHistory = [];
        this.persistenceState = { key: null, count: 0 };
        this.onAnalysis?.({
          situation: "unknown",
          display_name: "조용한 환경",
          danger_score: 0,
          danger_level: 1,
          color: "green",
          action: "현재 뚜렷한 대상 소리가 감지되지 않았습니다.",
          yamnet_label: "Silence / low level",
          yamnet_confidence: 0,
          top5: [],
          persistence: 0
        });
        return;
      }

      this.scoreHistory.push(inference.targetScores);
      if (this.scoreHistory.length > 3) {
        this.scoreHistory.shift();
      }

      const smoothed = smoothHistory(this.scoreHistory);
      const analysis = buildAnalysis(
        smoothed,
        this.persistenceState
      );

      this.onAnalysis?.(analysis);
    } catch (error) {
      console.error(error);
      this.onError?.(
        `소리 분석 중 오류가 발생했습니다: ${error.message}`
      );
    } finally {
      this.inferenceRunning = false;
    }
  }

  stop() {
    this.running = false;

    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
    }

    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());

    if (this.audioContext && this.audioContext.state !== "closed") {
      this.audioContext.close();
    }

    this.stream = null;
    this.audioContext = null;
    this.source = null;
    this.processor = null;
    this.windowBuffer = new Float32Array(0);
    this.scoreHistory = [];
    this.persistenceState = { key: null, count: 0 };
    this.inferenceRunning = false;

    this.onStatus?.("실시간 감지가 꺼졌습니다.");
  }
}
