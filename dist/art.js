// Original, hand-built celestial siege artwork. Every asset is inline and works offline.
// Unique paint-server IDs keep many copies of one illustration safe in the same DOM.
let illustrationId = 0;
const wrap = (body, view = '0 0 100 100', cls = '', extra = '') => `<svg class="${cls}" viewBox="${view}" xmlns="http://www.w3.org/2000/svg" fill="none" aria-hidden="true" focusable="false" ${extra}>${body}</svg>`;
const uid = (kind) => `km-${kind}-${++illustrationId}`;
const diamond = (x,y,r,color,opacity=1) => `<path d="M${x} ${y-r} ${x+r*.65} ${y} ${x} ${y+r} ${x-r*.65} ${y}Z" fill="${color}" opacity="${opacity}"/>`;

// The four action families have intentionally different silhouettes at 16–24 px.
const icons = {
  stone: `<path d="m5 9 8-5 10 4 2 11-11 6L3 19Z" fill="currentColor" opacity=".18"/><path d="m5 9 8-5 10 4 2 11-11 6L3 19Zm0 0 9 5 9-6m-9 6v11M8 6l9 5" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m7 13-1 4 5 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  arrow: `<path d="M5 23 22 6M16 5l8-1-1 8M5 16v7h7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 4c11 2 15 6 17 17M7 4l17 17" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`,
  sound: `<path d="M10 5v7a4 4 0 0 0 8 0V5M14 16v8M10 24h8" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/><path d="M5 7a11 11 0 0 0 0 11M23 7a11 11 0 0 1 0 11" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" opacity=".65"/><path d="m14 2 2 3-2 3-2-3Z" fill="currentColor"/>`,
  tactic: `<path d="m14 3 10 11-10 11L4 14Z" fill="currentColor" opacity=".13"/><path d="m14 3 10 11-10 11L4 14Z" stroke="currentColor" stroke-width="1.8"/><path d="M14 8v12m-6-6h12M11 11l3-3 3 3m-6 6 3 3 3-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  shield: `<path d="m14 3 10 4v7c0 5-5 9-10 11C9 23 4 19 4 14V7Z" fill="currentColor" opacity=".12"/><path d="m14 3 10 4v7c0 5-5 9-10 11C9 23 4 19 4 14V7Zm0 4v14" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m8 12 6 3 6-3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  exchange: `<path d="M5 10h18m-5-5 5 5-5 5M23 20H5m5-5-5 5 5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  flag: `<path d="M6 25V3m0 2c6-5 11 5 18 0v12c-7 5-12-5-18 0" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 25h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  volume: `<path d="M4 10h5l6-5v18l-6-5H4Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M19 10a7 7 0 0 1 0 8m3-12a12 12 0 0 1 0 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  mute: `<path d="M3 10h5l6-5v18l-6-5H3Z" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="m19 10 7 8m0-8-7 8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`,
  help: `<circle cx="14" cy="14" r="10.5" stroke="currentColor" stroke-width="1.8"/><path d="M10 10a4 4 0 0 1 8 0c0 3-4 3-4 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="20" r="1.2" fill="currentColor"/>`,
  settings: `<path d="m11 3 6 0 1 4 3 2 4-1 2 5-3 3v3l-4 4-4-1-3 3-5-2v-4l-4-2v-6l4-1 2-3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="14" cy="14" r="4" stroke="currentColor" stroke-width="1.8"/>`,
  close: `<path d="m7 7 14 14M21 7 7 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>`,
  refresh: `<path d="M23 10a10 10 0 1 0 0 9M23 3v8h-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  check: `<path d="m6 14 6 6L24 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`,
  lock: `<path d="M8 12V8a6 6 0 0 1 12 0v4M6 12h16v13H6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 17v4" stroke="currentColor" stroke-width="2.7" stroke-linecap="round"/>`,
  star: `<path d="m14 2 3.6 8.2 8.9 1-6.7 6 1.8 8.8-7.6-4.7-7.6 4.7 1.8-8.8-6.7-6 8.9-1Z" fill="currentColor"/>`,
  chevron: `<path d="m10 5 9 9-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
  book: `<path d="M14 7C10 3 4 4 3 5v18c4-2 8-1 11 2 3-3 7-4 11-2V5c-4-2-8-1-11 2Zm0 0v18M7 10l3 1m8 0 3-1M7 15l3 1m8 0 3-1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`,
  energy: `<path d="M16 2 5 16h8l-1 10 12-16h-9Z" fill="currentColor"/>`,
  target: `<circle cx="14" cy="14" r="9" stroke="currentColor" stroke-width="1.8"/><circle cx="14" cy="14" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M14 1v6m0 14v6M1 14h6m14 0h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`,
  crown: `<path d="m4 7 6 5 4-9 4 9 6-5-3 15H7Z" fill="currentColor" opacity=".16"/><path d="m4 7 6 5 4-9 4 9 6-5-3 15H7Zm3 11h14" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>`,
  heart: `<path d="M14 24 4 14C-3 6 8-1 14 7c6-8 17-1 10 7Z" fill="currentColor"/>`,
  eye: `<path d="M2 14S6 6 14 6s12 8 12 8-4 8-12 8S2 14 2 14Z" stroke="currentColor" stroke-width="1.8"/><circle cx="14" cy="14" r="4" stroke="currentColor" stroke-width="1.8"/>`,
  play: `<path d="m9 5 15 9-15 9Z" fill="currentColor"/>`,
  pause: `<path d="M8 5h4v18H8Zm8 0h4v18h-4Z" fill="currentColor"/>`,
  spark: `<path d="m14 1 3 10 10 3-10 3-3 10-3-10-10-3 10-3Z" fill="currentColor"/>`,
  sword: `<path d="m20 3 5 0 0 5-12 12-5-5ZM5 12l11 11M3 25l5-5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`,
  info: `<circle cx="14" cy="14" r="10.5" stroke="currentColor" stroke-width="1.8"/><path d="M14 13v7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="14" cy="8" r="1.2" fill="currentColor"/>`,
};
export function icon(name) {
  const aliases = {swap:'exchange',switch:'exchange',bolt:'energy',lightning:'energy',magic:'sound',strategy:'tactic',chevronRight:'chevron',attack:'sword',defense:'shield',training:'target',gear:'settings'};
  return wrap(icons[name] || icons[aliases[name]] || icons.shield, '0 0 28 28', `icon icon-${name}`);
}

