# Transcript Studio

A dependency-free web app for browsing and exporting SRT transcripts.

## Run it

1. Install Node.js 18 or newer.
2. From this folder, run `npm start`.
3. Open `http://localhost:3000`.

Organize `.srt` files as `transcripts/day/session/file.srt` (for example, `transcripts/day1/morning/Paper1.srt`) and refresh the page. Folder names automatically populate the **Day** and **Session** filters. Root-level files remain available as Uncategorized / Unscheduled.

AI summaries named after their transcript—such as `Paper1_AI1.json`, `Paper1_AI2.json`, and so on—are automatically displayed as separate summary tabs for that presentation.

The **Full transcript** export preserves the SRT sequence numbers, timestamps, speaker labels and text. The **Speaker + text** export removes sequence numbers and timestamps.
