import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

// ============================================================
// JLPT 词库配置（日英 + 日中）
// ============================================================
const JLPT_LEVELS = [
  // 日英词库（基于 open-anki-jlpt-decks）
  { file: "anki_n5.csv", id: "builtin-jp-en-n5", name: "JLPT N5 日英单词", level: "N5", lang: "en" },
  { file: "anki_n4.csv", id: "builtin-jp-en-n4", name: "JLPT N4 日英单词", level: "N4", lang: "en" },
  { file: "anki_n3.csv", id: "builtin-jp-en-n3", name: "JLPT N3 日英单词", level: "N3", lang: "en" },
  { file: "anki_n2.csv", id: "builtin-jp-en-n2", name: "JLPT N2 日英单词", level: "N2", lang: "en" },
  { file: "anki_n1.csv", id: "builtin-jp-en-n1", name: "JLPT N1 日英单词", level: "N1", lang: "en" },
  // 日中词库（基于 firavoyage/_anki-jlpt-decks，纯中文释义）
  { file: "jmdict_zh_n5.csv", id: "builtin-jp-zh-n5", name: "JLPT N5 日中单词", level: "N5", lang: "zh" },
  { file: "jmdict_zh_n4.csv", id: "builtin-jp-zh-n4", name: "JLPT N4 日中单词", level: "N4", lang: "zh" },
  { file: "jmdict_zh_n3.csv", id: "builtin-jp-zh-n3", name: "JLPT N3 日中单词", level: "N3", lang: "zh" },
  { file: "jmdict_zh_n2.csv", id: "builtin-jp-zh-n2", name: "JLPT N2 日中单词", level: "N2", lang: "zh" },
  { file: "jmdict_zh_n1.csv", id: "builtin-jp-zh-n1", name: "JLPT N1 日中单词", level: "N1", lang: "zh" },
];

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

async function importJLPTWordBooks(systemUserId: string) {
  const scriptsDir = path.resolve("scripts");
  let totalWords = 0;

  for (const level of JLPT_LEVELS) {
    const filePath = path.join(scriptsDir, level.file);
    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠️  跳过 ${level.file} (文件不存在，请先运行 scripts/download-anki.mjs)`);
      continue;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());
    const dataLines = lines.slice(1); // 跳过 header

    const words: { word: string; reading: string | null; meaning: string }[] = [];
    for (const line of dataLines) {
      const cols = parseCSVLine(line);
      if (cols.length >= 3) {
        words.push({
          word: cols[0],
          reading: cols[1] || null,
          meaning: cols[2].replace(/^"|"$/g, ""),
        });
      }
    }

    // 删除旧词库
    const existing = await prisma.wordBook.findUnique({ where: { id: level.id } });
    if (existing) {
      await prisma.word.deleteMany({ where: { wordBookId: level.id } });
      await prisma.wordBook.delete({ where: { id: level.id } });
    }

    // 创建词库
    await prisma.wordBook.create({
      data: {
        id: level.id,
        userId: systemUserId,
        name: level.name,
        language: "japanese",
        isBuiltIn: true,
        wordCount: words.length,
      },
    });

    // 批量创建单词
    const batchSize = 500;
    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize);
      await prisma.word.createMany({
        data: batch.map((w) => ({
          wordBookId: level.id,
          word: w.word,
          reading: w.reading,
          meaning: w.meaning,
        })),
      });
    }

    console.log(`  ✅ ${level.name}: ${words.length} 词`);
    totalWords += words.length;
  }

  return totalWords;
}

async function main() {
  console.log("🌱 开始填充种子数据...\n");

  // ============================================================
  // 1. 创建系统用户（用于内置词库）
  // ============================================================
  const systemUser = await prisma.user.upsert({
    where: { email: "system@study-system.local" },
    update: {},
    create: {
      id: "system-user",
      email: "system@study-system.local",
      passwordHash: "builtin-system-account",
      displayName: "System",
    },
  });
  console.log(`✅ 创建系统用户: ${systemUser.displayName}`);

  // ============================================================
  // 2. 导入 JLPT N5~N1 标准词库
  // ============================================================
  console.log("\n📚 导入 JLPT 标准词库 (Tanos 权威词库)...");
  const totalWords = await importJLPTWordBooks(systemUser.id);
  console.log(`\n🎉 种子数据填充完成！共 ${totalWords} 个单词`);
}

main()
  .catch((e) => {
    console.error("❌ 种子数据填充失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
