export const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com";
export const DEEPSEEK_DEFAULT_MODEL = "deepseek-v4-pro";

export function getDeepSeekChatOptions() {
  return {
    model: process.env.DEEPSEEK_MODEL_GENERATE?.trim() || DEEPSEEK_DEFAULT_MODEL,
    apiKey: process.env.DEEPSEEK_API_KEY,
    apiKeyEnvName: "DEEPSEEK_API_KEY",
    baseURL: process.env.DEEPSEEK_BASE_URL?.trim() || DEEPSEEK_DEFAULT_BASE_URL,
  };
}

export function getDeepSeekVisionOptions() {
  return {
    model: process.env.DEEPSEEK_MODEL_VISION?.trim() || DEEPSEEK_DEFAULT_MODEL,
    apiKey: process.env.DEEPSEEK_API_KEY,
    apiKeyEnvName: "DEEPSEEK_API_KEY",
    baseURL: process.env.DEEPSEEK_BASE_URL?.trim() || DEEPSEEK_DEFAULT_BASE_URL,
  };
}
