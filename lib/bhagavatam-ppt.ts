import PptxGenJS from "pptxgenjs";

export type BhagavatamFormData = {
  deckTitle: string;
  verseReference: string;
  verse: string;
  synonyms: string;
  translation: string;
  purport: string;
};

const PPT_W = 13.333;
const PPT_H = 7.5;

const COLORS = {
  background: "06090F",
  backgroundSoft: "0B1320",
  panel: "101A2A",
  line: "F2C86A",
  lineSoft: "36506E",
  text: "F7F2E7",
  muted: "D2C5AA",
  verse: "FFF4C8",
  accent: "9DCBFF",
  ending: "FFFFFF"
};

const FONT = {
  display: "Georgia",
  body: "Aptos"
};

export async function generateBhagavatamPptx(input: BhagavatamFormData) {
  const pptx = new PptxGenJS();

  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "Bhagavatam PPT Generator";
  pptx.company = "Bhagavatam PPT Generator";
  pptx.subject = input.deckTitle || "Bhagavatam Class";
  pptx.title = input.deckTitle || "Bhagavatam PPT";

  const cleanTitle = cleanText(input.deckTitle || "Bhagavatam PPT");
  const deckTitle = cleanTitle || "Bhagavatam PPT";
  const verse = extractVerse(input.verseReference, input.verse);

  addCoverSlide(pptx, deckTitle, verse.title);
  addVerseSlides(pptx, verse.title, verse.body);
  addSectionSlides(pptx, "SYNONYMS", input.synonyms, 26, 5, 6, "left");
  addSectionSlides(pptx, "TRANSLATION", input.translation, 25, 5, 6, "left");
  addPurportSlides(pptx, input.purport);

  return pptx.write({ outputType: "nodebuffer", compression: true });
}

function addCoverSlide(pptx: PptxGenJS, deckTitle: string, verseTitle: string) {
  const slide = pptx.addSlide();
  addBackground(slide, pptx, true);

  slide.addText("BHAKTI VEDANTA", {
    x: 0.65,
    y: 0.45,
    w: 3.4,
    h: 0.25,
    fontFace: FONT.body,
    fontSize: 12,
    color: COLORS.line,
    bold: true,
    margin: 0
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 0.65,
    y: 0.77,
    w: 2.2,
    h: 0,
    line: { color: COLORS.line, pt: 1.2 }
  });

  slide.addText(deckTitle, {
    x: 0.65,
    y: 1.1,
    w: 7.8,
    h: 1.2,
    fontFace: FONT.display,
    fontSize: 28,
    color: COLORS.text,
    bold: true,
    margin: 0,
    breakLine: false,
    fit: "shrink"
  });

  slide.addText("Verse, synonyms, translation, and purport - automatically formatted into slides.", {
    x: 0.65,
    y: 2.25,
    w: 6.8,
    h: 0.7,
    fontFace: FONT.body,
    fontSize: 15,
    color: COLORS.muted,
    margin: 0,
    fit: "shrink"
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.65,
    y: 3.15,
    w: 5.2,
    h: 0.02,
    line: { color: COLORS.line, transparency: 100 },
    fill: { color: COLORS.line, transparency: 18 }
  });

  slide.addText(verseTitle ? `Reference: ${verseTitle}` : "Reference: auto-detected from verse text", {
    x: 0.65,
    y: 3.35,
    w: 6.8,
    h: 0.45,
    fontFace: FONT.body,
    fontSize: 14,
    color: COLORS.accent,
    margin: 0,
    italic: true,
    fit: "shrink"
  });

  slide.addText("Generated deck output for PowerPoint or Google Slides import", {
    x: 0.65,
    y: 6.65,
    w: 4.8,
    h: 0.22,
    fontFace: FONT.body,
    fontSize: 10,
    color: COLORS.muted,
    margin: 0
  });
}

