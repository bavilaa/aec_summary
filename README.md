# Transcript Studio

A dependency-free web app for browsing and exporting SRT transcripts.

## Run it

1. Install Node.js 18 or newer.
2. From this folder, run `npm start`.
3. Open `http://localhost:3000`.

Organize transcript files as `transcripts/day/session/file.srt` or timestamped `file.json` (for example, `Paper1.srt` or `Dialogue1.json`) and refresh the page. Folder names automatically populate the **Day** and **Session** filters. Root-level files remain available as Uncategorized / Unscheduled.

AI summaries named after their transcript—such as `Paper1_AI1.json`, `Dialogue1_AI1.json`, or additional AI2 variants—are automatically displayed as separate summary tabs for that recording.

Recording metadata originates in `public/papers.xlsx` and is published to the app through `public/papers.json`. Records are matched by ID, day and session; blank authors (such as high-level dialogues) are omitted from the interface.

The **Full transcript** export preserves the SRT sequence numbers, timestamps, speaker labels and text. The **Speaker + text** export removes sequence numbers and timestamps.
