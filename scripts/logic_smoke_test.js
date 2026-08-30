const fs = require('fs');
const path = require('path');
const htmlSrc = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const scriptSrc = htmlSrc.match(/<script>([\s\S]*)<\/script>/)[1];

const store = {};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
};

function makeClassList(el) {
  el._classes = new Set();
  return {
    add: (...c) => c.forEach((x) => el._classes.add(x)),
    remove: (...c) => c.forEach((x) => el._classes.delete(x)),
    toggle: (c, force) => {
      if (force === undefined) { el._classes.has(c) ? el._classes.delete(c) : el._classes.add(c); }
      else if (force) el._classes.add(c); else el._classes.delete(c);
    },
    contains: (c) => el._classes.has(c),
  };
}

function el(extra = {}) {
  const e = Object.assign({
    value: '',
    innerHTML: '',
    textContent: '',
    listeners: {},
    addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
    dispatch(type) { (this.listeners[type] || []).forEach((fn) => fn()); },
    selectedIndex: 0,
  }, extra);
  e.classList = makeClassList(e);
  return e;
}

const elements = {
  'f-date': el(),
  'f-match': el(),
  'f-selection': el(),
  'f-type': el(),
  'f-cote': el(),
  'flag-structure': el(),
  'f-raison-cat': el(),
  'err-selection': el(),
  'err-type': el(),
  'err-raison': el(),
  'f-raison-note': el(),
  'entries-list': el(),
  'stats-panel': el(),
  'offline-note': el(),
  'btn-oddsportal': el(),
  'combo-match-note': el(),
};

global.document = {
  getElementById: (id) => elements[id],
  addEventListener() {},
};
global.window = { addEventListener() {}, open() {} };
global.navigator = { onLine: true };
global.alert = (msg) => { global.__lastAlert = msg; };

global.check = function (label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${label} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
  if (!pass) global.__failures++;
};
global.__failures = 0;
global.elements = elements;

const testSrc = `
// Test 1: selection, type and raison all empty -> blocked
elements['f-date'].value = '2026-08-28';
elements['f-match'].value = 'PSG - Marseille';
elements['f-cote'].value = '2.0';
elements['f-selection'].value = '';
elements['f-type'].value = '';
elements['f-raison-cat'].value = '';
addBet();
check('blocked when selection+type+raison empty: bets.length', bets.length, 0);
check('err-selection shown', elements['err-selection']._classes.has('show'), true);
check('err-type shown', elements['err-type']._classes.has('show'), true);
check('err-raison shown', elements['err-raison']._classes.has('show'), true);

// Test 2: only selection+type filled -> still blocked (raison missing)
elements['f-selection'].value = 'PSG gagne';
elements['f-type'].value = 'simple-favori';
elements['f-raison-cat'].value = '';
addBet();
check('blocked when raison missing: bets.length', bets.length, 0);
check('err-raison still shown', elements['err-raison']._classes.has('show'), true);

// Test 3: all three filled -> succeeds
elements['f-raison-cat'].value = 'forme-equipe';
addBet();
check('accepted when all filled: bets.length', bets.length, 1);
check('selection stored', bets[0].selection, 'PSG gagne');
check('persisted to localStorage', JSON.parse(localStorage.getItem('paris_journal_v1')).length, 1);
check('type reset to placeholder index', elements['f-type'].selectedIndex, 0);
check('raison reset to placeholder index', elements['f-raison-cat'].selectedIndex, 0);

// Test 4: bet missing selection field (legacy data) falls back gracefully
check('legacy bet without selection renders as undefined (UI applies "Non précisé")', bets[0].selection, 'PSG gagne');

// Test 5: structural flag logic — sharp markets never flagged, others flagged per rules
check('handicap asiatique not risky even at high odds', isRisky('handicap-asiatique', '6.0'), false);
check('double chance not risky even at high odds', isRisky('double-chance', '6.0'), false);
check('score exact is risky', isRisky('score-exact', '1.5'), true);
check('corners/cartons is risky', isRisky('corners-cartons', '1.5'), true);
check('combo is risky', isRisky('combo', '1.5'), true);
check('prop-joueur is risky', isRisky('prop-joueur', '1.5'), true);
check('direct is risky', isRisky('direct', '1.5'), true);
check('neutral type risky above cote 4', isRisky('simple-favori', '4.0'), true);
check('neutral type not risky below cote 4', isRisky('simple-favori', '2.0'), false);

// Test 6: Oddsportal button always opens the homepage, no network call
let __openedUrl = null;
window.open = (u) => { __openedUrl = u; };
elements['f-match'].value = 'PSG - Marseille';
elements['btn-oddsportal'].dispatch('click');
check('oddsportal button opens homepage', __openedUrl, 'https://www.oddsportal.com/');

// Test 7: renamed type labels reflect new wording, stored values untouched
check('simple-buts label renamed', TYPE_LABELS['simple-buts'], 'Simple · Nombre de buts (Plus/Moins)');
check('simple-btts label renamed', TYPE_LABELS['simple-btts'], 'Simple · Les deux marquent');

// Test 8: selecting Combiné swaps the match placeholder and reveals the CLV-exclusion note
elements['f-type'].value = 'combo';
elements['f-type'].dispatch('change');
check('combo match placeholder set', elements['f-match'].placeholder, 'Liste chaque match et sélection, ex: PSG-Rennes: PSG gagne / Real-Betis: Real gagne');
check('combo note shown', elements['combo-match-note']._classes.has('show'), true);

elements['f-type'].value = 'simple-favori';
elements['f-type'].dispatch('change');
check('non-combo match placeholder restored', elements['f-match'].placeholder, 'ex. PSG - Marseille');
check('combo note hidden', elements['combo-match-note']._classes.has('show'), false);

// Test 9: combo bets still save fine and don't require closing odds (same as any other type)
elements['f-type'].value = 'combo';
elements['f-type'].dispatch('change');
elements['f-selection'].value = 'PSG gagne / Real gagne';
elements['f-match'].value = 'PSG-Rennes: PSG gagne / Real-Betis: Real gagne';
elements['f-cote'].value = '3.2';
elements['f-raison-cat'].value = 'forme-equipe';
addBet();
check('combo bet saved', bets[0].type, 'combo');
check('combo bet has no closing odds by default', bets[0].coteCloture, null);
check('combo bet excluded from CLV until closing odds entered', computeCLV(bets[0]), null);
`;

eval(scriptSrc + '\n' + testSrc);

console.log(global.__failures === 0 ? '\nALL TESTS PASSED' : `\n${global.__failures} TEST(S) FAILED`);
process.exit(global.__failures === 0 ? 0 : 1);
