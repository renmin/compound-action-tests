// common.js: shared logic for test pages


class TestManager {
  constructor({ testName, runId, startedAt }) {
    this.state = {
      testName: testName || 'Unnamed Test',
      runId: runId || (Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)).toUpperCase(),
      startedAt: startedAt || new Date().toISOString(),
      cases: [],
      logs: [],
      meta: {}
    };
    this.$meta = document.getElementById('meta');
    this.$big = document.getElementById('bigResult');
    this.$cases = document.getElementById('cases');
    this.$log = document.getElementById('log');
    this.$qrOverlay = document.getElementById('qrOverlay');
    this.$qrBox = document.getElementById('qrBox');
    this.$qrClose = document.getElementById('qrClose');
    this.__qrTextCache = null;
    this.setMeta('name', this.state.testName);
    this.setMeta('runId', this.state.runId);
    this.setMeta('startedAt', this.state.startedAt);
  }

  log(m) {
    const line = `[${new Date().toISOString()}] ${m}`;
    this.state.logs.push(line);
    if (this.$log) {
      this.$log.textContent += line + '\n';
      this.$log.scrollTop = this.$log.scrollHeight;
    }
  }

  setMeta(k, v) {
    this.state.meta[k] = v;
    if (this.$meta) {
      const el = this.$meta.querySelector(`[data-k="${k}"]`);
      if (el) el.textContent = String(v);
    }
  }

  deepEqual(a, b) {
    try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
  }

  escapeHtml(s) {
    return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m]));
  }

  getQRSize() {
    const margin = 120;
    const maxSide = Math.min(window.innerWidth, window.innerHeight) - margin;
    return Math.max(320, Math.min(1600, Math.floor(maxSide)));
  }

  renderQRInto(text) {
    if (!this.$qrBox) return;
    this.$qrBox.innerHTML = '';
    const size = this.getQRSize();
    new QRCode(this.$qrBox, { text, width: size, height: size, correctLevel: QRCode.CorrectLevel.H });
  }

  onQRResize() {
    const visible = this.$qrOverlay && this.$qrOverlay.classList.contains('show');
    if (visible && this.__qrTextCache) {
      this.renderQRInto(this.__qrTextCache);
    }
  }

  renderCases() {
    if (!this.$cases) return;
    this.$cases.innerHTML = '';
    for (const c of this.state.cases) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<div><span class="name">${c.name}</span><div class="exp">exp: ${this.escapeHtml(JSON.stringify(c.expected))}</div></div><div class="badge ${c.pass ? 'ok' : 'fail'}">${c.pass ? 'PASS' : 'FAIL'}</div>`;
      this.$cases.appendChild(row);
    }
  }

  registerAssertion(name, expected, fn) {
    this.state.cases.push({ name, expected, fn, pass: null, actual: null, error: null });
  }

  async runAssertions() {
    this.log(`Window size=${window.innerWidth}x${window.innerHeight} (recommended 1280x960)`);

    let pass = 0, fail = 0;
    for (const c of this.state.cases) {
      try {
        const actual = await c.fn();
        c.actual = actual;
        c.pass = this.deepEqual(actual, c.expected);
        c.error = null;
      } catch (err) {
        c.pass = false;
        c.error = String(err);
      }
      c.pass ? pass++ : fail++;
    }
    this.setMeta('actions', this.state.cases.length);
    this.setMeta('pass', pass);
    this.setMeta('fail', fail);
    if (this.$big) {
      this.$big.className = 'big-result ' + (fail === 0 ? 'ok' : 'fail');
      this.$big.textContent = fail === 0 ? 'PASS' : 'FAIL';
    }
    this.renderCases();
    this.buildQR(fail === 0);
  }

  buildQR(allPass) {
    const payload = {
      type: 'remote-browser-test',
      version: 1,
      test: this.state.testName,
      runId: this.state.runId,
      startedAt: this.state.startedAt,
      endedAt: new Date().toISOString(),
      pass: allPass,
      summary: this.state.cases.map(c => ({ name: c.name, pass: c.pass, expected: c.expected, actual: c.actual, error: c.error })),
      log: this.state.logs.slice(-80)
    };
    const text = JSON.stringify(payload);
    this.__qrTextCache = text;
    this.renderQRInto(text);
    if (this.$qrOverlay) {
      this.$qrOverlay.classList.add('show');
      this.$qrOverlay.setAttribute('aria-hidden', 'false');
    }
    if (this.$qrClose) {
      this.$qrClose.onclick = () => {
        this.$qrOverlay.classList.remove('show');
        this.$qrOverlay.setAttribute('aria-hidden', 'true');
      };
    }
    this.log('QR encoded length=' + text.length);
  }
}

window.__TestCommon = TestManager;
