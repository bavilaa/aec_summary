const els = {
  select: document.querySelector('#file-select'), transcript: document.querySelector('#transcript'),
  day: document.querySelector('#day-select'), session: document.querySelector('#session-select'),
  title: document.querySelector('#workspace-title'), meta: document.querySelector('#meta'),
  recordingTitle: document.querySelector('#recording-title'), recordingAuthor: document.querySelector('#recording-author'),
  search: document.querySelector('#search'), count: document.querySelector('#results-count'),
  full: document.querySelector('#download-full'), clean: document.querySelector('#download-clean'),
  toast: document.querySelector('#toast'), tabs: document.querySelector('#view-tabs'),
  searchRow: document.querySelector('.search-row')
};

let cues = [];
let rawTranscript = '';
let currentFile = '';
let transcriptFiles = [];

function label(value) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function setOptions(select, values, selected) {
  select.innerHTML = values.map((value) => `<option value="${escapeHtml(value)}"${value === selected ? ' selected' : ''}>${escapeHtml(label(value))}</option>`).join('');
}

function updateFileOptions() {
  const matches = transcriptFiles.filter((file) => file.day === els.day.value && file.session === els.session.value);
  els.select.innerHTML = matches.map((file) => `<option value="${escapeHtml(file.path)}">${escapeHtml(file.name.replace(/\.srt$/i, ''))}</option>`).join('');
  els.select.disabled = matches.length === 0;
  if (matches.length) loadFile(matches[0].path);
}

function updateSessionOptions() {
  const sessions = unique(transcriptFiles.filter((file) => file.day === els.day.value).map((file) => file.session));
  setOptions(els.session, sessions, sessions[0]);
  updateFileOptions();
}

function parseSrt(source) {
  return source.replace(/^\uFEFF/, '').trim().split(/\r?\n\s*\r?\n/).map((block, i) => {
    const lines = block.split(/\r?\n/);
    const number = /^\d+$/.test(lines[0].trim()) ? lines.shift().trim() : String(i + 1);
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    const timing = timingIndex >= 0 ? lines.splice(timingIndex, 1)[0].trim() : '';
    const text = lines.join(' ').trim();
    const match = text.match(/^\[?([^\]:]{1,50})\]?:\s*(.*)$/);
    return { number, timing, speaker: match ? match[1].replaceAll('_', ' ') : 'Unknown speaker', text: match ? match[2] : text };
  }).filter((cue) => cue.text);
}

