import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { McpServer } from "@modelcontextprotocol/server";
import { loadSkills } from "@modelcontextprotocol/server/ext/skills/node";

// The billing guides (skills/<name>/SKILL.md) served two ways:
// - as MCP skills (the io.modelcontextprotocol/skills extension): a client that supports skills lists them and loads
//   one when it is needed;
// - as prompts named skill-<name>, for clients that do not support skills yet: every client knows prompts.

/** The skills folder: next to src/ and dist/, so it resolves the same from the source and from the build. */
export const SKILLS_DIR = fileURLToPath(new URL("../skills/", import.meta.url));

/** The SKILL.md text after its frontmatter. */
function body(markdown: string): string {
  const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(markdown);
  return (m ? markdown.slice(m[0].length) : markdown).trim();
}

/** Loads the skills (strict: a malformed skill is an error, not a silently missing guide) and serves them. Call before connect. */
export async function registerSkills(server: McpServer, dir: string = SKILLS_DIR): Promise<string[]> {
  const catalog = await loadSkills(dir, { strict: true });
  catalog.attach(server);
  const names: string[] = [];
  for (const skill of catalog.entries) {
    const { name, description } = skill.frontmatter;
    // skill://<folder>/SKILL.md (no catalog prefix): the same file the skills extension serves
    const text = body(await readFile(join(dir, skill.uri.replace(/^skill:\/\//, "")), "utf8"));
    server.registerPrompt(`skill-${name}`, { description }, () => ({
      messages: [{ role: "user" as const, content: { type: "text" as const, text } }],
    }));
    names.push(name);
  }
  return names;
}
