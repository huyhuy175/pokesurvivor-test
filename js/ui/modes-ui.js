/* ============ modes-ui.js — pantalla "Modes" (Normal, Wave, Boss Rush + Hardcore) ============
 * La lógica está en systems/modes*.js; aquí sólo se eligen y se arrancan (textos sólo en inglés).
 */
G.ModesUI = (() => {
  const $ = G.UI.$;
  let hc = false;                   // interruptor Hardcore; dura mientras no recargas

  const CARDS = [
    { id: 'normal', name: 'Normal', desc: 'The classic run: survive as long as you can.',
      record: (S, h) => (h ? '' : 'Best time ' + G.U.mmss(S.bestTime || 0)) },
    { id: 'wave', name: 'Wave', desc: 'Endless waves with a side objective each time, and a boss every 5.',
      record: (S, h) => 'Best wave ' + ((h ? S.bestWaveHc : S.bestWave) || 0) },
    { id: 'bossrush', name: 'Boss Rush', desc: 'Ten bosses in a row in one arena. No small fry.',
      record: (S, h) => 'Best stage ' + ((h ? S.bestStageHc : S.bestStage) || 0) + '/10 · Clears ' + ((h ? S.rushClearsHc : S.rushClears) || 0) },
  ];

  function start(id) {
    if (G.Social.room) { G.UI.toast('Start the run from the lobby'); return; }
    const mode = G.Modes.normalize({ type: id, hc });
    if (mode.type !== id) { G.UI.toast('Not available yet'); return; }     // modo aún sin registrar
    G.Flow.play(mode);
  }

  function render() {
    const S = G.DB.save.stats;
    const box = $('modes-list');
    box.innerHTML = '';
    for (const c of CARDS) {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'panel mode-card';
      el.dataset.mode = c.id;
      el.innerHTML = `<b>${c.name}</b>${hc ? ' <b class="mode-hc">HARDCORE</b>' : ''}
        <div class="sub">${c.desc}</div><div class="mode-rec">${c.record(S, hc)}</div>`;
      el.onclick = () => start(c.id);
      box.appendChild(el);
    }
    const sw = $('modes-hc');
    sw.classList.toggle('on', hc);
    sw.setAttribute('aria-pressed', hc ? 'true' : 'false');
  }

  function open() {
    $('modes-hc').onclick = () => { hc = !hc; render(); };
    G.UI.show('scr-modes', true);
    render();
  }

  function close() { G.UI.hide('scr-modes'); }

  return { open, close };
})();