function paints(id, color, dark) {
  return `<defs>
    <linearGradient id="${id}-ivory" x1=".05" y1="0" x2=".9" y2="1"><stop stop-color="#fff5d7"/><stop offset=".38" stop-color="#e7d6af"/><stop offset="1" stop-color="#a99687"/></linearGradient>
    <linearGradient id="${id}-white" x1="0" y1="0" x2=".6" y2="1"><stop stop-color="#fff9e4"/><stop offset="1" stop-color="#d3bfa0"/></linearGradient>
    <linearGradient id="${id}-shadow" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#9c9298"/><stop offset="1" stop-color="#5e5b78"/></linearGradient>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#fff1ab"/><stop offset=".3" stop-color="#ebc675"/><stop offset=".65" stop-color="#b98348"/><stop offset="1" stop-color="#745a54"/></linearGradient>
    <linearGradient id="${id}-roof" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${color}"/><stop offset=".4" stop-color="${dark}"/><stop offset="1" stop-color="#273347"/></linearGradient>
    <linearGradient id="${id}-rock" x1="0" y1="0" x2=".5" y2="1"><stop stop-color="#595b75"/><stop offset=".46" stop-color="#303854"/><stop offset="1" stop-color="#171e37"/></linearGradient>
    <linearGradient id="${id}-crystal" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#edfff4"/><stop offset=".35" stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <radialGradient id="${id}-glow"><stop stop-color="${color}" stop-opacity=".5"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>
    <linearGradient id="${id}-beam" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${color}" stop-opacity=".5"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient>
  </defs>`;
}
function island(id, color, large = false, ruined = false) {
  return `<g class="floating-island">
    <ellipse cx="120" cy="206" rx="76" ry="12" fill="url(#${id}-glow)" opacity=".7"/>
    <path d="m27 160 23-11 31 2 35-9 45 6 38 10 17 16-25 15-22 5-21 22-16-10-15 21-21-23-26-2-17-17-17-7Z" fill="url(#${id}-rock)"/>
    <path d="m27 160 51 10 39 57-21-23-26-2-17-17-17-7Z" fill="#3e4966"/>
    <path d="m78 170 34-8 19 44-14 21Z" fill="#26344d"/>
    <path d="m112 162 52 8-16 46-16-10Z" fill="#4b4d68"/>
    <path d="m164 170 52 4-25 15-22 5-21 22Z" fill="#252e48"/>
    <path d="m36 157 47-10 35-8 52 9 30 10 16 11-25 13-50 6-53-7-42-11Z" fill="${ruined?'#665e69':'#517e7e'}"/>
    <path d="m36 157 47-10 35-8 52 9 30 10-48 16-51-2-38-7Z" fill="${ruined?'#7d7580':'#76958b'}"/>
    <path d="m45 158 39-7 32-9 55 9 22 8-43 12-48-2Z" fill="#aaa58d" opacity=".4"/>
    <path d="m36 157 27 9 38 7 51 1 48-16M45 174l43 9 53 7 50-7" stroke="#b9ddbe" stroke-opacity=".28" stroke-width="1.5"/>
    <path d="m68 190 7 3 4 10-5-3m80-15 5 8-4 13-4-8" fill="url(#${id}-crystal)" opacity=".9"/>
    <path d="m119 198 4 4-2 13-4-7Z" fill="${color}" opacity=".6"/>
    <path d="m93 180-4 14-6 3m86-21-8 9 3 12M52 174l4 10 9 2" stroke="#8394a8" stroke-opacity=".4" stroke-width="1.2"/>
    ${!ruined?`<g fill="#203b51"><path d="m42 156 2-13 5 11 1-18 5 19 6-12-3 18Z"/><path d="m175 162 3-13 4 11 5-18 2 19 6-8-3 15Z"/></g><g fill="#d5ce9f"><circle cx="52" cy="162" r="1.6"/><circle cx="181" cy="166" r="1.4"/><circle cx="75" cy="171" r="1.2"/></g>`:''}
    <g class="island-motes" fill="${color}" opacity=".7"><circle cx="37" cy="189" r="1.4"/><circle cx="190" cy="204" r="1.2"/><circle cx="157" cy="222" r="1"/></g>
  </g>`;
}
function banner(id, color, x, y, flip = false) {
  return `<g class="banner" transform="translate(${x} ${y})${flip?' scale(-1 1)':''}"><path d="M0 0v34" stroke="#e2bf7b" stroke-width="1.8"/><circle cy="-1" r="2.1" fill="#fff0b2"/><path d="M1 2C9-1 15 8 24 4l-3 8 1 8C13 24 9 12 1 15Z" fill="${color}"/><path d="M2 4c8-2 14 6 20 3" stroke="#fff7c8" stroke-opacity=".65"/><path d="m9 6 4 2-1 6-3-2Z" fill="#fff5c3" opacity=".85"/></g>`;
}
function windowAt(id,x,y,width=8,height=16) {
  return `<path d="M${x} ${y+height}v-${height-4}q${width/2} -8 ${width} 0v${height-4}Z" fill="#34435b"/><path d="M${x+2} ${y+height-2}v-${height-6}q${(width-4)/2} -5 ${width-4} 0v${height-6}Z" fill="url(#${id}-crystal)"/><path d="M${x+width/2} ${y+3}v${height-4}" stroke="#e7cc8a" stroke-width="1"/>`;
}
function bastion(id,color) {
  return `<g class="castle-core bastion-core">
    <ellipse cx="122" cy="161" rx="72" ry="16" fill="#192f43" opacity=".38"/>
    <path d="m48 132 40-16 73 4 31 16v24l-35 16-71-5-38-17Z" fill="url(#${id}-ivory)"/>
    <path d="m48 132 38 11 71 5 35-12v24l-35 16-71-5-38-17Z" fill="url(#${id}-shadow)"/>
    <path d="m48 132 38 11 71 5v28l-71-5-38-17Z" fill="url(#${id}-ivory)"/>
    <path d="m58 137 30 9 67 5v7l-66-5-31-9Z" fill="#f6e7bf"/>
    <path d="m157 150 35-11v7l-35 12Z" fill="#ab926f"/>
    <path d="M82 79 116 65l43 13v62l-37 15-40-12Z" fill="url(#${id}-ivory)"/>
    <path d="m122 84 37-6v62l-37 15Z" fill="url(#${id}-shadow)"/>
    <path d="m82 79 34-14 43 13-37 14Z" fill="#f9ebc7"/>
    <path d="m77 76 39-16 48 16v13l-41 15-46-15Z" fill="url(#${id}-gold)"/>
    <path d="m77 76 46 14 41-14-5 13-36 13-46-13Z" fill="url(#${id}-ivory)"/>
    <path d="m81 72 11 4v13l-11-3Zm21 6 12 4v13l-12-4Zm22 5 11-4v13l-11 4Zm21-8 12-4v13l-12 5Z" fill="#fff0cc"/>
    <path d="m92 69 25-10 26 9-26 11Z" fill="#273a4b"/>
    <path d="m101 55 15-13 17 8 5 15-21 10-20-7Z" fill="url(#${id}-crystal)" class="magic-core"/>
    <path d="m116 42 1 33 21-10-5-15Z" fill="${color}" opacity=".45"/><path d="m101 55 15 5 17-10m-17 10 1 15" stroke="#efffdc" stroke-opacity=".7"/>
    <path d="M94 96v34m12-29v34" stroke="#c5b493" stroke-width="2"/>
    ${windowAt(id,134,103,8,16)}
    <path d="m39 108 23-10 23 9v48l-23 11-23-12Z" fill="url(#${id}-ivory)"/>
    <path d="m62 119 23-12v48l-23 11Z" fill="#9f9692"/>
    <path d="m36 102 25-10 27 10v12l-26 12-26-12Z" fill="url(#${id}-gold)"/>
    <path d="m36 102 26 11 26-11v8l-26 12-26-11Z" fill="#f1dfb8"/>
    <path d="m40 95 8 3v15l-8-3Zm14 6 9 3v15l-9-3Zm14 1 8-4v15l-8 4Zm12-8 8-3v16l-8 4Z" fill="url(#${id}-white)"/>
    <path d="m43 97 18-7 21 7-20 9Z" fill="#526e76"/>
    <path d="m160 112 23-10 21 9v43l-23 11-21-11Z" fill="url(#${id}-ivory)"/>
    <path d="m181 122 23-11v43l-23 11Z" fill="url(#${id}-shadow)"/>
    <path d="m157 106 26-11 24 10v12l-26 12-24-12Z" fill="url(#${id}-gold)"/>
    <path d="m157 106 24 11 26-12v8l-26 12-24-11Z" fill="#e8d8b3"/>
    <path d="m160 99 8 3v15l-8-3Zm14 6 8 3v15l-8-3Zm14-1 8-4v15l-8 4Zm11-8 8-3v16l-8 4Z" fill="url(#${id}-white)"/>
    <path d="m164 101 18-8 19 7-20 9Z" fill="#526e76"/>
    <path d="M102 172v-17q11-21 23-1v20Z" fill="#3a3b50"/><path d="M107 172v-16q6-13 13-1v18Z" fill="url(#${id}-crystal)"/><path d="m100 171 27 3 13 8-29-3-18-5Z" fill="#e1ceb0"/><path d="m96 175 34 4m-25-4 13-3" stroke="#a39589"/>
    ${windowAt(id,47,129,7,15)}${windowAt(id,167,131,7,14)}
    <path d="m88 124 12 4m-9 10 15 5m24-16 12-4m-4 21 13-4M42 149l13 5m129-15 14-6" stroke="#8b827e" stroke-width="1.3" opacity=".45"/>
    <path d="m89 145 5 2v12l-5-1m50-8 7-2v12l-7 2" fill="url(#${id}-gold)"/>
    ${banner(id,color,68,66)}
    <path d="m70 167 2-14 8-4-3 19Z" fill="${color}" opacity=".6"/>
  </g>`;
}
function spire(id,color) {
  return `<g class="castle-core spire-core">
    <ellipse cx="122" cy="161" rx="59" ry="14" fill="#192f43" opacity=".4"/>
    <path d="m70 151 45-21 61 19v15l-45 17-61-17Z" fill="url(#${id}-ivory)"/>
    <path d="m70 151 61 16 45-18v15l-45 17-61-17Z" fill="url(#${id}-shadow)"/>
    <path d="m70 151 61 16v14l-61-17Z" fill="#d5c3a3"/>
    <path d="m91 110 25-13 30 10v52l-28 12-27-10Z" fill="url(#${id}-ivory)"/>
    <path d="m118 120 28-13v52l-28 12Z" fill="url(#${id}-shadow)"/>
    <path d="m96 71 21-10 23 9v51l-22 10-22-9Z" fill="url(#${id}-white)"/>
    <path d="m118 81 22-11v50l-22 10Z" fill="#a69494"/>
    <path d="m88 73 30-57 31 55-31 14Z" fill="url(#${id}-roof)"/>
    <path d="m118 16 0 69 31-14Z" fill="#182c45" opacity=".6"/>
    <path d="m88 73 30 12 31-14M118 18v-9" stroke="url(#${id}-gold)" stroke-width="2.4" stroke-linejoin="round"/>
    <path d="m118 23-12 48 12 5 12-7Z" fill="${color}" opacity=".32"/><path d="m118 28 0 44" stroke="#e5ffd8" stroke-opacity=".5"/>
    ${diamond(118,8,6,'#f9d797')}
    <path d="m91 107 27 11 28-13v10l-28 13-27-11Z" fill="url(#${id}-gold)"/>
    <path d="m83 130 35 14 35-16v10l-35 16-35-14Z" fill="url(#${id}-gold)"/>
    <path d="m87 133 31 12v8l-31-12Z" fill="#f4e4bf"/>
    <path d="m81 131 9-31 3 33m48-1 7-35 9 31" fill="url(#${id}-ivory)"/>
    <path d="M64 149c-7-49 8-83 37-100-18 22-22 50-14 75M174 148c14-39 4-74-24-99 19 28 17 52 2 75" stroke="#554453" stroke-width="9" stroke-linecap="round"/>
    <path d="M64 147c-7-48 8-81 37-98-18 22-22 50-14 75M174 146c14-37 4-72-24-97 19 28 17 52 2 75" stroke="url(#${id}-gold)" stroke-width="6" stroke-linecap="round"/>
    <path d="m101 49-37 98m86-98 24 97" stroke="#fff1bf" stroke-width="1" opacity=".8"/>
    <path d="m58 149 9-5 13 8-12 6Z" fill="#f1dfb4"/><path d="m164 149 10-6 12 8-12 6Z" fill="#d5c198"/>
    ${windowAt(id,104,88,7,16)}${windowAt(id,127,88,6,14)}
    <path d="M102 166v-14q7-13 14-1v19Z" fill="#283a52"/><path d="M105 166v-13q4-7 8-1v17Z" fill="url(#${id}-crystal)"/>
    <path d="m96 168 23 5 6 7-23-5-14-6Z" fill="#eee0bb"/>
    <path d="m96 142 7 2m25-10 8-4m-13 24 10-4" stroke="#8b7e79" stroke-width="1.3" opacity=".6"/>
    ${banner(id,color,146,73,true)}
    <g class="magic-core">${diamond(63,137,6,color)}${diamond(174,136,6,color)}<circle cx="118" cy="34" r="24" fill="url(#${id}-glow)"/></g>
  </g>`;
}
function citadel(id,color) {
  return `<g class="castle-core citadel-core">
    <circle class="magic-aura" cx="119" cy="69" r="68" fill="url(#${id}-glow)" opacity=".55"/>
    <ellipse cx="120" cy="161" rx="73" ry="16" fill="#192f43" opacity=".4"/>
    <g class="orbit-ring"><ellipse cx="120" cy="58" rx="49" ry="19" transform="rotate(-22 120 58)" stroke="#d0b879" stroke-width="1.7" opacity=".8"/><ellipse cx="120" cy="58" rx="61" ry="25" transform="rotate(-22 120 58)" stroke="#b3e2d3" stroke-width=".7" stroke-dasharray="2 9" opacity=".5"/>${diamond(75,76,4,'#fff1ad')}${diamond(164,39,4,'#fff1ad')}</g>
    <path d="m60 144 55-22 66 20v24l-57 20-64-19Z" fill="url(#${id}-ivory)"/>
    <path d="m124 163 57-21v24l-57 20Z" fill="url(#${id}-shadow)"/>
    <path d="m54 141 61-24 72 23v10l-62 23-71-22Z" fill="url(#${id}-gold)"/>
    <path d="m54 141 71 22 62-23v7l-62 23-71-22Z" fill="#efe0b9"/>
    <path d="m90 88 28-14 33 12v67l-28 12-33-12Z" fill="url(#${id}-ivory)"/>
    <path d="m123 99 28-13v67l-28 12Z" fill="url(#${id}-shadow)"/>
    <path d="m84 86 34-29 39 27-34 15Z" fill="url(#${id}-roof)"/>
    <path d="m118 57 5 42 34-15Z" fill="#1e3149" opacity=".5"/>
    <path d="m84 86 39 13 34-15" stroke="url(#${id}-gold)" stroke-width="3"/>
    <path d="m96 115 11-3v30l-11 5Zm37-3 8-4v27l-8 5Z" fill="#354259"/>
    <path d="m100 117 4-2v24l-4 3Zm36-3 3-2v22l-3 2Z" fill="url(#${id}-crystal)"/>
    <path d="m46 129 22-9 19 8v36l-20 9-21-10Z" fill="url(#${id}-ivory)"/>
    <path d="m67 139 20-11v36l-20 9Z" fill="#9f9591"/>
    <path d="m43 127 24-29 23 29-23 12Z" fill="url(#${id}-roof)"/>
    <path d="m43 127 24 12 23-12" stroke="url(#${id}-gold)" stroke-width="2.7"/>
    <path d="m153 129 22-9 19 8v36l-20 9-21-10Z" fill="url(#${id}-ivory)"/>
    <path d="m174 139 20-11v36l-20 9Z" fill="url(#${id}-shadow)"/>
    <path d="m150 127 24-29 23 29-23 12Z" fill="url(#${id}-roof)"/>
    <path d="m150 127 24 12 23-12" stroke="url(#${id}-gold)" stroke-width="2.7"/>
    <path d="M85 133c-22-20-29-49-19-71l6-14 6 34c4 13 11 19 21 24m48 25c20-21 27-48 17-70l-6-13-6 32c-4 14-11 21-21 25" fill="none" stroke="#665966" stroke-width="12" stroke-linecap="round"/>
    <path d="M85 130c-22-20-29-47-19-69l6-13 6 33c4 13 11 19 21 24m48 23c20-21 27-46 17-68l-6-12-6 32c-4 14-11 21-21 25" stroke="url(#${id}-gold)" stroke-width="9" stroke-linecap="round"/>
    <path d="M70 57c-11 28-4 48 13 64m75-64c12 28 3 49-10 61" stroke="#fff0ba" stroke-width="1.2" stroke-linecap="round" opacity=".8"/>
    <path d="m69 51 2-17 6 11-4 15m84-6 1-20 5 13-2 14" fill="#edcc7f"/>
    <path d="M106 175v-16q12-21 25-1v20Z" fill="#29344e"/><path d="M111 175v-16q7-12 15-1v18Z" fill="url(#${id}-crystal)"/><path d="m103 175 31 4 12 7-32-2-20-7Z" fill="#e9d8b3"/>
    <path d="M118 147v30m-7-14h15" stroke="#d1b677" stroke-width="1.6"/>
    ${windowAt(id,53,145,7,15)}${windowAt(id,159,145,7,15)}
    <g class="magic-core"><circle cx="119" cy="53" r="23" fill="url(#${id}-glow)"/><path d="m119 27 12 23-12 23-12-23Z" fill="url(#${id}-crystal)"/><path d="m119 27 0 46 12-23Z" fill="${color}" opacity=".65"/><path d="m108 50 11 5 11-5m-11-18v18" stroke="#f1ffe2" stroke-opacity=".8" stroke-width="1"/>${diamond(119,20,3,'#ffe6a7')}</g>
    <path d="m116 104 7-3 7 2-7 11Z" fill="url(#${id}-gold)"/>
    ${banner(id,color,48,96)}${banner(id,color,193,96,true)}
  </g>`;
}
function ruins(id,color,heroId) {
  return `<g class="castle-core ruins-core"><ellipse cx="120" cy="162" rx="69" ry="14" fill="#18273c" opacity=".5"/><path d="m51 158 7-24 16 7 13-22 25 14 15-12 21 16 13-8 22 14 7 16-37 15-60-2Z" fill="url(#${id}-shadow)"/><path d="m54 153 18-10 17 10 18-15 22 9 17-6 23 14 13-2-28 16-60-2Z" fill="#a89a98"/><path d="m77 140 6-29 12 3 3 29-10 10m54-3 8-37 17 8-7 34Z" fill="url(#${id}-ivory)"/><path d="m61 156 22 2 7 11-23-4Zm53-5 16 4-5 13-20-6Zm42 5 17 3-11 9-15-2Z" fill="#cfbf9e"/><path d="m83 115 12 7-1 18m58-19 11 6-5 20" stroke="#5b5367" stroke-width="2"/><path d="m115 145 6-28 7 9-5 25Z" fill="${color}" opacity=".35"/><path d="m174 129-12-30" stroke="#a28e73" stroke-width="2"/><path d="m162 99 19-5-3 9 8 6-18 4Z" fill="${color}" opacity=".6"/><path d="m79 126 3-12-4-10m60 22-4-13 5-11" stroke="#b0a4be" stroke-opacity=".22" stroke-width="4" stroke-linecap="round"/><g fill="#dac19a" opacity=".35"><circle cx="98" cy="111" r="1.4"/><circle cx="151" cy="101" r="1"/><circle cx="66" cy="119" r="1.4"/></g></g>`;
}