function addVerseSlides(pptx: PptxGenJS, verseTitle: string, verseBody: string) {
  const lines = wrapVerseLines(verseBody);
  const hasBody = lines.length > 0;
  const longVerse = lines.some((line) => line.length > 28);
  const linesPerSlide = longVerse ? 2 : 4;
  const chunks = chunkArray(lines, linesPerSlide);

  if (!hasBody && verseTitle) {
    const slide = pptx.addSlide();
    addBackground(slide, pptx, false);
    addSectionHeader(slide, pptx, "VERSE", verseTitle, 0, 0.4, 2.6);
    return;
  }

  chunks.forEach((chunk, index) => {
    const slide = pptx.addSlide();
    addBackground(slide, pptx, false);

    if (index === 0) {
      addSectionHeader(slide, pptx, "VERSE", verseTitle || "VERSE", 0, 0.4, 2.75);
      addBodyText(slide, chunk.join("\n"), {
        x: 0.95,
        y: 1.85,
        w: 11.45,
        h: 4.8,
        fontSize: 28,
        color: COLORS.verse,
        align: "center",
        italic: true,
        fit: "shrink"
      });
    } else {
      slide.addText("VERSE (continued)", {
        x: 0.95,
        y: 0.5,
        w: 3.5,
        h: 0.35,
        fontFace: FONT.body,
        fontSize: 14,
        color: COLORS.accent,
        bold: true,
        margin: 0
      });

      addBodyText(slide, chunk.join("\n"), {
        x: 0.95,
        y: 0.95,
        w: 11.45,
        h: 6.0,
        fontSize: 28,
        color: COLORS.verse,
        align: "center",
        italic: true,
        fit: "shrink"
      });
    }
  });
}

function addSectionSlides(
  pptx: PptxGenJS,
  heading: string,
  text: string,
  bodyFontSize: number,
  firstLimit: number,
  nextLimit: number,
  align: "left" | "center"
) {
  const chunks = buildNarrativeChunks(text, 32, firstLimit, nextLimit);
  if (!chunks.length) return;

  chunks.forEach((chunk, index) => {
    const slide = pptx.addSlide();
    addBackground(slide, pptx, false);

    if (index === 0) {
      addSectionHeader(slide, pptx, heading, "", 0, 0.45, 2.95);
      addBodyText(slide, chunk, {
        x: 0.9,
        y: 1.7,
        w: 11.5,
        h: 5.3,
        fontSize: bodyFontSize,
        color: COLORS.text,
        align,
        fit: "shrink"
      });
    } else {
      slide.addText(`${heading} (continued)`, {
        x: 0.95,
        y: 0.5,
        w: 3.8,
        h: 0.3,
        fontFace: FONT.body,
        fontSize: 14,
        color: COLORS.accent,
        bold: true,
        margin: 0
      });

      addBodyText(slide, chunk, {
        x: 0.9,
        y: 0.95,
        w: 11.5,
        h: 6.0,
        fontSize: bodyFontSize,
        color: COLORS.text,
        align,
        fit: "shrink"
      });
    }
  });
}

function addPurportSlides(pptx: PptxGenJS, text: string) {
  const chunks = buildNarrativeChunks(text, 34, 6, 7);
  if (!chunks.length) return;

  chunks.forEach((chunk, index) => {
    const slide = pptx.addSlide();
    addBackground(slide, pptx, false);

    if (index === 0) {
      addSectionHeader(slide, pptx, "PURPORT", "", 0, 0.45, 2.95);
      addBodyText(slide, chunk, {
        x: 0.9,
        y: 1.7,
        w: 11.5,
        h: 4.8,
        fontSize: 23,
        color: COLORS.text,
        align: "left",
        fit: "shrink"
      });
    } else {
      slide.addText("PURPORT (continued)", {
        x: 0.95,
        y: 0.5,
        w: 4.2,
        h: 0.3,
        fontFace: FONT.body,
        fontSize: 14,
        color: COLORS.accent,
        bold: true,
        margin: 0
      });

      addBodyText(slide, chunk, {
        x: 0.9,
        y: 0.95,
        w: 11.5,
        h: 5.95,
        fontSize: 23,
        color: COLORS.text,
        align: "left",
        fit: "shrink"
      });
    }

    if (index === chunks.length - 1) {
      slide.addShape(pptx.ShapeType.line, {
        x: 4.0,
        y: 6.72,
        w: 5.35,
        h: 0,
        line: { color: COLORS.lineSoft, pt: 1 }
      });

      slide.addText("THUS ENDS THE BHAKTIVEDANTA PURPORT", {
        x: 3.2,
        y: 6.77,
        w: 6.95,
        h: 0.25,
        fontFace: FONT.body,
        fontSize: 11.5,
        color: COLORS.ending,
        italic: true,
        bold: true,
        align: "center",
        margin: 0,
        fit: "shrink"
      });
    }
  });
}

