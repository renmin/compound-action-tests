// common.js: shared logic for test pages


class TestManager {
  constructor({ testName, runId, startedAt, usingQRCode } = {}) {
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
    this.__qrTextCache = null;
    // whether to render a scannable QR code (true) or a colored pass/fail box (false)
    // precedence: explicit constructor value > ?qrcode=0|1 URL param > default false
    if (typeof usingQRCode === 'undefined') {
      try {
        const qs = new URLSearchParams(location.search);
        const q = qs.get('qrcode');
        if (q === '0') this.usingQRCode = false;
        else if (q === '1') this.usingQRCode = true;
        else this.usingQRCode = false;
      } catch (err) {
        this.usingQRCode = false;
      }
    } else {
      this.usingQRCode = !!usingQRCode;
    }
    this.setMeta('name', this.state.testName);
    this.setMeta('runId', this.state.runId);
    this.setMeta('startedAt', this.state.startedAt);

    // 自动绑定 resize 和 btn-verify 事件
    window.addEventListener('resize', () => this.onQRResize());
    const btn = document.getElementById('btn-verify');
    if (btn) {
      btn.addEventListener('click', () => this.runAssertions());
    }
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
    // render an actual QR code into the box
    this.$qrBox.innerHTML = '';
    const size = this.getQRSize();
    new QRCode(this.$qrBox, { text, width: size, height: size, correctLevel: QRCode.CorrectLevel.H });
  }

  renderResultBox(allPass) {
    if (!this.$qrBox) return;
    this.$qrBox.innerHTML = '';
    const size = this.getQRSize();
    const box = document.createElement('div');
    box.style.width = size + 'px';
    box.style.height = size + 'px';
    box.style.background = allPass ? '#2ecc71' : '#e74c3c';
    box.style.display = 'flex';
    box.style.alignItems = 'center';
    box.style.justifyContent = 'center';
    box.style.color = '#ffffff';
    box.style.fontSize = Math.max(20, Math.floor(size / 12)) + 'px';
    box.style.fontFamily = 'sans-serif';
    box.style.borderRadius = '6px';
    box.textContent = allPass ? 'PASS' : 'FAIL';
    this.$qrBox.appendChild(box);
  }

  onQRResize() {
    const visible = this.$qrOverlay && this.$qrOverlay.classList.contains('show');
    if (visible && this.__qrTextCache) {
      if (this.usingQRCode) {
        this.renderQRInto(this.__qrTextCache);
      } else if (typeof this.__lastPass === 'boolean') {
        this.renderResultBox(this.__lastPass);
      }
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
    this.__lastPass = !!allPass;
    if (this.usingQRCode) {
      this.renderQRInto(text);
    } else {
      this.renderResultBox(allPass);
    }
    // 同步复制二维码文本到剪贴板
    this.copyToClipboard(text);
    if (this.$qrOverlay && this.usingQRCode) {
      // show overlay
      this.$qrOverlay.classList.add('show');
      this.$qrOverlay.setAttribute('aria-hidden', 'false');
      // clicking overlay anywhere closes it
      this.$qrOverlay.onclick = () => {
        this.$qrOverlay.classList.remove('show');
        this.$qrOverlay.setAttribute('aria-hidden', 'true');
      };
    }
    this.log('QR encoded length=' + text.length);
  }
}

window.__TestCommon = TestManager;

// 追加：为 TestManager 原型添加复制功能（放在类定义后，避免影响上方可读性）
TestManager.prototype.copyToClipboard = function(text) {
  if (!text) return;
  // 优先使用异步 Clipboard API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      this.log('QR text copied to clipboard (navigator.clipboard).');
    }).catch(err => {
      this.log('navigator.clipboard failed: ' + err + ' – fallback to execCommand');
      this.__legacyCopy(text);
    });
  } else {
    this.__legacyCopy(text);
  }
};

TestManager.prototype.__legacyCopy = function(text) {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.left = '-1000px';
    ta.setAttribute('readonly', '');
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    this.log(ok ? 'QR text copied to clipboard (execCommand).' : 'Copy to clipboard (execCommand) failed.');
  } catch (e) {
    this.log('Clipboard fallback error: ' + e);
  }
};