function secondsToTimestamp(value) {
  const milliseconds = Math.max(0, Math.round(Number(value || 0) * 1000));
  const hours = Math.floor(milliseconds / 3600000);
  const minutes = Math.floor((milliseconds % 3600000) / 60000);
  const seconds = Math.floor((milliseconds % 60000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function parseJsonTranscript(source) {
  const data = JSON.parse(source);
  if (!Array.isArray(data.segments)) throw new Error('Unsupported transcript JSON format');
  return data.segments.map((segment, index) => ({
    number: String(index + 1),
    timing: `${secondsToTimestamp(segment.start)} --> ${secondsToTimestamp(segment.end)}`,
    speaker: String(segment.speaker || segment.words?.find((word) => word.speaker)?.speaker || 'Unknown speaker').replaceAll('_', ' '),
    text: String(segment.text || '').trim()
  })).filter((cue) => cue.text);
}

function cuesToSrt(items) {
  return items.map((cue, index) => `${index + 1}\n${cue.timing}\n[${cue.speaker.replaceAll(' ', '_')}]: ${cue.text}`).join('\n\n');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function humanize(value) {
  return String(value).replaceAll('_', ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function renderTabs(file) {
  const summaries = file?.summaries || [];
  els.tabs.innerHTML = `<button class="view-tab active" data-view="transcript">Transcript</button>${summaries.map((summary) => `<button class="view-tab" data-view="summary" data-path="${escapeHtml(summary.path)}">${escapeHtml(summary.label)} Summary</button>`).join('')}`;
}

function section(title, content) {
  if (!content) return '';
  return `<section class="summary-section"><h3>${escapeHtml(humanize(title))}</h3>${content}</section>`;
}

function textSection(title, value) {
  return value ? section(title, `<p>${escapeHtml(value)}</p>`) : '';
}

function listSection(title, values) {
  return Array.isArray(values) && values.length ? section(title, `<ul class="summary-list">${values.map((value) => `<li>${escapeHtml(typeof value === 'string' ? value : value.text || value.question || JSON.stringify(value))}</li>`).join('')}</ul>`) : '';
}

function renderSummary(data) {
  const summary = data.summary || {};
  const paper = data.paper || {};
  const heading = paper.title || paper.presentation_title || paper.session || 'AI Summary';
  const findings = Array.isArray(summary.main_findings) ? summary.main_findings : [];
  const highlights = Array.isArray(data.highlights) ? data.highlights : [];
  const questions = Array.isArray(data.moderator_questions) ? data.moderator_questions : [];
  const quality = data.quality || {};
  els.transcript.innerHTML = `<div class="summary-view">
    <div class="summary-hero"><p class="section-label">AI-generated session summary</p><h3>${escapeHtml(heading)}</h3><p>${escapeHtml(summary.executive_summary || 'Summary details')}</p></div>
    ${textSection('Research question', summary.research_question)}
    ${textSection('Objective', summary.objective)}
    ${textSection('Methodology', summary.methodology)}
    ${findings.length ? section('Main findings', `<div class="summary-grid">${findings.map((item, index) => `<article class="summary-card"><div class="summary-meta"><span class="summary-card-title">Finding ${index + 1}</span>${item.importance ? `<span class="badge ${escapeHtml(item.importance)}">${escapeHtml(item.importance)}</span>` : ''}</div><p>${escapeHtml(item.finding || item.text)}</p></article>`).join('')}</div>`) : ''}
    ${listSection('Conclusions', summary.conclusions)}
    ${listSection('Policy implications', summary.policy_implications)}
    ${listSection('Limitations', summary.limitations)}
    ${highlights.length ? section('Highlights', `<div class="summary-grid">${highlights.map((item) => `<article class="summary-card"><div class="summary-meta">${item.type ? `<span class="badge">${escapeHtml(humanize(item.type))}</span>` : ''}${item.importance ? `<span class="badge ${escapeHtml(item.importance)}">${escapeHtml(item.importance)}</span>` : ''}</div><p>${escapeHtml(item.text)}</p></article>`).join('')}</div>`) : ''}
    ${questions.length ? section('Moderator questions', `<div class="summary-grid">${questions.map((item) => `<article class="summary-card">${item.category ? `<span class="badge">${escapeHtml(item.category)}</span>` : ''}<p>${escapeHtml(item.question)}</p></article>`).join('')}</div>`) : ''}
    ${Array.isArray(data.keywords) && data.keywords.length ? section('Keywords', `<div class="keywords">${data.keywords.map((keyword) => `<span class="keyword">${escapeHtml(keyword)}</span>`).join('')}</div>`) : ''}
    ${quality.transcript_quality ? section('Quality notes', `<div class="summary-meta"><span class="badge">Transcript quality: ${escapeHtml(quality.transcript_quality)}</span></div>${Array.isArray(quality.uncertain_items) ? `<ul class="summary-list">${quality.uncertain_items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}`) : ''}
  </div>`;
}

async function loadSummary(path) {
  els.searchRow.style.display = 'none';
  els.transcript.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';
  const response = await fetch(`/api/summaries/${encodeURIComponent(path)}`);
  if (!response.ok) throw new Error('Could not load summary');
  renderSummary(await response.json());
}

function displayTime(timestamp) {
  return timestamp.split(' --> ')[0]?.replace(',000', '') || '—';
}

function durationFromCues() {
  if (!cues.length) return '0:00';
  const end = cues.at(-1).timing.split(' --> ')[1]?.split(',')[0] || '00:00:00';
  const parts = end.split(':').map(Number);
  return parts[0] ? `${parts[0]}h ${parts[1]}m` : `${parts[1]}m ${parts[2]}s`;
}

function render(query = '') {
  const normalized = query.trim().toLowerCase();
  const filtered = normalized ? cues.filter((cue) => `${cue.speaker} ${cue.text}`.toLowerCase().includes(normalized)) : cues;
  els.count.textContent = normalized ? `${filtered.length} result${filtered.length === 1 ? '' : 's'}` : '';
  if (!filtered.length) {
    els.transcript.innerHTML = '<div class="empty">No matching moments found. Try another search.</div>';
    return;
  }
  const escapedQuery = escapeHtml(query.trim());
  const queryRegex = escapedQuery ? new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi') : null;
  els.transcript.innerHTML = filtered.map((cue) => {
    const text = escapeHtml(cue.text);
    const highlighted = queryRegex ? text.replace(queryRegex, '<mark>$1</mark>') : text;
    return `<article class="cue"><time class="timestamp">${escapeHtml(displayTime(cue.timing))}</time><span class="speaker" title="${escapeHtml(cue.speaker)}">${escapeHtml(cue.speaker)}</span><div class="cue-text">${highlighted}</div></article>`;
  }).join('');
}

async function loadFile(filename) {
  els.transcript.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';
  const response = await fetch(`/api/transcripts/${encodeURIComponent(filename)}`);
  if (!response.ok) throw new Error('Could not load transcript');
  const source = await response.text();
  currentFile = filename;
  const file = transcriptFiles.find((item) => item.path === filename);
  cues = file?.format === 'json' ? parseJsonTranscript(source) : parseSrt(source);
  rawTranscript = file?.format === 'json' ? cuesToSrt(cues) : source;
  els.search.value = '';
  renderTabs(file);
  els.searchRow.style.display = 'flex';
  els.title.textContent = (file?.name || filename).replace(/\.(srt|json)$/i, '').replaceAll('_', ' ');
  const metadata = file?.metadata;
  els.recordingTitle.textContent = metadata?.sessionTitle || '';
  els.recordingTitle.hidden = !metadata?.sessionTitle;
  els.recordingAuthor.textContent = metadata?.author ? `Presented by ${metadata.author}` : '';
  els.recordingAuthor.hidden = !metadata?.author;
  const speakers = new Set(cues.map((cue) => cue.speaker)).size;
  els.meta.innerHTML = `<span><strong>${cues.length}</strong> moments</span><span><strong>${speakers}</strong> speakers</span><span><strong>${durationFromCues()}</strong> duration</span>`;
  render();
}

function download(content, suffix) {
  const base = currentFile.split('/').at(-1).replace(/\.(srt|json)$/i, '');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = Object.assign(document.createElement('a'), { href: url, download: `${base}-${suffix}.txt` });
  anchor.click();
  URL.revokeObjectURL(url);
  els.toast.textContent = `${suffix === 'full' ? 'Full' : 'Speaker + text'} transcript downloaded`;
  els.toast.classList.add('show');
  setTimeout(() => els.toast.classList.remove('show'), 2400);
}

async function init() {
  try {
    const response = await fetch('/api/transcripts');
    const { files } = await response.json();
    if (!files.length) throw new Error('No SRT transcripts found');
    transcriptFiles = files;
    const days = unique(files.map((file) => file.day));
    setOptions(els.day, days, days[0]);
    updateSessionOptions();
  } catch (error) {
    els.transcript.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    els.select.innerHTML = '<option>No transcripts found</option>';
  }
}

els.select.addEventListener('change', () => loadFile(els.select.value));
els.day.addEventListener('change', updateSessionOptions);
els.session.addEventListener('change', updateFileOptions);
els.tabs.addEventListener('click', async (event) => {
  const tab = event.target.closest('.view-tab');
  if (!tab) return;
  els.tabs.querySelectorAll('.view-tab').forEach((item) => item.classList.toggle('active', item === tab));
  if (tab.dataset.view === 'transcript') {
    els.searchRow.style.display = 'flex';
    render(els.search.value);
  } else {
    try { await loadSummary(tab.dataset.path); }
    catch (error) { els.transcript.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
  }
});
els.search.addEventListener('input', () => render(els.search.value));
els.full.addEventListener('click', () => download(rawTranscript, 'full'));
els.clean.addEventListener('click', () => download(cues.map((cue) => `${cue.speaker}: ${cue.text}`).join('\n\n'), 'speaker-text'));
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); els.search.focus(); }
});

init();