/** Stable entry point: left=kora, right=ilda, main=neris. */
export function castleArt(side='player', main=false, fallen=false, heroId=main?'neris':'kora') {
  return castleScene({side, main, fallen, heroId});
}
export function castleScene({side='player', heroId='kora', main=false, fallen=false}={}) {
  const hero = ['kora','ilda','neris'].includes(heroId) ? heroId : main ? 'neris' : 'kora';
  const id = uid(hero);
  const color = side === 'enemy' ? '#f7a29c' : '#90e4cf';
  const dark = side === 'enemy' ? '#9d5269' : '#377d80';
  const art = fallen ? ruins(id,color,hero) : ({kora:bastion,ilda:spire,neris:citadel}[hero])(id,color);
  return wrap(`${paints(id,color,dark)}${island(id,color,main,fallen)}${art}`, '0 0 240 230', `castle-art castle-${hero} ${side} ${main?'main-art':''} ${fallen?'fallen':''}`, `data-art-hero="${hero}"`);
}

export function portrait(heroId, cls='') {
  const hero = ['kora','ilda','neris'].includes(heroId) ? heroId : 'kora';
  const id = uid(`portrait-${hero}`);
  const accents = {kora:['#c6ad78','#426565'],ilda:['#a3d6bb','#315d67'],neris:['#c9b2f2','#575285']};
  const [light,dark]=accents[hero];
  const defs = `<defs><linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${dark}"/><stop offset="1" stop-color="#182b44"/></linearGradient><linearGradient id="${id}-skin" x1="0" y1="0" x2=".9" y2="1"><stop stop-color="${hero==='neris'?'#c49196':hero==='kora'?'#dfa77d':'#f4c3a0'}"/><stop offset="1" stop-color="${hero==='neris'?'#885776':hero==='kora'?'#ad715c':'#bc7a72'}"/></linearGradient><linearGradient id="${id}-metal" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#f6e9c9"/><stop offset=".5" stop-color="#c6bdad"/><stop offset="1" stop-color="#76828d"/></linearGradient><linearGradient id="${id}-cloth" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient><linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff1b0"/><stop offset="1" stop-color="#a98452"/></linearGradient><clipPath id="${id}-clip"><rect width="120" height="144" rx="5"/></clipPath></defs>`;
  const background = `<path d="M0 0h120v144H0Z" fill="url(#${id}-bg)"/><circle cx="62" cy="58" r="49" fill="${light}" opacity=".08"/><circle cx="62" cy="58" r="42" stroke="${light}" stroke-opacity=".3" stroke-width=".8"/><path d="M10 86 36 16l59 6 22 67M5 110l19-9m74-85 8-7" stroke="${light}" stroke-opacity=".2"/>${diamond(18,28,3,light,.7)}${diamond(103,49,2,light,.6)}`;
  const artwork = {
    kora: `<path d="M5 144v-28q10-31 49-31 43-2 62 32v27Z" fill="#31545e"/><path d="m43 80 30-2 2 23-18 19-17-21Z" fill="url(#${id}-skin)"/><path d="m32 94 23 19 26-22 17 16-17 37H27l-8-39Z" fill="#213d4d"/><path d="M32 26q29-16 52 9l-2 32-15 23H48L31 70 25 44Z" fill="url(#${id}-skin)"/><path d="m29 42-4-20 16-12 27 1 21 20-5 19-9-18-24-7-16 7-5 17Z" fill="#32434e"/><path d="m29 28 8-13 21-5 13 5-22 3-12 13Z" fill="#87959a"/><path d="m75 25 10 8-2 17-6-10Z" fill="#8c9d9f"/><path d="m30 58 10 9 9-3 9 4 11-4 11-10-3 20-16 19-18-5-14-18Z" fill="#364652"/><path d="m38 71 10 7 14 3 12-8-11 13-14-3Z" fill="#65737a"/><path d="m36 43 11-2m16 3 10 3" stroke="#35414c" stroke-width="4" stroke-linecap="round"/><path d="m38 49 7 1m20 1 6 1" stroke="#342f39" stroke-width="2.5" stroke-linecap="round"/><circle cx="42" cy="49" r="1.2" fill="#e7edce"/><circle cx="68" cy="51" r="1.2" fill="#e7edce"/><path d="m53 49-4 13 7 3" stroke="#a66f5c" stroke-width="1.7" stroke-linecap="round"/><path d="m48 71 8 2 8-1" stroke="#e6b18d" stroke-width="1.6" stroke-linecap="round"/><path d="m76 42-2 11" stroke="#f7cc9c" stroke-width="1.5"/><path d="m39 35 9 1" stroke="#f2c599" stroke-width="1.3" opacity=".7"/><path d="m3 111 12-17 23-2 15 21-8 23-27 8-15-11Z" fill="url(#${id}-metal)"/><path d="m3 111 25 9 25-7-8 23-27 8-15-11Z" fill="#7e8e93"/><path d="m3 111 25 9 25-7m-25 7-10 24" stroke="#e8dfbe" stroke-width="2"/><path d="m10 106 7-8 18-2 7 12-17 5Z" fill="#d3d3b8"/><path d="m78 95 21 3 18 19-7 21-23-3-13-25Z" fill="url(#${id}-metal)"/><path d="m83 101 14 2 12 14-20-5Z" fill="#e4dcc0"/><path d="m52 115 9 4 9-7 6 32H48Z" fill="#bba175"/><path d="m55 123 7 3 7-5-2 13-8 5-6-6Z" fill="#6fc4bd"/><path d="m50 144 4-12m18-5 4 17" stroke="#f0d39a" stroke-width="1.5"/>`,
    ilda: `<path d="M18 144q-14-41 8-69L36 24q9-16 28-14 38-2 37 45l-13 59 15 30Z" fill="#1c3b4e"/><path d="m11 144 6-35 22-18 36-2 30 19 15 36Z" fill="#356771"/><path d="m45 77 26 1 2 24-14 14-17-16Z" fill="url(#${id}-skin)"/><path d="m24 102 20-13 15 23 18-23 19 12-21 43H33Z" fill="url(#${id}-cloth)"/><path d="m42 92 17 20 18-22-10 41-9 11-9-11Z" fill="#294c60"/><path d="m35 35 37-10 17 18-7 30-18 19-22-7-13-20Z" fill="url(#${id}-skin)"/><path d="m32 47-9-8 1 20 11 9m48-22 13-11-4 25-12 11" fill="url(#${id}-skin)"/><path d="m24 48 7 9m57-8-4 11" stroke="#b97973" stroke-width="1.2"/><path d="M27 49q-4-38 33-39 31 0 34 28l-8 20-4-21-19-14-14 18-15-1-1 18Z" fill="#243e54"/><path d="m29 30 13-14 21-1-14 10-10 16Z" fill="#4c6977"/><path d="m64 17 18 14 9 17-4-17-12-14Z" fill="#567582"/><path d="m30 64-9 20 8 27 12 18-6-38 5-16m42-10 10 24-12 35-2-38Z" fill="#284b5e"/><path d="m25 90 8 20-1 11-6-7m59-19-4 21" stroke="#7ca7a2" stroke-width="2"/><path d="m42 48 10-3m13 1 10 3" stroke="#42505b" stroke-width="2.8" stroke-linecap="round"/><path d="m43 53 7-1m17 1 6 1" stroke="#34434b" stroke-width="2.5" stroke-linecap="round"/><circle cx="48" cy="52" r="1.1" fill="#b6e5ba"/><circle cx="69" cy="53" r="1.1" fill="#b6e5ba"/><path d="m58 53-3 11 5 1" stroke="#bf8173" stroke-width="1.5" stroke-linecap="round"/><path d="m51 73q8 4 15-2" stroke="#a66468" stroke-width="1.8" stroke-linecap="round"/><path d="m42 62 2 1m4-1 2 1m20 1 2 1m4-1 2 1" stroke="#b67c70" stroke-width="1.5" stroke-linecap="round"/><path d="m32 31 20-9 29 7" stroke="url(#${id}-gold)" stroke-width="3"/><path d="m73 25 10-16 4-2-1 15-9 11Z" fill="url(#${id}-gold)"/><path d="m79 25 12-8 7 1-11 11-9 3Z" fill="#ccdaa7"/><path d="m20 105 13-5 13 31-15 13H17Z" fill="#c4c6a2"/><path d="m86 101 10 4 15 34-20 5-13-18Z" fill="#a3b8a1"/><path d="m25 111 17 17m43-17 13 24" stroke="#e1dfaf" stroke-width="1.6"/><path d="m33 144 62-66" stroke="#e5cc91" stroke-width="3"/><path d="m91 85 7-15 1 16-4-1m-66 51 9-1-1 9" fill="#e8d7b5"/><path d="M104 82q25 34 0 59" stroke="url(#${id}-gold)" stroke-width="4" stroke-linecap="round"/><path d="m104 82 0 59" stroke="#e7e0bd" stroke-width=".8"/><circle cx="59" cy="118" r="4.8" fill="url(#${id}-gold)"/>`,
    neris: `<path d="M22 91 18 45q0-39 36-40 44-6 49 40l-8 60Z" fill="#ddd9ed"/><path d="m14 144 3-34q17-25 43-23 34-1 46 27l6 30Z" fill="#5e5785"/><path d="m45 78 28-1 2 23-17 16-15-17Z" fill="url(#${id}-skin)"/><path d="m27 102 18-12 13 22 17-23 20 14-7 41H28Z" fill="#45456c"/><path d="m40 97 18 16 18-17-6 48H46Z" fill="url(#${id}-cloth)"/><path d="m30 39 20-20 28 6 14 22-9 28-18 17-22-7-13-20Z" fill="url(#${id}-skin)"/><path d="m29 51-6-4 2 15 8 7m54-18 7-5-2 15-6 9" fill="url(#${id}-skin)"/><path d="m22 47-2-19L37 9l31-7 22 12 11 27-9 19-8-25-14-13-16 14-17 5-9 23Z" fill="#d9dcec"/><path d="m24 36 13-22 29-8 15 7-27 10-13 10Z" fill="#fff3e8"/><path d="m74 13 18 16 7 21-6 16-9-31Z" fill="#9caac8"/><path d="m26 55-7 34 11 14 8-8-7-26m56-7 9 31-11 13-10-8 9-24" fill="#b8c4d9"/><path d="m22 83 9 9 3-3m49 1 6-6" stroke="#edf0ed" stroke-width="2"/><path d="m39 49 11-3m16 1 11 3" stroke="#684e6c" stroke-width="2.8" stroke-linecap="round"/><path d="m40 54 8-1m20 1 7 1" stroke="#443d5d" stroke-width="2.5" stroke-linecap="round"/><circle cx="45" cy="53" r="1.3" fill="#b5f4e8"/><circle cx="71" cy="54" r="1.3" fill="#b5f4e8"/><path d="m57 53-4 11 6 1" stroke="#965b77" stroke-width="1.5" stroke-linecap="round"/><path d="m49 74 10 2 8-3" stroke="#784d6e" stroke-width="1.7" stroke-linecap="round"/><path d="m44 63 3 4m24-3-3 4" stroke="#e4b2c5" stroke-width="1.2" stroke-linecap="round"/><path d="m50 36 10-6 10 5-9 6Z" fill="url(#${id}-gold)"/>${diamond(60,35,4,'#aef2da')}<circle cx="29" cy="69" r="6" stroke="url(#${id}-gold)" stroke-width="2"/><circle cx="88" cy="69" r="6" stroke="url(#${id}-gold)" stroke-width="2"/><path d="m24 102 15-8 19 18-14 11-16-10m46-19-16 18 15 11 17-15" fill="#c0b5cb"/><path d="m25 106 17 12 16-6 16 7 14-13" stroke="#f0d7a7" stroke-width="2"/><path d="m58 114 7 8-7 12-7-12Z" fill="url(#${id}-gold)"/>${diamond(58,122,5,'#a8e4d7')}<path d="M98 144V77m-9-2q-14-10-3-26m21 26q14-10 3-26M89 75h18" stroke="url(#${id}-gold)" stroke-width="4" stroke-linecap="round"/><path d="M98 46v29" stroke="#d8e5cf" stroke-width="1.2"/>${diamond(98,57,10,'#b3eadb')}<path d="m94 51 4 6 4-6" stroke="#effff0" stroke-width="1"/><path d="m20 130 6-14 12-1 7 15-12 8Z" fill="url(#${id}-skin)"/><path d="m27 123 7 8m-3-11 7 8" stroke="#e0a6a6" stroke-width="1.1"/>`,
  }[hero];
  return wrap(`${defs}<g clip-path="url(#${id}-clip)">${background}${artwork}<path d="M1 143V1h118" stroke="#fff5d7" stroke-opacity=".13"/></g>`, '0 0 120 144', `portrait portrait-${hero} ${cls}`);
}

