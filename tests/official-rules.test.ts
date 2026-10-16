import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { discordRulesText, filterRuleSections, regulations, serverRulesText } from "@/data/official-rules";
import { rules } from "@/data/player-guides";

test("rules UI renders both tab panels, all official text, section headings and deep links", () => {
  // This suite uses react-server conditions; render the client component in a standard React process.
  const html = execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e",
    'import React from "react"; import { renderToStaticMarkup } from "react-dom/server"; import { RulesGuide } from "./components/rules-guide.tsx"; process.stdout.write(renderToStaticMarkup(React.createElement(RulesGuide)));',
  ], { cwd: process.cwd(), env: { ...process.env, NODE_OPTIONS: "" }, encoding: "utf8" });
  assert.equal((html.match(/role="tab"/g) ?? []).length, 2);
  assert.equal((html.match(/role="tabpanel"/g) ?? []).length, 2);
  for (const regulation of regulations) {
    const headings = html.match(new RegExp(`<h3 id="${regulation.id}-section-\\d+-title"`, "g")) ?? [];
    assert.equal(headings.length, regulation.id === "servidor" ? 11 : 8);
    for (const section of regulation.sections) {
      assert.ok(html.includes(`href="#${section.id}"`));
      for (const block of section.blocks) assert.ok(html.includes(`id="${block.id}"`));
    }
  }
  for (const text of [serverRulesText, discordRulesText]) {
    for (const line of text.split("\n").filter(Boolean)) {
      const escaped = line.replace(/^- /, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
      assert.ok(html.includes(escaped), `Missing official text: ${line}`);
    }
  }
  assert.ok(!html.includes("Cuide do chat"));
  assert.ok(!html.includes("R01"));
});

test("official regulations preserve every section, numbered rule and source paragraph in order", () => {
  const counts = [[6, 4, 9, 5, 6, 5, 5, 4, 5, 4, 7], [4, 5, 5, 3, 5, 5, 5, 0]];
  regulations.forEach((regulation, index) => {
    assert.equal(regulation.sections.length, index === 0 ? 11 : 8);
    regulation.sections.forEach((section, sectionIndex) => {
      assert.ok(section.title.startsWith(`§${sectionIndex + 1} — `));
      assert.deepEqual(section.blocks.flatMap((block) => block.ruleId ? [block.ruleId] : []),
        Array.from({ length: counts[index][sectionIndex] }, (_, ruleIndex) => `${sectionIndex + 1}.${ruleIndex + 1}`));
    });
    const reconstructed = [regulation.title, ...regulation.introduction,
      ...regulation.sections.flatMap((section) => [section.title, ...section.blocks.flatMap((block) => block.paragraphs)]), ...regulation.closing].join("\n\n");
    assert.equal(reconstructed, index === 0 ? serverRulesText : discordRulesText);
  });
});

test("Discord retains the complete punishment list and unnumbered moderation paragraphs", () => {
  const paragraphs = regulations[1].sections[7].blocks[0].paragraphs;
  assert.equal(paragraphs.length, 5);
  assert.equal(paragraphs[1], "- Advertência verbal ou formal.\n- Exclusão de mensagens.\n- Restrição temporária de comunicação (timeout).\n- Remoção de canais específicos.\n- Expulsão do Discord.\n- Banimento temporário ou permanente.");
  assert.equal(paragraphs[4], "Caso considere uma punição injusta, utilize os canais oficiais para solicitar revisão.");
});

test("search retains complete rule context and supports IDs, sections, accents and empty results", () => {
  const server = regulations[0].sections;
  assert.equal(filterRuleSections(server, "3.1")[0].blocks[0].ruleId, "3.1");
  assert.equal(filterRuleSections(server, "§11")[0].blocks.length, 7);
  const cheats = filterRuleSections(server, "duplicacao")[0].blocks[0];
  assert.equal(cheats.ruleId, "2.1");
  assert.equal(cheats.paragraphs.length, 8);
  assert.equal(filterRuleSections(regulations[1].sections, "timeout")[0].blocks[0].paragraphs.length, 5);
  assert.deepEqual(filterRuleSections(server, "no-such-rule"), []);
  assert.equal(filterRuleSections(server, "").length, 11);
});

test("placeholder rules are absent from the active content and site search index", () => {
  const content = JSON.stringify(rules);
  for (const obsolete of ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08", "Cuide do chat", "Negocie com transparência", "Proteja dados pessoais", "Não use trapaças"]) {
    assert.ok(!content.includes(obsolete), obsolete);
  }
  for (const id of ["servidor-1.1", "servidor-3.1", "servidor-11.7", "discord-1.1", "discord-7.5"]) {
    assert.ok(rules.some((rule) => rule.id === id), id);
  }
});
