import type { Root, RootContent, Paragraph, PhrasingContent } from "mdast";

function initialText(node: PhrasingContent | undefined): string | undefined {
  if (node?.type === "text") return node.value;
  if ((node?.type === "strong" || node?.type === "emphasis") && node.children.length === 1 && node.children[0].type === "text") return node.children[0].value;
}
const marker = /^\[AI-GENERATED EXAMPLE\](?:\s|$)/;
// Exact structure/text identity only. No keyword matching, summaries or similarity threshold.
function exampleKey(node: RootContent): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") {
      const node = value as Record<string, unknown>;
      return Object.fromEntries(Object.entries(node).filter(([key]) => key !== "position").map(([key, item]) => [key, key === "value" && node.type !== "text" ? item : canonical(item)]));
    }
    return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : value;
  };
  return JSON.stringify(canonical(node));
}

export interface LearningMarkdownOptions { citations?: { names: string[]; number: number }[]; sourcesId?: string }
// Presentation transformations leave the answer and provenance in the HTTP response unchanged.
export function remarkLearningPresentation(options: LearningMarkdownOptions = {}) {
  return (root: Root, file: { value: unknown }) => {
    // The live service sometimes emits a standalone $$equation$$ on one line.
    // remark-math parses that as inline math; retain its value but request display rendering.
    for (const node of root.children) {
      if (node.type !== "paragraph" || node.children.length !== 1 || node.children[0].type !== "inlineMath") continue;
      const raw = String(file.value).slice(node.position?.start.offset, node.position?.end.offset).trim();
      if (raw.startsWith("$$") && raw.endsWith("$$")) {
        const math = node.children[0];
        math.data = { ...math.data, hProperties: { ...math.data?.hProperties, className: ["language-math", "math-display"] } };
      }
    }
    const seenBlocks = new Set<string>();
    const exampleBlocks = new Set<string>();
    const output: RootContent[] = [];
    let inExample = false;
    let exampleHeading: RootContent | undefined;
    const append = (node: RootContent) => {
      const key = exampleKey(node);
      const duplicate = inExample ? seenBlocks.has(key) : exampleBlocks.has(key);
      if (inExample) exampleBlocks.add(key);
      seenBlocks.add(key);
      if (duplicate) return;
      if (exampleHeading) { output.push(exampleHeading); exampleHeading = undefined; }
      output.push(node);
    };
    for (const original of root.children) {
      // Code/math contents are never scanned for example labels. Only an explicit prose marker starts a section.
      if ((original.type === "paragraph" || original.type === "heading") && marker.test(initialText(original.children[0]) ?? "")) {
        const first = initialText(original.children[0])!.replace(marker, "").trimStart();
        inExample = true;
        exampleHeading = { type: "heading", depth: 3, children: [{ type: "text", value: "Example" }] };
        if (!first && original.children.length === 1) continue;
        const node: Paragraph = { type: "paragraph", children: [{ type: "text", value: first }, ...original.children.slice(1)] };
        append(node);
        continue;
      }
      if (original.type === "heading") {
        inExample = false;
        // A marker with no content before another heading is not an empty learning section.
        exampleHeading = undefined;
      }
      append(original);
    }
    // A trailing metadata marker is not an empty learning section.
    root.children = output;

    // Replace only standalone parenthetical filenames present in actual source metadata.
    // Keep the first numeric citation per source; prose mentions and unknown citations remain untouched.
    const cited = new Set<number>();
    const prose = (node: PhrasingContent): string | null => {
      if (node.type === "text") return node.value;
      if (node.type === "emphasis" || node.type === "strong" || node.type === "delete") {
        const parts = node.children.map(prose);
        return parts.some((p) => p === null) ? null : parts.join("");
      }
      return null;
    };
    const slice = (children: PhrasingContent[], start: number, end: number): PhrasingContent[] => {
      const result: PhrasingContent[] = [];
      let offset = 0;
      for (const child of children) {
        const length = prose(child)!.length;
        const from = Math.max(0, start - offset), to = Math.min(length, end - offset);
        if (to > from) {
          if (child.type === "text") result.push({ ...child, value: child.value.slice(from, to) });
          else if (child.type === "emphasis" || child.type === "strong" || child.type === "delete") result.push({ ...child, children: slice(child.children, from, to) });
        }
        offset += length;
      }
      return result;
    };
    function citeGroup(group: PhrasingContent[]): PhrasingContent[] {
      if (!options.sourcesId) return group;
      const text = group.map(prose).join("");
      const result: PhrasingContent[] = [];
      let cursor = 0;
      for (const match of text.matchAll(/\(([^()\n]+)\)/g)) {
        const exact = options.citations?.find((s) => s.names.includes(match[1]));
        const sources = exact ? [exact] : match[1].split(/;\s*/).map((name) => options.citations?.find((s) => s.names.includes(name.trim())));
        if (!sources.length || sources.some((source) => !source)) continue;
        const fresh = sources.filter((source) => !cited.has(source!.number));
        const before = slice(group, cursor, match.index!);
        // Removing a repeated parenthetical must not leave a space before punctuation.
        const last = before.at(-1);
        if (!fresh.length && last?.type === "text" && /^[\s.,;:!?]/.test(text.slice(match.index! + match[0].length))) last.value = last.value.trimEnd();
        result.push(...before);
        for (const source of fresh) {
          if (cited.has(source!.number)) continue;
          result.push({ type: "link", url: `#${options.sourcesId}`, children: [{ type: "text", value: `[${source!.number}]` }] });
          cited.add(source!.number);
        }
        cursor = match.index! + match[0].length;
      }
      if (!cursor) return group;
      result.push(...slice(group, cursor, text.length));
      return result;
    }
    function cite(children: PhrasingContent[]): PhrasingContent[] {
      const result: PhrasingContent[] = [];
      let group: PhrasingContent[] = [];
      for (const child of children) {
        if (prose(child) !== null) group.push(child);
        else { result.push(...citeGroup(group), child); group = []; }
      }
      result.push(...citeGroup(group));
      return result;
    }
    function walk(node: RootContent) {
      if (node.type === "paragraph" || node.type === "heading" || node.type === "tableCell") node.children = cite(node.children);
      else if ("children" in node) for (const child of node.children) walk(child as RootContent);
    }
    for (const node of root.children) walk(node);
  };
}