const skyId='km-celestial-sky';
export const landscape = wrap(`<defs>
<linearGradient id="${skyId}-bg" x1="0" y1="0" x2=".8" y2="1"><stop stop-color="#15253f"/><stop offset=".38" stop-color="#25314d"/><stop offset=".7" stop-color="#264c59"/><stop offset="1" stop-color="#142e43"/></linearGradient>
<radialGradient id="${skyId}-nebula"><stop stop-color="#a286b0" stop-opacity=".32"/><stop offset=".5" stop-color="#786f9d" stop-opacity=".15"/><stop offset="1" stop-color="#6a759a" stop-opacity="0"/></radialGradient>
<radialGradient id="${skyId}-moon"><stop stop-color="#ffe9b4" stop-opacity=".25"/><stop offset=".25" stop-color="#e9cda0" stop-opacity=".12"/><stop offset="1" stop-color="#d1c7ba" stop-opacity="0"/></radialGradient>
<linearGradient id="${skyId}-current" x1="0" y1="0" x2="1" y2=".6"><stop stop-color="#69c7bc" stop-opacity="0"/><stop offset=".28" stop-color="#76d6ca" stop-opacity=".28"/><stop offset=".55" stop-color="#b2e6cf" stop-opacity=".45"/><stop offset=".78" stop-color="#7cc6c7" stop-opacity=".22"/><stop offset="1" stop-color="#60a1c2" stop-opacity="0"/></linearGradient>
<linearGradient id="${skyId}-island" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#536a7a"/><stop offset="1" stop-color="#24334d"/></linearGradient>
<linearGradient id="${skyId}-fall" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#b2e9d9" stop-opacity=".4"/><stop offset="1" stop-color="#b2e9d9" stop-opacity="0"/></linearGradient>
</defs>
<path d="M0 0h1200v900H0Z" fill="url(#${skyId}-bg)"/>
<ellipse cx="730" cy="330" rx="580" ry="380" fill="url(#${skyId}-nebula)"/>
<circle cx="945" cy="156" r="174" fill="url(#${skyId}-moon)"/>
<circle cx="945" cy="156" r="37" fill="#f6e4ba" opacity=".86"/><circle cx="956" cy="145" r="35" fill="#2b3550"/>
<ellipse cx="945" cy="156" rx="60" ry="19" transform="rotate(-25 945 156)" stroke="#dbcea7" stroke-opacity=".35"/>
<path d="M-140 244C208 72 546 239 784 174s374-86 528-41" stroke="#6c7c9a" stroke-width="70" opacity=".06"/>
<path d="M-20 665c203-215 382-173 594-169s442-168 666-175" stroke="#83cfc2" stroke-width="127" opacity=".025"/>
<g class="sky-current"><path d="M-60 638C206 450 328 456 578 480s380-142 692-182l22 43c-273 58-433 196-719 167S213 489-42 675Z" fill="url(#${skyId}-current)"/>
<path d="M-40 649C189 464 350 468 578 494s422-153 676-174" stroke="#b7e8db" stroke-width="1.4" stroke-opacity=".3"/>
<path d="M-30 630C221 451 376 471 585 477s369-134 665-160M-10 675c227-184 398-152 590-163s386-151 658-171" stroke="#a7ded3" stroke-width=".9" stroke-opacity=".14"/>
<path d="M-50 591C184 441 350 438 567 458s428-124 671-151" stroke="#64bab7" stroke-width="11" stroke-opacity=".06"/>
</g>
<g opacity=".3"><path d="m75 253 24-13 56-5 40 10 31 17-22 12-30 4-18 48-22-28-22 14-17-35Z" fill="url(#${skyId}-island)"/><path d="m75 253 59-15 61 7 31 17-59 11-49-7Z" fill="#829c9e"/><path d="m103 244 18-20 13 1 8-34 12 3 4 38 22 13-38 9Z" fill="#8b9aa6"/><path d="m134 278 2 74h7l4-73Z" fill="url(#${skyId}-fall)"/></g>
<g opacity=".38"><path d="m984 655 43-18 67-1 48 22-28 19-27 7-23 61-23-30-21 12-16-40Z" fill="url(#${skyId}-island)"/><path d="m984 655 43-18 67-1 48 22-53 15-65-3Z" fill="#789d9b"/><path d="m1034 645 8-27 11 1 7-31 12 4 6 35 15 16-24 10Z" fill="#8dada6"/><path d="m1086 680 2 100h7l2-103Z" fill="url(#${skyId}-fall)"/></g>
<g opacity=".22"><path d="m366 142 31-10 47 4 12 11-26 15-14 22-22-22-19-6Z" fill="#738697"/><path d="m740 742 27-7 40 7 13 12-27 13-13 32-21-30-16-9Z" fill="#80a4a1"/><path d="m113 792 25-11 32 4 21 13-24 8-13 29-19-22-15 1Z" fill="#6a8c95"/></g>
<g fill="#d9dcbf" opacity=".65">${[[85,93,1.4],[182,155,1],[258,48,1.5],[347,249,1],[440,103,1.3],[589,54,1],[668,187,1.4],[768,72,1],[852,256,1.5],[1096,66,1.4],[1159,227,1],[310,676,1],[480,791,1.4],[940,796,1],[1123,430,1],[69,428,1.4],[219,364,1],[758,602,1.2],[1034,350,1]].map(([x,y,r])=>`<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>
<g opacity=".7">${diamond(299,168,4,'#f2deb5')}${diamond(720,281,3,'#a8ddce')}${diamond(1008,96,3,'#f2deb5')}${diamond(202,723,3,'#bce6d4')}${diamond(915,574,4,'#bce6d4')}</g>
<g fill="#a9d9cc" opacity=".32"><circle cx="226" cy="535" r="2"/><circle cx="412" cy="496" r="1.4"/><circle cx="687" cy="466" r="1.8"/><circle cx="875" cy="419" r="1.3"/><circle cx="952" cy="377" r="2"/><circle cx="563" cy="535" r="1"/></g>
<path d="M0 871q183-58 361-15t408-4 431-39v87H0Z" fill="#112a3d" opacity=".45"/>
`, '0 0 1200 900', 'landscape celestial-landscape', 'preserveAspectRatio="xMidYMid slice"');
