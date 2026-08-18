const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');
const XLSX = require('xlsx');

const parserPath = path.resolve(__dirname, '../src/utils/contact-import-parser.ts');
const source = fs.readFileSync(parserPath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: parserPath,
}).outputText;
const parserModule = new Module(parserPath, module);
parserModule.filename = parserPath;
parserModule.paths = Module._nodeModulePaths(path.dirname(parserPath));
parserModule._compile(compiled, parserPath);

const { parseContactRows } = parserModule.exports;

function test(name, run) {
  try {
    run();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

test('首条职务为空时不会把办公电话映射为职务', () => {
  const result = parseContactRows([
    ['一级目录', '二级目录', '姓名', '职务', '办公电话', '手机号'],
    ['总部', '办公室', '张三', '', '010-12345678', '13800138000'],
    ['总部', '办公室', '李四', '主任', '010-87654321', '13900139000'],
  ]);

  assert.equal(result.contacts[0].position, '');
  assert.equal(result.contacts[0].officePhone, '010-12345678');
  assert.equal(result.contacts[1].position, '主任');
});

test('真实 SheetJS 空单元格解析仍保持办公电话的物理列', () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ['一级目录', '二级目录', '姓名', '职务', '办公电话', '手机号'],
    ['总部', '办公室', '张三', undefined, '010-12345678', '13800138000'],
  ]);
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: true,
  });
  const result = parseContactRows(rows, sheet['!merges'] || []);

  assert.equal(result.contacts[0].position, '');
  assert.equal(result.contacts[0].officePhone, '010-12345678');
});

test('首条一级目录为空时后续列不会整体前移', () => {
  const result = parseContactRows([
    ['一级目录', '二级目录', '姓名', '职务', '办公电话', '手机号'],
    ['', '技术部', '王五', '工程师', '010-10000', '13600136000'],
  ]);

  assert.equal(result.contacts[0].level1Dir, '未分类');
  assert.equal(result.contacts[0].level2Dir, '技术部');
  assert.equal(result.contacts[0].name, '王五');
});

test('能识别标题行、重排列和常见表头别名', () => {
  const result = parseContactRows([
    ['某公司通讯录'],
    [],
    ['员工姓名', '手机号码', '一级部门', '岗位名称', '座机', '科室'],
    ['赵六', '13500135000', '总部', '', '010-20000', '人事科'],
  ]);

  assert.equal(result.headerRowIndex, 2);
  assert.deepEqual(result.contacts[0], {
    name: '赵六',
    level1Dir: '总部',
    level2Dir: '人事科',
    position: '',
    officePhone: '010-20000',
    mobilePhones: ['13500135000'],
  });
});

test('无表头时固定按 A-F 物理列解析并保留空列', () => {
  const result = parseContactRows([
    ['总部', '财务科', '孙七', '', '010-30000', '13300133000'],
  ]);

  assert.equal(result.headerRowIndex, null);
  assert.equal(result.contacts[0].position, '');
  assert.equal(result.contacts[0].officePhone, '010-30000');
});

test('合并的目录单元格会展开到区域内的每条联系人', () => {
  const result = parseContactRows([
    ['一级目录', '二级目录', '姓名', '职务', '办公电话', '手机号'],
    ['总部', '综合科', '周八', '', '', '13200132000'],
    ['', '', '吴九', '', '', '13100131000'],
  ], [
    { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
    { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
  ]);

  assert.equal(result.contacts[1].level1Dir, '总部');
  assert.equal(result.contacts[1].level2Dir, '综合科');
});

test('手机号中的普通空格不会被拆成多个号码', () => {
  const result = parseContactRows([
    ['一级目录', '二级目录', '姓名', '职务', '办公电话', '手机号'],
    ['总部', '综合科', '郑十', '', '', '138 0013 8000；13900139000'],
  ]);

  assert.deepEqual(result.contacts[0].mobilePhones, ['138 0013 8000', '13900139000']);
});

console.log('导入解析回归测试全部通过。');
