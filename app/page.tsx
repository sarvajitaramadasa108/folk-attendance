"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";

type FormState = {
  deckTitle: string;
  verseReference: string;
  verse: string;
  synonyms: string;
  translation: string;
  purport: string;
};

const SAMPLE: FormState = {
  deckTitle: "SB Class PPT",
  verseReference: "Bhagavatam Verse",
  verse: [
    "na māṃ duṣkṛtino mūḍhāḥ",
    "prapadyante narādhamāḥ",
    "māyayāpahṛta-jñānā",
    "āsuraṃ bhāvam āśritāḥ"
  ].join("\n"),
  synonyms: [
    "na — not",
    "mām — Me",
    "duṣkṛtinaḥ — miscreants",
    "mūḍhāḥ — foolish persons"
  ].join("\n"),
  translation:
    "Those miscreants who are grossly foolish, whose knowledge is stolen by illusion, and who partake of the atheistic nature of demons do not surrender unto Me.",
  purport:
    "The Lord explains why some people do not accept devotional service. Their resistance is not merely intellectual; it is rooted in a distorted consciousness. When the heart is covered by illusion, even plain truth can be rejected. This presentation format keeps each section clean and easy to follow, while automatically splitting long passages across slides."
};

export default function HomePage() {
  const [form, setForm] = useState<FormState>(SAMPLE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState(
    "Paste the verse, synonyms, translation, and purport. The app will build a downloadable PPTX for you."
  );

  const estimatedSlides = useMemo(() => {
    const verseLines = form.verse.trim() ? form.verse.trim().split(/\n+/).filter(Boolean).length : 0;
    const longSections = [form.synonyms, form.translation, form.purport].filter((value) => value.trim().length > 0).length;
    return 1 + (verseLines > 0 ? Math.max(1, Math.ceil(verseLines / 4)) : 0) + longSections;
  }, [form]);

  function setField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleGenerate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsGenerating(true);
    setMessage("Building your PPTX...");

    try {
      const response = await fetch("/api/generate-pptx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || "Failed to generate PPTX.");
      }

      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/i);
      const filename = match?.[1] ?? `${slugify(form.deckTitle || "bhagavatam-class")}.pptx`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      setMessage(`Downloaded ${filename}. Open it in PowerPoint or upload it to Google Slides.`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Something went wrong while generating the deck.";
      setMessage(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <main className="shell">
      <div className="container">
        <header className="pageHeader">
          <div className="brandMark">
            <span className="brandDot" />
            Bhagavatam PPT Generator
          </div>
          <div className="subtle">Next.js app, Vercel-ready, PPTX download output</div>
        </header>

        <section className="hero">
          <div className="card cardPad heroCopy">
            <div className="eyebrow">Automated presentation builder</div>
            <h1 className="title">Turn verse notes into a polished slide deck.</h1>
            <p className="lead">
              Enter the verse, synonyms, translation, and purport in separate fields.
              The generator formats the content automatically, splits long sections,
              and returns a downloadable <code>.pptx</code> file.
            </p>
            <div className="heroActions">
              <button className="button" type="button" onClick={() => setForm(SAMPLE)}>
                Load sample text
              </button>
              <button className="buttonSecondary" type="button" onClick={() => document.getElementById("generator-form")?.scrollIntoView({ behavior: "smooth" })}>
                Jump to form
              </button>
            </div>
          </div>

          <div className="card cardPad">
            <div className="metaGrid">
              <div className="metaCard">
                <div className="metaLabel">Primary inputs</div>
                <div className="metaValue">Verse, Synonyms, Translation, Purport</div>
              </div>
              <div className="metaCard">
                <div className="metaLabel">Estimated slides</div>
                <div className="metaValue">{estimatedSlides}</div>
              </div>
              <div className="metaCard">
                <div className="metaLabel">Output</div>
                <div className="metaValue">PPTX download</div>
              </div>
            </div>
          </div>
        </section>

        <section className="panelGrid">
          <div className="panel">
            <div className="panelInner">
              <div className="sectionHeader">
                <div>
                  <h2 className="sectionTitle">Build your deck</h2>
                  <p className="sectionNote">
                    Paste or type each section separately. Long content is wrapped and split across slides automatically.
                  </p>
                </div>
              </div>

              <form id="generator-form" className="formGrid" onSubmit={handleGenerate}>
                <div className="fieldGrid">
                  <div className="field">
                    <label htmlFor="deckTitle">Deck title</label>
                    <input
                      id="deckTitle"
                      value={form.deckTitle}
                      onChange={(event) => setField("deckTitle", event.target.value)}
                      placeholder="SB Class PPT"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="verseReference">Verse reference or heading</label>
                    <input
                      id="verseReference"
                      value={form.verseReference}
                      onChange={(event) => setField("verseReference", event.target.value)}
                      placeholder="Bhagavatam Verse"
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="verse">Verse</label>
                  <textarea
                    id="verse"
                    value={form.verse}
                    onChange={(event) => setField("verse", event.target.value)}
                    placeholder="Paste the verse lines here..."
                    rows={6}
                  />
                  <div className="fieldHint">
                    If you leave the reference blank, the first line of the verse will be treated as the title.
                  </div>
                </div>

                <div className="twoCol">
                  <div className="field">
                    <label htmlFor="synonyms">Synonyms</label>
                    <textarea
                      id="synonyms"
                      value={form.synonyms}
                      onChange={(event) => setField("synonyms", event.target.value)}
                      placeholder="word — meaning"
                      rows={10}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="translation">Translation</label>
                    <textarea
                      id="translation"
                      value={form.translation}
                      onChange={(event) => setField("translation", event.target.value)}
                      placeholder="Paste the translation here..."
                      rows={10}
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="purport">Purport</label>
                  <textarea
                    id="purport"
                    value={form.purport}
                    onChange={(event) => setField("purport", event.target.value)}
                    placeholder="Paste the purport here..."
                    rows={12}
                  />
                </div>

                <div className="heroActions">
                  <button className="button" type="submit" disabled={isGenerating}>
                    {isGenerating ? "Generating PPTX..." : "Generate PPTX"}
                  </button>
                  <button className="buttonGhost" type="button" onClick={() => setForm(SAMPLE)} disabled={isGenerating}>
                    Reset to sample
                  </button>
                </div>

                <div className="notice">
                  <span className="noticeStrong">Status:</span> {message}
                </div>
              </form>
            </div>
          </div>

          <div className="panel">
            <div className="panelInner stack">
              <div>
                <h2 className="sectionTitle">How it behaves</h2>
                <p className="sectionNote">
                  The server route generates a clean PPTX file that you can open directly in PowerPoint or import into Google Slides.
                </p>
              </div>

              <div className="stack">
                <div className="notice">
                  <span className="noticeStrong">Cover slide</span>
                  <br />
                  A styled title slide is created first, matching the devotional dark theme from the reference deck.
                </div>
                <div className="notice">
                  <span className="noticeStrong">Verse handling</span>
                  <br />
                  Verse lines are wrapped and split across slides so longer passages stay readable.
                </div>
                <div className="notice">
                  <span className="noticeStrong">Text sections</span>
                  <br />
                  Synonyms, translation, and purport are chunked automatically on sentence and paragraph boundaries.
                </div>
                <div className="notice">
                  <span className="noticeStrong">Deployment</span>
                  <br />
                  The app is built as a standard Next.js project, so it is ready to deploy on Vercel later.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "bhagavatam-ppt";
}
