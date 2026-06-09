const METRICS = [
  { key: 'totalHpsas', label: 'Total HPSAs', short: 'Total' },
  { key: 'facilities', label: 'Facilities', short: 'Facilities' },
  { key: 'geographicAreas', label: 'Geographic areas', short: 'Geographic' },
  { key: 'populationGroups', label: 'Population groups', short: 'Population' }
];

const US_STATE_FIPS = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA',
  '08': 'CO', '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL',
  '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN',
  '19': 'IA', '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME',
  '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN', '28': 'MS',
  '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND',
  '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT',
  '50': 'VT', '51': 'VA', '53': 'WA', '54': 'WV', '55': 'WI',
  '56': 'WY'
};

const TILE_GRID = [
  ['AK', '', '', '', '', '', '', '', '', '', '', '', 'ME'],
  ['', '', '', '', '', '', '', '', '', '', 'VT', 'NH', ''],
  ['WA', 'ID', 'MT', 'ND', 'MN', 'IL', 'WI', 'MI', '', 'NY', 'MA', 'RI', ''],
  ['OR', 'NV', 'WY', 'SD', 'IA', 'IN', 'OH', 'PA', 'NJ', 'CT', '', '', ''],
  ['CA', 'UT', 'CO', 'NE', 'MO', 'KY', 'WV', 'VA', 'MD', 'DE', '', '', ''],
  ['', 'AZ', 'NM', 'KS', 'AR', 'TN', 'NC', 'SC', 'DC', '', '', '', ''],
  ['', '', 'OK', 'LA', 'MS', 'AL', 'GA', '', '', '', '', '', ''],
  ['HI', '', 'TX', '', '', '', 'FL', '', '', '', '', '', '']
];

const STATE_ABBRS = new Set(Object.values(US_STATE_FIPS));
const COLOR_STEPS = ['#f2e6a4', '#c7da8d', '#78baa8', '#3d8fa1', '#2b6f9f', '#174a7c'];

let activeMetric = 'totalHpsas';
let selectedAbbr = null;
let stateData = [];
let dataByAbbr = new Map();
let statePaths = [];
let tileGroups = [];
let territoryButtons = [];

document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    stateData = await fetchJson('state-counts.json');
    dataByAbbr = new Map(stateData.map((item) => [item.abbr, normalizeRecord(item)]));
    renderMetricButtons();
    renderSummary();
    renderPanel(getTotals(), 'United States total', 'Unique designated Dental Health HPSA IDs in this activity.');
    renderLegend();
    renderTable();
    renderTerritories();
    await renderMap();
  }
  catch (error) {
    document.getElementById('map').innerHTML = `<div class="error">Unable to load the map data. ${escapeHtml(error.message)}</div>`;
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }
  return response.json();
}

async function renderMap() {
  if (!window.d3 || !window.topojson) {
    renderTileFallback();
    return;
  }

  try {
    const us = await fetchJson('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json');
    const states = topojson.feature(us, us.objects.states);
    drawChoropleth(states);
  }
  catch (error) {
    renderTileFallback();
  }
}

function drawChoropleth(states) {
  const container = document.getElementById('map');
  container.innerHTML = '';
  statePaths = [];
  tileGroups = [];

  const width = 920;
  const height = 560;
  const svg = d3.select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', 'United States choropleth map of designated Dental Health HPSAs');

  const projection = d3.geoAlbersUsa().fitSize([width, height], states);
  const path = d3.geoPath(projection);

  const paths = svg.append('g')
    .selectAll('path')
    .data(states.features)
    .join('path')
    .attr('class', 'state-path')
    .attr('d', path)
    .attr('tabindex', (feature) => getStateData(feature) ? 0 : null)
    .attr('role', (feature) => getStateData(feature) ? 'button' : null)
    .attr('aria-label', (feature) => {
      const record = getStateData(feature);
      return record ? labelFor(record) : 'State data unavailable';
    })
    .on('mouseenter focus', (event, feature) => {
      const record = getStateData(feature);
      if (record) showRecord(record);
    })
    .on('click', (event, feature) => {
      const record = getStateData(feature);
      if (record) selectRecord(record);
    })
    .on('keydown', (event, feature) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const record = getStateData(feature);
      if (!record) return;
      event.preventDefault();
      selectRecord(record);
    });

  paths.append('title').text((feature) => {
    const record = getStateData(feature);
    return record ? labelFor(record) : 'State data unavailable';
  });

  statePaths = paths.nodes();
  updateMapColors();
}