function addSectionHeader(
  slide: PptxGenJS.Slide,
  pptx: PptxGenJS,
  heading: string,
  title: string,
  x: number,
  y: number,
  underlineWidth: number
) {
  slide.addText(heading, {
    x,
    y,
    w: 2.6,
    h: 0.3,
    fontFace: FONT.body,
    fontSize: 14,
    color: COLORS.line,
    bold: true,
    margin: 0
  });

  slide.addShape(pptx.ShapeType.line, {
    x,
    y: y + 0.34,
    w: underlineWidth,
    h: 0,
    line: { color: COLORS.line, pt: 1.1 }
  });

  if (title) {
    slide.addText(title, {
      x: 0.9,
      y: 0.9,
      w: 11.5,
      h: 0.6,
      fontFace: FONT.display,
      fontSize: 28,
      color: COLORS.text,
      bold: true,
      margin: 0,
      fit: "shrink",
      align: "center"
    });
  }
}

function addBackground(slide: PptxGenJS.Slide, pptx: PptxGenJS, cover: boolean) {
  slide.background = { color: COLORS.background };

  slide.addShape(pptx.ShapeType.rect, {
    x: 0,
    y: 0,
    w: PPT_W,
    h: PPT_H,
    line: { color: COLORS.background, transparency: 100 },
    fill: { color: COLORS.background }
  });

  slide.addShape(pptx.ShapeType.ellipse, {
    x: 9.6,
    y: -0.6,
    w: 3.1,
    h: 3.1,
    line: { color: COLORS.lineSoft, pt: 1, transparency: cover ? 35 : 55 },
    fill: { color: COLORS.backgroundSoft, transparency: 100 }
  });

  slide.addShape(pptx.ShapeType.ellipse, {
    x: -0.85,
    y: 5.55,
    w: 2.8,
    h: 2.8,
    line: { color: COLORS.lineSoft, pt: 1, transparency: cover ? 40 : 60 },
    fill: { color: COLORS.backgroundSoft, transparency: 100 }
  });

  slide.addShape(pptx.ShapeType.line, {
    x: 0.6,
    y: 7.12,
    w: 12.15,
    h: 0,
    line: { color: COLORS.line, pt: 1, transparency: 70 }
  });

  slide.addShape(pptx.ShapeType.rect, {
    x: 0.6,
    y: 0.38,
    w: 12.13,
    h: 6.74,
    line: { color: COLORS.lineSoft, pt: 1, transparency: 78 },
    fill: { color: COLORS.panel, transparency: 88 }
  });
}

function addBodyText(
  slide: PptxGenJS.Slide,
  text: string,
  opts: {
    x: number;
    y: number;
    w: number;
    h: number;
    fontSize: number;
    color: string;
    align: "left" | "center";
    italic?: boolean;
    fit?: "none" | "shrink" | "resize";
  }
) {
  slide.addText(text, {
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    fontFace: FONT.body,
    fontSize: opts.fontSize,
    color: opts.color,
    margin: 0.06,
    breakLine: false,
    fit: opts.fit ?? "shrink",
    valign: "middle",
    align: opts.align,
    italic: opts.italic ?? false,
    paraSpaceAfter: 10,
    lineSpacingMultiple: 1.05
  });
}

