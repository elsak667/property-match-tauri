#!/usr/bin/env node
/**
 * CSS 类名一致性检查
 * 用法: node scripts/check-css-classes.cjs
 *
 * 只检查静态字符串形式的 className="..." / className='...'
 * 动态 className={`...`} 由开发者自行保证
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const COMPONENT_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
const CSS_FILES = [
  path.join(PROJECT_ROOT, 'src/index.css'),
  path.join(PROJECT_ROOT, 'src/components/FAB.css'),
  path.join(PROJECT_ROOT, 'src/components/Panel.css'),
];

// ─── 工具函数 ────────────────────────────────────────────

function walkDir(dir, extensions) {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

// 只提取静态字符串 className="..." 和 className='...'
// 不处理模板字符串 className={`...`}，因为那是动态的
function extractComponentClasses() {
  const classes = new Set();
  const files = walkDir(path.join(PROJECT_ROOT, 'src'), COMPONENT_EXTENSIONS);

  // 匹配 className="xxx" 或 className='xxx'（仅静态字符串）
  const regex = /className\s*=\s*"([^"]+)"/g;

  files.forEach(file => {
    const content = readFile(file);
    let match;
    while ((match = regex.exec(content)) !== null) {
      // 支持多类名用空格分隔
      match[1].split(/\s+/).forEach(c => {
        c = c.trim();
        if (c && !c.includes('${') && !c.includes('`')) {
          classes.add(c);
        }
      });
    }
  });

  return classes;
}

// 从 CSS 中提取所有定义的类名（.className { 或 .className{）
function extractCssClasses() {
  const classes = new Set();
  CSS_FILES.forEach(file => {
    const content = readFile(file);
    const regex = /\.([a-zA-Z_][\w-]*)\s*\{/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      classes.add(match[1]);
    }
  });
  return classes;
}

// ─── 已知的预存在缺失（项目历史遗留，逐步清理）──────────────
// 发现新的缺失类名后，先确认是本次改动引入的，再加入这里
const KNOWN_MISSING = new Set([
  'cp-body', 'cp-params-row', 'block-policy', 'block-property',
  'block-sub-side', 'block-placeholder', 'placeholder-wip',
  'tab-label', 'ai-panel-history', 'ai-panel-skip',
  'ai-panel-loading', 'ai-panel-stat', 'ai-panel-item-prop',
  'ai-panel-rating', 'ai-rating-done', 'ai-rating-reason',
  'ai-rating-btns', 'ai-rating-btn', 'bdp-loading',
]);

// ─── 主检查 ─────────────────────────────────────────────

function check() {
  const used = extractComponentClasses();
  const defined = extractCssClasses();

  const missing = [];
  const newlyMissing = [];

  used.forEach(cls => {
    if (!defined.has(cls)) {
      if (KNOWN_MISSING.has(cls)) {
        missing.push(cls);
      } else {
        newlyMissing.push(cls);
      }
    }
  });

  console.log('\n🔍 CSS 类名一致性检查\n');
  console.log(`组件静态 className: ${used.size} 个`);
  console.log(`CSS 中定义:         ${defined.size} 个`);

  if (missing.length > 0) {
    console.log(`\n⚠️  已知历史缺失 (${missing.length} 个，逐步清理中)`);
    missing.forEach(cls => console.log(`   - ${cls}`));
  }

  if (newlyMissing.length > 0) {
    console.log(`\n❌ 新增缺失: ${newlyMissing.length} 个类名在组件中使用但 CSS 中未定义`);
    newlyMissing.forEach(cls => console.log(`   - ${cls}`));
    console.log('\n检查失败: 存在新增未定义类名，请先在 CSS 中定义\n');
    process.exit(1);
  }

  console.log('\n✅ 检查通过: 无新增未定义类名\n');
  process.exit(0);
}

check();
