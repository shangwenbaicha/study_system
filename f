// 尝试直接下载已知的日中词库
import https from "https";
import fs from "fs";
import path from "path";

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    }).on("error", reject);
  });
}

async function main() {
  // 尝试几个知名的日中资源
  const urls = [
    "https://api.github.com/search/repositories?q=jmdict+chinese&sort=stars",
    "https://api.github.com/search/repositories?q=日语+单词+库&sort=stars",
    "https://api.github.com/search/repositories?q=jlpt+单词+中文&sort=stars",
  ];
  
  for (const url of urls) {
    console.log(`\n📡 ${url.split("?")[0].split("/").pop()}:`);
    try {
      const data = await fetch(url);
      const json = JSON.parse(data);
      if (json.items) {
        for (const r of json.items.slice(0, 5)) {
          console.log(`  ⭐ ${r.stargazers_count} | ${r.full_name}`);
          console.log(`     ${r.description || "无描述"}`);
          console.log(`     ${r.html_url}`);
        }
      } else {
        console.log(`  ${json.message || "未知响应"}`);
      }
    } catch (e) {
      console.log(`  ❌ ${e.message}`);
    }
  }

  // 直接检查几个社区资源
  console.log("\n\n📦 检查已知日中资源...");
  const knownResources = [
    "https://raw.githubusercontent.com/treemonster/jlpt-vocab-zh/main/n5.csv" // 这个可能不存在
  ];
  for (const url of knownResources) {
    try {
      const data = await fetch(url);
      console.log(`  ✅ ${url} 可访问`);
      console.log(data.slice(0, 200));
    } catch {
      console.log(`  ❌ ${url} 不可用`);
    }
  }
}

main();
