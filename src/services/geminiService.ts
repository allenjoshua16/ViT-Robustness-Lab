export interface ClassificationResult {
  label: string;
  confidence: number;
  explanation: string;
  topK: { label: string; confidence: number }[];
}

export interface AttentionMapData {
  patches: {
    x: number;
    y: number;
    importance: number; // 0 to 1
  }[];
  summary: string;
}

export const analyzeImage = async (base64Image: string): Promise<ClassificationResult> => {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Image }),
  });
  if (!response.ok) throw new Error("Analysis failed");
  return response.json();
};

export const getAttentionMap = async (base64Image: string): Promise<AttentionMapData> => {
  const response = await fetch("/api/attention", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Image }),
  });
  if (!response.ok) throw new Error("Attention map fetch failed");
  return response.json();
};

export const simulateAttack = async (base64Image: string, attackType: string, epsilon: number): Promise<ClassificationResult> => {
  const response = await fetch("/api/attack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64Image, attackType, epsilon }),
  });
  if (!response.ok) throw new Error("Attack simulation failed");
  return response.json();
};