function buildNarrativeChunks(text: string, charsPerLine: number, firstLimit: number, nextLimit: number) {
  const blocks = splitParagraphBlocks(cleanText(text));
  const units: string[] = [];

  blocks.forEach((block) => {
    if (!block) return;

    if (looksLikeVerseBlock(block)) {
      units.push(block.trim());
      return;
    }

    splitParagraphIntoSentences(block).forEach((part) => {
      if (part.trim()) units.push(part.trim());
    });
  });

  const slides: string[] = [];
  let current = "";
  let currentLimit = firstLimit;

  units.forEach((unit) => {
    const fragments = splitOversizedUnit(unit, currentLimit, charsPerLine);

    fragments.forEach((fragment) => {
      const lines = estimateVisualLines(fragment, charsPerLine);

      if (current && estimateVisualLines(current, charsPerLine) + lines > currentLimit) {
        slides.push(current.trim());
        current = fragment;
        currentLimit = nextLimit;
      } else {
        current = current ? `${current}\n\n${fragment}` : fragment;
      }
    });
  });

  if (current.trim()) {
    slides.push(current.trim());
  }

  return slides;
}

function splitOversizedUnit(text: string, maxLines: number, charsPerLine: number) {
  const lines = wrapLines(text, charsPerLine);
  if (lines.length <= maxLines) {
    return [text];
  }

  const chunks: string[] = [];
  let current: string[] = [];

  lines.forEach((line) => {
    if (current.length >= maxLines) {
      chunks.push(current.join("\n").trim());
      current = [];
    }

    current.push(line);
  });

  if (current.length) {
    chunks.push(current.join("\n").trim());
  }

  return chunks;
}

function splitParagraphIntoSentences(paragraph: string) {
  return paragraph.match(/[^.!?]+[.!?"]*|[^.!?]+$/g) ?? [paragraph];
}

function splitParagraphBlocks(text: string) {
  const normalized = normalizeLineEndings(text);
  return normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function wrapVerseLines(text: string) {
  return wrapLines(text, 32).filter((line) => line.trim() !== "");
}

function wrapLines(text: string, maxChars: number) {
  const normalized = normalizeLineEndings(text);
  const rawLines = normalized.split("\n");
  const result: string[] = [];

  rawLines.forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    const words = line.split(/\s+/);
    let current = "";

    words.forEach((word) => {
      if (!current) {
        if (word.length > maxChars) {
          splitLongWord(word, maxChars).forEach((piece) => result.push(piece));
        } else {
          current = word;
        }
        return;
      }

      const candidate = `${current} ${word}`;
      if (candidate.length <= maxChars) {
        current = candidate;
        return;
      }

      result.push(current);
      if (word.length > maxChars) {
        splitLongWord(word, maxChars).forEach((piece) => result.push(piece));
        current = "";
      } else {
        current = word;
      }
    });

    if (current) {
      result.push(current);
    }
  });

  return result;
}

function splitLongWord(word: string, maxChars: number) {
  const pieces: string[] = [];
  for (let i = 0; i < word.length; i += maxChars) {
    pieces.push(word.slice(i, i + maxChars));
  }
  return pieces;
}

function estimateVisualLines(text: string, maxChars: number) {
  return wrapLines(text, maxChars).length || 1;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function looksLikeVerseBlock(block: string) {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) return false;

  const shortLines = lines.filter((line) => line.length <= 45).length;
  return shortLines >= 2;
}

function normalizeLineEndings(text: string) {
  return cleanText(text)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00A0/g, " ");
}

function cleanText(text: string) {
  return String(text ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function extractVerse(reference: string, verseText: string) {
  const lines = normalizeLineEndings(verseText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const explicitReference = cleanText(reference);

  if (explicitReference) {
    return {
      title: explicitReference,
      body: lines.join("\n")
    };
  }

  if (lines.length >= 2) {
    return {
      title: lines[0],
      body: lines.slice(1).join("\n")
    };
  }

  return {
    title: lines[0] || "VERSE",
    body: lines.length > 1 ? lines.slice(1).join("\n") : lines.join("\n")
  };
}
