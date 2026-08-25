import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CarFront,
  CheckCircle2,
  CircleStop,
  Cpu,
  Flame,
  Info,
  Mic,
  ShieldCheck,
  Siren,
  UserRound,
  Volume2
} from "lucide-react";

import { loadYamnet } from "./yamnet.js";
import { AudioDetectionEngine } from "./audioEngine.js";

const dangerMeta = {
  green: {
    label: "안전",
    title: "특별한 위험이 감지되지 않았어요",
    icon: CheckCircle2
  },
  yellow: {
    label: "관심",
    title: "확인이 필요한 생활 소리가 감지됐어요",
    icon: Bell
  },
  orange: {
    label: "주의",
    title: "주의가 필요한 소리가 감지됐어요",
    icon: AlertTriangle
  },
  red: {
    label: "위험",
    title: "즉시 확인이 필요한 소리예요",
    icon: Siren
  }
};

function soundIcon(situation) {
  if (situation?.includes("vehicle")) return CarFront;
  if (situation?.includes("fire")) return Flame;
  if (situation?.includes("emergency")) return Siren;
  if (situation?.includes("visitor")) return UserRound;
  return Volume2;
}

export default function App() {
  const engineRef = useRef(null);

  const [running, setRunning] = useState(false);
  const [modelState, setModelState] = useState("loading");
  const [status, setStatus] = useState("AI 모델을 준비하는 중입니다...");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadYamnet()
      .then(() => {
        if (cancelled) return;
        setModelState("ready");
        setStatus("AI 모델 준비 완료. 감지 버튼을 눌러주세요.");
      })
      .catch((err) => {
        console.error(err);
        if (cancelled) return;
        setModelState("error");
        setError(
          `YAMNet 모델을 불러오지 못했습니다: ${err.message}`
        );
        setStatus("모델 로딩 실패");
      });

    return () => {
      cancelled = true;
      engineRef.current?.stop();
    };
  }, []);

  const start = async () => {
    if (modelState !== "ready") {
      setError("YAMNet 모델 준비가 끝난 뒤 다시 눌러주세요.");
      return;
    }

    setError("");

    const engine = new AudioDetectionEngine({
      onStatus: setStatus,
      onAnalysis: setResult,
      onError: setError
    });

    engineRef.current = engine;

    try {
      await engine.start();
      setRunning(true);
    } catch (err) {
      console.error(err);
      setError(
        `마이크를 시작하지 못했습니다: ${err.message}`
      );
      setStatus("마이크 권한 또는 브라우저 설정을 확인해주세요.");
      setRunning(false);
      engine.stop();
    }
  };

  const stop = () => {
    engineRef.current?.stop();
    engineRef.current = null;
    setRunning(false);
  };

  const color = result?.color ?? "green";
  const meta = dangerMeta[color] ?? dangerMeta.green;
  const StatusIcon = meta.icon;
  const ResultIcon = soundIcon(result?.situation);

  const levelText =
    ["", "안전", "관심", "주의", "위험"][
      result?.danger_level ?? 1
    ];

  return (
    <div className={`app theme-${color}`}>
      <header className="topbar">
        <div>
          <div className="brand">SoundAlert</div>
          <div className="subtitle">
            청각장애인을 위한 실시간 생활 소리 알림
          </div>
        </div>

        <div className={`live-pill ${running ? "on" : ""}`}>
          <span className="dot" />
          {running ? "LIVE" : "OFF"}
        </div>
      </header>

      <main className="content">
        <section className="privacy-banner">
          <ShieldCheck size={18} />
          <div>
            <strong>브라우저 안에서 AI 분석</strong>
            <span>
              마이크 소리를 별도 서버로 전송하지 않고,
              TensorFlow.js YAMNet이 현재 기기에서 분석합니다.
            </span>
          </div>
        </section>

        <section className="hero-card">
          <div className="status-row">
            <div className="status-icon">
              <StatusIcon size={22} />
            </div>
            <div>
              <div className="eyebrow">{meta.label}</div>
              <h1>{meta.title}</h1>
            </div>
          </div>

          <div className="result-panel">
            <div className="big-icon">
              <ResultIcon size={46} />
            </div>

            <div className="result-main">
              <div className="result-name">
                {result?.display_name ??
                  "실시간 감지를 시작해주세요"}
              </div>
              <div className="result-sub">
                {result
                  ? `YAMNet: ${result.yamnet_label}`
                  : "대상 소리가 감지되면 결과가 표시됩니다."}
              </div>
            </div>

            <div className="confidence">
              <strong>
                {result
                  ? `${result.yamnet_confidence}%`
                  : "-"}
              </strong>
              <span>예측 점수</span>
            </div>
          </div>

          <div className="score-row">
            <div>
              <span>위험도</span>
              <strong>
                {result ? `${result.danger_score}/100` : "-"}
              </strong>
            </div>
            <div className={`level level-${color}`}>
              {levelText}
            </div>
          </div>

          <div className="progress">
            <div
              className="progress-fill"
              style={{
                width: `${Math.min(
                  result?.danger_score ?? 0,
                  100
                )}%`
              }}
            />
          </div>

          <div className="action-card">
            <Info size={20} />
            <div>
              <div className="action-label">추천 행동</div>
              <div className="action-text">
                {result?.action ??
                  "아직 분석 결과가 없습니다."}
              </div>
            </div>
          </div>

          {result?.persistence > 1 && (
            <div className="persistence">
              같은 상황이 연속 {result.persistence}회
              감지되고 있습니다.
            </div>
          )}
        </section>

        <section className="control-card">
          <button
            className={`mic-button ${running ? "stop" : ""}`}
            onClick={running ? stop : start}
            disabled={modelState === "loading"}
          >
            {running ? (
              <CircleStop size={22} />
            ) : modelState === "loading" ? (
              <Cpu size={22} className="spin" />
            ) : (
              <Mic size={22} />
            )}

            {running
              ? "실시간 감지 끄기"
              : modelState === "loading"
                ? "YAMNet 준비 중..."
                : "실시간 소리 감지 시작"}
          </button>

          <div className="connection">
            <span
              className={`connection-dot ${
                modelState === "ready" ? "good" : ""
              }`}
            />
            {status}
          </div>

          {error && (
            <div className="error-box">
              <AlertTriangle size={18} />
              <span>{error}</span>
            </div>
          )}
        </section>

        <section className="history-card">
          <div className="section-title">
            <Volume2 size={19} />
            대상 소리 상위 예측
          </div>

          <div className="top-list">
            {(result?.top5 ?? []).map((item, index) => (
              <div
                className="top-item"
                key={`${item.label}-${index}`}
              >
                <span>{index + 1}</span>
                <div className="bar-wrap">
                  <div className="bar-label">
                    <span>{item.label}</span>
                    <strong>{item.confidence}%</strong>
                  </div>
                  <div className="bar">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.min(
                          item.confidence,
                          100
                        )}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}

            {!result?.top5?.length && (
              <div className="empty">
                감지를 시작하면 예측 결과가 표시됩니다.
              </div>
            )}
          </div>
        </section>

        <section className="notice-card">
          <strong>알아두세요</strong>
          <p>
            YAMNet은 범용 AudioSet 분류 모델입니다.
            전자레인지나 특정 재난문자 알림음은 전용 클래스로
            학습된 것이 아니므로, 현재 버전에서는 범용
            Beep/Alarm 계열로 안내될 수 있습니다.
          </p>
        </section>

        <footer>
          <span>React · Vite · TensorFlow.js · YAMNet</span>
          <span>Serverless GitHub Pages edition</span>
        </footer>
      </main>
    </div>
  );
}
