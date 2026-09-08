// ast-lineage.mjs — AUDITORIA DE LINHAGEM DE DADOS POR AST.
//
// MASTER ORDER §62 ("AST + DATA LINEAGE") e §79 ("AUDIT FIRST — não
// programar no escuro"). Existe porque a varredura por TEXTO equivalente
// (diff de "produzido" contra "consumido" via grep) devolveu falsos
// positivos reais nesta sessão: varria tipos aninhados e listava como
// órfãos campos que estavam demonstravelmente sendo consumidos. Uma
// auditoria que erra assim é pior que nenhuma — ela gera trabalho falso.
//
// O QUE FAZ: percorre a AST (TypeScript compiler API, zero regex sobre
// código) e classifica cada propriedade que uma função EXPORTADA de
// nexus/ ou engine-bridge.ts devolve num objeto literal:
//
//   A = produzido e consumido em src/            (linhagem completa)
//   B = consumido só por tests/                  (não chega ao Operador)
//   C = produzido e perdido                      (ninguém lê, em lugar nenhum)
//
// As classes D/E/F/G do §62 (perda semântica, fonte duplicada, correto,
// falso positivo) NÃO são decidíveis por AST sozinha — exigem leitura
// humana do significado. Esta ferramenta deliberadamente NÃO as inventa:
// ela entrega A/B/C medidos e deixa o resto para a auditoria de leitura.
//
// LIMITE HONESTO CONHECIDO: "consumido" aqui é "existe algum acesso de
// propriedade ou desestruturação com este NOME". É uma aproximação por
// nome, não por tipo — dois campos homônimos em objetos diferentes se
// confundem. Isso torna a ferramenta CONSERVADORA: ela subestima a lista
// C (um homônimo consumido esconde um órfão), nunca a superestima. Todo
// item que ela reporta em C merece confirmação por leitura antes de virar
// tarefa — foi assim que os achados desta rodada foram validados.
import ts from 'typescript';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const SRC = process.argv[2] ?? 'src';
const TESTS = process.argv[3] ?? 'tests';

const collect = (dir, out = []) => {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== 'node_modules') collect(p, out); }
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
};
const parse = (f) =>
  ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true,
    f.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

const srcFiles = collect(SRC);
const testFiles = collect(TESTS);

const isExported = (n) =>
  n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ||
  (ts.isVariableDeclaration(n) && n.parent?.parent?.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));

const produced = new Map();
for (const f of srcFiles.filter((x) => x.includes(`${join('', 'nexus')}`) || x.endsWith('engine-bridge.ts'))) {
  const sf = parse(f);
  const grab = (node) => {
    if (ts.isReturnStatement(node) && node.expression) {
      let e = node.expression;
      while (ts.isAsExpression(e) || ts.isParenthesizedExpression(e)) e = e.expression;
      if (ts.isObjectLiteralExpression(e)) {
        for (const p of e.properties) {
          if ((ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) && p.name && ts.isIdentifier(p.name)) {
            const line = sf.getLineAndCharacterOfPosition(p.getStart()).line + 1;
            if (!produced.has(p.name.text)) produced.set(p.name.text, `${relative(SRC, f)}:${line}`);
          }
        }
      }
    }
    ts.forEachChild(node, grab);
  };
  (function visit(n) {
    if ((ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n)) && isExported(n)) grab(n);
    ts.forEachChild(n, visit);
  })(sf);
}

const namesUsedIn = (files) => {
  const set = new Set();
  for (const f of files) {
    (function visit(n) {
      if (ts.isPropertyAccessExpression(n) && ts.isIdentifier(n.name)) set.add(n.name.text);
      if (ts.isElementAccessExpression(n) && n.argumentExpression && ts.isStringLiteral(n.argumentExpression)) set.add(n.argumentExpression.text);
      if (ts.isBindingElement(n)) {
        const key = n.propertyName ?? n.name;
        if (ts.isIdentifier(key)) set.add(key.text);
      }
      ts.forEachChild(n, visit);
    })(parse(f));
  }
  return set;
};
const emSrc = namesUsedIn(srcFiles);
const emTeste = namesUsedIn(testFiles);

const A = [], B = [], C = [];
for (const [nome, loc] of produced) {
  if (emSrc.has(nome)) A.push([nome, loc]);
  else if (emTeste.has(nome)) B.push([nome, loc]);
  else C.push([nome, loc]);
}
const linha = ([n, l]) => `  ${n}  (${l})`;
console.log(`analisados: ${srcFiles.length} arquivos em ${SRC}/, ${testFiles.length} em ${TESTS}/`);
console.log(`propriedades produzidas por função exportada: ${produced.size}\n`);
console.log(`A — produzido e consumido em src/: ${A.length}`);
console.log(`B — consumido SÓ por tests/ (não chega ao Operador): ${B.length}`);
B.sort().forEach((x) => console.log(linha(x)));
console.log(`\nC — produzido e PERDIDO (ninguém lê): ${C.length}`);
C.sort().forEach((x) => console.log(linha(x)));
