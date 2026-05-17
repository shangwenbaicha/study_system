/**
 * 浏览器 TTS Hook — 使用 Web Speech API 朗读文本
 * 支持日语、英语、中文等语言
 */

export function useSpeech() {
  /**
   * 朗读指定文本
   * @param text 要朗读的文本
   * @param lang 语言代码，如 "ja-JP"、"en-US"、"zh-CN"
   */
  const speak = (text: string, lang?: string) => {
    if (!text || typeof speechSynthesis === "undefined") return;

    // 如果正在朗读，先停止
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // 自动检测语言
    if (lang) {
      utterance.lang = lang;
    } else {
      // 根据文本中的字符自动判断
      if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(text)) {
        // 包含日文汉字或假名 → 日语
        utterance.lang = "ja-JP";
      } else if (/[a-zA-Z]/.test(text)) {
        utterance.lang = "en-US";
      } else {
        utterance.lang = "zh-CN";
      }
    }

    utterance.rate = 0.9; // 语速稍慢，适合学习
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    speechSynthesis.speak(utterance);
  };

  /**
   * 停止朗读
   */
  const stop = () => {
    speechSynthesis.cancel();
  };

  return { speak, stop };
}
