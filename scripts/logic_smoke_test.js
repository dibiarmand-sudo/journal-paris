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
  'f-type': el(),
  'f-cote': el(),
  'flag-structure': el(),
  'f-raison-cat': el(),
  'err-type': el(),
  'err-raison': el(),
  'f-raison-note': el(),
  'entries-list': el(),
  'stats-panel': el(),
  'offline-note': el(),
};

global.document = {
  getElementById: (id) => elements[id],
  addEventListener() {},
};
global.window = { addEventListener() {} };
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
// Test 1: both selects empty -> blocked
elements['f-date'].value = '2026-08-28';
elements['f-match'].value = 'PSG - Marseille';
elements['f-cote'].value = '2.0';
elements['f-type'].value = '';
elements['f-raison-cat'].value = '';
addBet();
check('blocked when type+raison empty: bets.length', bets.length, 0);
check('err-type shown', elements['err-type']._classes.has('show'), true);
check('err-raison shown', elements['err-raison']._classes.has('show'), true);

// Test 2: only type filled -> still blocked
elements['f-type'].value = 'simple-favori';
elements['f-raison-cat'].value = '';
addBet();
check('blocked when only type filled: bets.length', bets.length, 0);
check('err-raison still shown', elements['err-raison']._classes.has('show'), true);

// Test 3: both filled -> succeeds
elements['f-raison-cat'].value = 'forme-equipe';
addBet();
check('accepted when both filled: bets.length', bets.length, 1);
check('persisted to localStorage', JSON.parse(localStorage.getItem('paris_journal_v1')).length, 1);
check('type reset to placeholder index', elements['f-type'].selectedIndex, 0);
check('raison reset to placeholder index', elements['f-raison-cat'].selectedIndex, 0);
`;

eval(scriptSrc + '\n' + testSrc);

console.log(global.__failures === 0 ? '\nALL TESTS PASSED' : `\n${global.__failures} TEST(S) FAILED`);
process.exit(global.__failures === 0 ? 0 : 1);