function renderTileFallback() {
  const container = document.getElementById('map');
  container.innerHTML = '';
  statePaths = [];
  tileGroups = [];

  const tileWidth = 58;
  const tileHeight = 46;
  const gap = 8;
  const width = TILE_GRID[0].length * tileWidth + (TILE_GRID[0].length - 1) * gap;
  const height = TILE_GRID.length * tileHeight + (TILE_GRID.length - 1) * gap;
  const svg = createSvg('svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'State tile map of designated Dental Health HPSAs');

  TILE_GRID.forEach((row, rowIndex) => {
    row.forEach((abbr, colIndex) => {
      if (!abbr || !dataByAbbr.has(abbr)) return;
      const record = dataByAbbr.get(abbr);
      const group = createSvg('g');
      group.classList.add('tile');
      group.dataset.abbr = abbr;
      group.setAttribute('tabindex', '0');
      group.setAttribute('role', 'button');
      group.setAttribute('aria-label', labelFor(record));
      group.setAttribute('transform', `translate(${colIndex * (tileWidth + gap)} ${rowIndex * (tileHeight + gap)})`);
      group.addEventListener('mouseenter', () => showRecord(record));
      group.addEventListener('focus', () => showRecord(record));
      group.addEventListener('click', () => selectRecord(record));
      group.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        selectRecord(record);
      });

      const title = createSvg('title');
      title.textContent = labelFor(record);
      const rect = createSvg('rect');
      rect.setAttribute('width', tileWidth);
      rect.setAttribute('height', tileHeight);
      rect.setAttribute('rx', '7');
      const abbrText = createSvg('text');
      abbrText.setAttribute('x', String(tileWidth / 2));
      abbrText.setAttribute('y', '19');
      abbrText.setAttribute('text-anchor', 'middle');
      abbrText.textContent = abbr;
      const valueText = createSvg('text');
      valueText.classList.add('tile-value');
      valueText.setAttribute('x', String(tileWidth / 2));
      valueText.setAttribute('y', '36');
      valueText.setAttribute('text-anchor', 'middle');

      group.append(title, rect, abbrText, valueText);
      svg.appendChild(group);
      tileGroups.push(group);
    });
  });

  container.appendChild(svg);
  updateMapColors();
}

function renderMetricButtons() {
  const group = document.getElementById('metric-buttons');
  group.innerHTML = '';
  METRICS.forEach((metric) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'metric-button';
    button.textContent = metric.short;
    button.dataset.metric = metric.key;
    button.setAttribute('aria-pressed', metric.key === activeMetric ? 'true' : 'false');
    button.addEventListener('click', () => {
      activeMetric = metric.key;
      document.querySelectorAll('.metric-button').forEach((item) => {
        item.setAttribute('aria-pressed', item.dataset.metric === activeMetric ? 'true' : 'false');
      });
      renderLegend();
      updateMapColors();
    });
    group.appendChild(button);
  });
}

function renderSummary() {
  const totals = getTotals();
  const summary = document.getElementById('summary');
  summary.innerHTML = '';
  [
    ['Facilities', totals.facilities],
    ['Geographic areas', totals.geographicAreas],
    ['Population groups', totals.populationGroups],
    ['Total HPSAs', totals.totalHpsas]
  ].forEach(([label, value]) => {
    const card = document.createElement('div');
    card.className = 'summary-card';
    card.innerHTML = `<strong>${formatNumber(value)}</strong><span>${label}</span>`;
    summary.appendChild(card);
  });
}

function renderPanel(metrics, title, detail) {
  const panel = document.getElementById('state-panel');
  panel.innerHTML = `
    <div class="panel-kicker">Current selection</div>
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(detail)}</p>
    <div class="state-metrics">
      ${metricCard('Facilities', metrics.facilities)}
      ${metricCard('Geographic areas', metrics.geographicAreas)}
      ${metricCard('Population groups', metrics.populationGroups)}
      ${metricCard('Total HPSAs', metrics.totalHpsas)}
    </div>
  `;
}

function renderLegend() {
  const metric = METRICS.find((item) => item.key === activeMetric);
  const legend = document.getElementById('legend');
  legend.innerHTML = `<strong>${escapeHtml(metric.label)}</strong><span>lower</span>`;
  COLOR_STEPS.forEach((color) => {
    const swatch = document.createElement('span');
    swatch.className = 'swatch';
    swatch.style.backgroundColor = color;
    legend.appendChild(swatch);
  });
  const high = document.createElement('span');
  high.textContent = 'higher';
  legend.appendChild(high);
}

function renderTerritories() {
  const container = document.getElementById('territories');
  const territories = stateData
    .map(normalizeRecord)
    .filter((item) => !STATE_ABBRS.has(item.abbr));
  container.innerHTML = '';
  territoryButtons = [];
  if (!territories.length) return;

  territories.forEach((record) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'territory-chip';
    button.textContent = `${record.abbr} ${formatNumber(record.totalHpsas)}`;
    button.setAttribute('aria-label', labelFor(record));
    button.title = labelFor(record);
    button.addEventListener('mouseenter', () => showRecord(record));
    button.addEventListener('focus', () => showRecord(record));
    button.addEventListener('click', () => selectRecord(record));
    container.appendChild(button);
    territoryButtons.push({ button, abbr: record.abbr });
  });
}

