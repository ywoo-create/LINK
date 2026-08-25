export const SOUND_RULES = [
  {
    labels: [
      "Vehicle horn, car horn, honking",
      "Toot"
    ],
    situation: "vehicle_approaching",
    displayName: "차량 경적",
    baseDanger: 75,
    minConfidence: 0.50,
    action: "주변 차량을 확인하고 안전한 위치인지 확인하세요.",
    category: "traffic"
  },
  {
    labels: ["Air horn, truck horn"],
    situation: "vehicle_approaching",
    displayName: "대형 차량 경적",
    baseDanger: 80,
    minConfidence: 0.50,
    action: "대형 차량이 가까이 있는지 확인하고 차도에서 거리를 두세요.",
    category: "traffic"
  },
  {
    labels: ["Car alarm"],
    situation: "vehicle_alarm",
    displayName: "자동차 경보음",
    baseDanger: 65,
    minConfidence: 0.55,
    action: "주변 차량과 상황을 확인하세요.",
    category: "traffic"
  },
  {
    labels: [
      "Emergency vehicle",
      "Police car (siren)",
      "Ambulance (siren)",
      "Fire engine, fire truck (siren)",
      "Siren"
    ],
    situation: "emergency_vehicle",
    displayName: "긴급 차량 사이렌",
    baseDanger: 85,
    minConfidence: 0.45,
    action: "긴급 차량의 이동 방향을 확인하고 안전한 곳으로 이동하세요.",
    category: "emergency"
  },
  {
    labels: [
      "Smoke detector, smoke alarm",
      "Fire alarm"
    ],
    situation: "fire_alarm",
    displayName: "화재 경보",
    baseDanger: 95,
    minConfidence: 0.42,
    action: "즉시 주변을 확인하고 화재 가능성이 있으면 안전한 곳으로 대피하세요.",
    category: "fire"
  },
  {
    labels: [
      "Glass",
      "Shatter",
      "Breaking"
    ],
    situation: "glass_breaking",
    displayName: "유리 파손",
    baseDanger: 80,
    minConfidence: 0.50,
    action: "깨진 유리나 사고가 있는지 확인하고 파손 지점에 접근하지 마세요.",
    category: "accident"
  },
  {
    labels: [
      "Doorbell",
      "Ding-dong"
    ],
    situation: "visitor",
    displayName: "초인종 / 방문자",
    baseDanger: 10,
    minConfidence: 0.58,
    action: "현관이나 방문자가 있는지 확인하세요.",
    category: "daily"
  },
  {
    labels: ["Baby cry, infant cry"],
    situation: "baby_cry",
    displayName: "아기 울음",
    baseDanger: 30,
    minConfidence: 0.48,
    action: "주변에 아기가 있는지 확인하고 필요한 도움이 있는지 살펴보세요.",
    category: "daily"
  },
  {
    labels: ["Explosion"],
    situation: "explosion",
    displayName: "폭발음",
    baseDanger: 100,
    minConfidence: 0.45,
    action: "즉시 주변 상황을 확인하고 위험 지역에서 멀리 이동하세요.",
    category: "emergency"
  },
  {
    labels: ["Beep, bleep"],
    situation: "notification_beep",
    displayName: "전자기기 알림음",
    baseDanger: 25,
    minConfidence: 0.60,
    action: "전자레인지, 타이머 등 주변 전자기기의 알림을 확인하세요.",
    category: "daily"
  },
  {
    labels: ["Alarm clock"],
    situation: "notification_alarm",
    displayName: "알람음",
    baseDanger: 20,
    minConfidence: 0.55,
    action: "주변 기기의 알람이나 알림 내용을 확인하세요.",
    category: "daily"
  }
];

export const TARGET_LABELS = new Set(
  SOUND_RULES.flatMap((rule) => rule.labels)
);

export function findRuleByLabel(label) {
  return SOUND_RULES.find((rule) => rule.labels.includes(label));
}

export function calculateDangerScore(
  baseDanger,
  confidence,
  persistence = 1,
  multipleSounds = 1
) {
  const safeConfidence = Math.max(0, Math.min(Number(confidence), 1));
  let score = baseDanger * safeConfidence;

  if (persistence >= 3) score += 10;
  else if (persistence >= 2) score += 5;

  if (multipleSounds >= 2) score += 5;

  return Math.round(Math.max(0, Math.min(score, 100)) * 10) / 10;
}

export function getDangerLevel(score) {
  if (score >= 80) return { dangerLevel: 4, color: "red" };
  if (score >= 60) return { dangerLevel: 3, color: "orange" };
  if (score >= 30) return { dangerLevel: 2, color: "yellow" };
  return { dangerLevel: 1, color: "green" };
}