function renderTable() {
  const tbody = document.querySelector('#data-table tbody');
  tbody.innerHTML = '';
  stateData.map(normalizeRecord).sort((a, b) => a.name.localeCompare(b.name)).forEach((record) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(record.name)}</td>
      <td>${escapeHtml(record.abbr)}</td>
      <td class="numeric">${formatNumber(record.facilities)}</td>
      <td class="numeric">${formatNumber(record.geographicAreas)}</td>
      <td class="numeric">${formatNumber(record.populationGroups)}</td>
      <td class="numeric">${formatNumber(record.totalHpsas)}</td>
    `;
    tbody.appendChild(row);
  });
}

function updateMapColors() {
  const max = Math.max(...stateData.map((item) => Number(item[activeMetric]) || 0), 1);

  statePaths.forEach((path) => {
    const abbr = path.dataset.abbr || getAbbrFromPath(path);
    const record = dataByAbbr.get(abbr);
    const fill = record ? colorForValue(record[activeMetric], max) : { color: '#d8e0e6', tone: 'light' };
    path.style.fill = fill.color;
    path.classList.toggle('is-selected', abbr === selectedAbbr);
  });

  tileGroups.forEach((group) => {
    const abbr = group.dataset.abbr;
    const record = dataByAbbr.get(abbr);
    const fill = record ? colorForValue(record[activeMetric], max) : { color: '#d8e0e6', tone: 'light' };
    const rect = group.querySelector('rect');
    const value = group.querySelector('.tile-value');
    rect.setAttribute('fill', fill.color);
    group.dataset.tone = fill.tone;
    group.classList.toggle('is-selected', abbr === selectedAbbr);
    value.textContent = formatNumber(record[activeMetric]);
  });

  territoryButtons.forEach(({ button, abbr }) => {
    button.classList.toggle('is-selected', abbr === selectedAbbr);
  });
}

function showRecord(record) {
  renderPanel(record, `${record.name} (${record.abbr})`, 'Designated Dental Health HPSAs by unique HPSA ID.');
}

function selectRecord(record) {
  selectedAbbr = record.abbr;
  showRecord(record);
  updateMapColors();
}

function getStateData(feature) {
  const id = String(feature.id).padStart(2, '0');
  const abbr = US_STATE_FIPS[id];
  if (!abbr) return null;
  feature.properties = feature.properties || {};
  feature.properties.abbr = abbr;
  return dataByAbbr.get(abbr) || null;
}

function getAbbrFromPath(path) {
  return path.__data__?.properties?.abbr || '';
}

function getTotals() {
  return stateData.map(normalizeRecord).reduce((acc, item) => {
    acc.facilities += item.facilities;
    acc.geographicAreas += item.geographicAreas;
    acc.populationGroups += item.populationGroups;
    acc.totalHpsas += item.totalHpsas;
    return acc;
  }, { facilities: 0, geographicAreas: 0, populationGroups: 0, totalHpsas: 0 });
}

function normalizeRecord(item) {
  return {
    abbr: String(item.abbr || '').toUpperCase(),
    name: String(item.name || item.abbr || ''),
    facilities: Number(item.facilities) || 0,
    geographicAreas: Number(item.geographicAreas) || 0,
    populationGroups: Number(item.populationGroups) || 0,
    totalHpsas: Number(item.totalHpsas) || 0
  };
}

function colorForValue(value, max) {
  const numeric = Number(value) || 0;
  if (numeric <= 0 || max <= 0) return { color: '#e8eef2', tone: 'light' };
  const ratio = numeric / max;
  if (ratio >= 0.75) return { color: '#174a7c', tone: 'dark' };
  if (ratio >= 0.5) return { color: '#2b6f9f', tone: 'dark' };
  if (ratio >= 0.33) return { color: '#3d8fa1', tone: 'dark' };
  if (ratio >= 0.2) return { color: '#78baa8', tone: 'light' };
  if (ratio >= 0.1) return { color: '#c7da8d', tone: 'light' };
  return { color: '#f2e6a4', tone: 'light' };
}

function labelFor(record) {
  return `${record.name} (${record.abbr}): ${formatNumber(record.facilities)} facilities, ${formatNumber(record.geographicAreas)} geographic areas, ${formatNumber(record.populationGroups)} population groups, ${formatNumber(record.totalHpsas)} total HPSAs.`;
}

function metricCard(label, value) {
  return `<div class="state-metric"><strong>${formatNumber(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function createSvg(tagName) {
  return document.createElementNS('http://www.w3.org/2000/svg', tagName);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
