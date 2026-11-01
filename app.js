// ── GitHub Config ──────────────────────────────────────────────────────────
// CHANGE THIS to "<your-github-username>/<your-repo-name>" of the repo that will hold data.json
const GH_REPO  = 'gouravbhati152/practice';
const GH_FILE  = 'data.json';
const GH_API   = `https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`;

// Token lives only in this browser (localStorage). If the browser blocks storage,
// it is kept in memory for the current tab so the app still works.
let memoryToken = '';

function getToken() {
  if (memoryToken) return memoryToken;
  try { return localStorage.getItem('gh_token') || ''; } catch (e) { return ''; }
}
function storeToken(token) {
  memoryToken = token;
  try {
    localStorage.setItem('gh_token', token);
    if (localStorage.getItem('gh_token') === token) { memoryToken = ''; return true; }
  } catch (e) {}
  return false; // storage blocked → token only kept for this tab
}
function getHeaders() {
  return {
    'Authorization': `token ${getToken()}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github+json'
  };
}

// Pasted tokens often carry spaces, newlines or quotes — clean them up.
function cleanToken(raw) {
  return (raw || '').replace(/^\s*(token|bearer)\s+/i, '').replace(/["'\s]/g, '');
}

// Checks that a token works for this repo and can write to it.
async function checkAccess(token) {
  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${GH_REPO}`, {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github+json' }
    });
  } catch (e) {
    return { ok: false, message: "Can't reach GitHub. Check your internet connection and try again." };
  }
  if (res.status === 401) return { ok: false, message: 'GitHub rejected this token. It may be mistyped, expired or deleted — create a new one.' };
  if (res.status === 404) return { ok: false, message: `Repo "${GH_REPO}" was not found, or this token can't see it. Check GH_REPO at the top of app.js, and make sure the token has the "repo" scope.` };
  if (!res.ok)            return { ok: false, message: `GitHub returned an error (${res.status}). Try again in a moment.` };
  const info = await res.json().catch(() => ({}));
  if (info.permissions && info.permissions.push === false) {
    return { ok: false, message: 'This token can read the repo but not write to it. Create a token with the "repo" scope.' };
  }
  return { ok: true };
}

// ── In-page dialog (browser prompt() boxes are often blocked) ──────────────
function openDialog({ title, desc, label, placeholder, secret, okText, onSubmit }) {
  const backdrop = document.getElementById('dialog-backdrop');
  const input    = document.getElementById('dialog-input');
  const errEl    = document.getElementById('dialog-error');
  const okBtn    = document.getElementById('dialog-ok');
  const cancel   = document.getElementById('dialog-cancel');
  const showBtn  = document.getElementById('dialog-show');

  document.getElementById('dialog-title').textContent = title;
  document.getElementById('dialog-desc').innerHTML    = desc || '';
  document.getElementById('dialog-label').textContent = label;
  input.placeholder = placeholder || '';
  input.type  = secret ? 'password' : 'text';
  input.value = '';
  errEl.textContent = '';
  okBtn.textContent = okText || 'Save';
  okBtn.disabled = false;
  showBtn.style.display = secret ? 'inline-block' : 'none';
  showBtn.textContent = 'Show';
  backdrop.classList.remove('hidden');
  setTimeout(() => input.focus(), 30);

  function close() {
    backdrop.classList.add('hidden');
    okBtn.onclick = cancel.onclick = showBtn.onclick = input.onkeydown = backdrop.onmousedown = null;
  }
  async function submit() {
    errEl.textContent = '';
    okBtn.disabled = true;
    const original = okBtn.textContent;
    okBtn.textContent = 'Checking…';
    let error = null;
    try { error = await onSubmit(input.value); }
    catch (e) { error = e.message || 'Something went wrong.'; }
    okBtn.textContent = original;
    okBtn.disabled = false;
    if (error) errEl.textContent = error; else close();
  }
  okBtn.onclick  = submit;
  cancel.onclick = close;
  showBtn.onclick = () => {
    const hidden = input.type === 'password';
    input.type = hidden ? 'text' : 'password';
    showBtn.textContent = hidden ? 'Hide' : 'Show';
  };
  input.onkeydown = e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') close(); };
  backdrop.onmousedown = e => { if (e.target === backdrop) close(); };
}

function updateToken() {
  openDialog({
    title: 'Update GitHub token',
    desc: 'Paste a Personal Access Token with the <b>repo</b> scope.<br>GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic).',
    label: 'Token',
    placeholder: 'ghp_… or github_pat_…',
    secret: true,
    okText: 'Save token',
    onSubmit: async (raw) => {
      const token = cleanToken(raw);
      if (!token) return 'Paste your token first.';
      const result = await checkAccess(token);
      if (!result.ok) return result.message;   // dialog stays open, token NOT saved
      const persisted = storeToken(token);
      showToast(persisted ? 'Token saved. Reconnecting…' : 'Token accepted for this tab only (browser blocks storage).');
      setStatus('loading', 'Reconnecting…');
      await loadData();
      renderSidebar(); renderHeader(); renderList();
      return null;
    }
  });
}

// ── Seed data (your existing Q&As) ────────────────────────────────────────
const SEED_SESSIONS = [
  { id: 'sess-python',  name: 'Python Questions' },
  { id: 'sess-pyspark', name: 'PySpark Questions' },
  { id: 'sess-sql',     name: 'SQL Questions' }
];

const SEED_QAS = [
  {"id":"qa-1775037797769","sessionId":"sess-sql","question":"What is a transaction?","answer":"A transaction is a single logical unit of work that consists of one or more SQL statements, which must either fully succeed or fully fail. Transactions ensure data integrity in the database.\n\nThe classic example is a `bank transfer`. If you move $100 from Savings to Checking:\n\nSubtract $100 from Savings.\nAdd $100 to Checking.\n\n## The ACID Properties\n**Atomicity:** All or nothing. If one step fails, everything rolls back.\n**Consistency:** Database goes from one valid state to another.\n**Isolation:** Transactions don't interfere with each other.\n**Durability:** Once committed, data is permanent even if server crashes.\n`ACID → Always Commit In Database`\n\n## Transaction Commands"},
  {"id":"qa-1775036990253","sessionId":"sess-sql","question":"When should you NOT use indexes?","answer":"1. Small Tables\n2. Tables with Frequent Writes\n3. Columns with Low Selectivity\n4. Temporary or Staging Tables\n5. Columns Frequently Updated"},
  {"id":"qa-1775036841517","sessionId":"sess-sql","question":"Types of indexes (clustered vs non-clustered)","answer":"## Clustered Index\nA Clustered Index defines the **physical order** of rows in a table. The data rows are rearranged to match the index order. A table can have **only one** clustered index.\n\n`Query:`\n```\nCREATE CLUSTERED INDEX IX_Student_RollNo\nON Student (Roll_No ASC);\n```\n\n## Non-Clustered Index\nDoes not change physical data order. Creates a **separate structure** with indexed columns and pointers to actual rows. A table can have **multiple** non-clustered indexes.\n\n```\nCREATE NONCLUSTERED INDEX NIX_FTE_Name\nON Student (Name ASC);\n```\n\n## Key Differences\n| Feature | Clustered | Non-Clustered |\n| --- | --- | --- |\n| Physical order | Yes | No |\n| Per table | Only 1 | Multiple allowed |\n| Speed | Faster for range | Faster for lookups |\n| Storage | In table | Separate structure |"},
  {"id":"qa-1775035263633","sessionId":"sess-sql","question":"What is an index?","answer":"An **index** is a database object that improves the speed of data retrieval from a table.\nIt works like a table of contents in a book — the database can quickly locate rows without scanning the entire table.\n\n## Types of Indexes\n`1. Single-Column Index`\n```\nCREATE INDEX idx_employee_name\nON employees(name);\n```\n`2. Composite (Multi-Column) Index`\n```\nCREATE INDEX idx_employee_dept_salary\nON employees(department, salary);\n```\n`3. Unique Index`\n```\nCREATE UNIQUE INDEX idx_unique_email\nON employees(email);\n```"},
  {"id":"qa-1775028285550","sessionId":"sess-sql","question":"Difference Between ROW_NUMBER(), RANK(), and DENSE_RANK()","answer":"All three are window functions for ranking rows, but behave differently when ties occur.\n\n## Comparison\n| Function | Ties | Skips ranks? | Example |\n| --- | --- | --- | --- |\n| ROW_NUMBER() | No ties, always unique | N/A | 1, 2, 3, 4 |\n| RANK() | Same rank for ties | Yes | 1, 1, 3, 4 |\n| DENSE_RANK() | Same rank for ties | No | 1, 1, 2, 3 |\n\n## ROW_NUMBER()\nAssigns a unique sequential number — even if two rows have the same value.\n\n## RANK()\nTies get the same rank, then ranks are **skipped**.\n`Example: 1, 1, 3` (rank 2 is skipped)\n\n## DENSE_RANK()\nTies get the same rank, ranks are **not skipped**.\n`Example: 1, 1, 2` (continues sequentially)"},
  {"id":"qa-1775027926958","sessionId":"sess-sql","question":"What are window functions?","answer":"A window function performs a calculation across a set of rows related to the current row **without collapsing them** into a single output row.\n\nUnlike aggregate functions, window functions do not group the rows — they look over a \"window\" of rows.\n\n## Syntax\n```\nSELECT column1, column2,\n       window_function() OVER (\n           [PARTITION BY column]\n           [ORDER BY column]\n       ) AS alias\nFROM table_name;\n```\n\n## Key Points\n**PARTITION BY** — groups rows within the window\n**ORDER BY** — defines order inside the window"},
  {"id":"qa-1775027768237","sessionId":"sess-sql","question":"What is a CTE (Common Table Expression)?","answer":"A CTE is a temporary named result set you can reference within a SELECT, INSERT, UPDATE, or DELETE query. Defined using the `WITH` keyword — exists only for the duration of the query.\n\n```\nWITH cte_name AS (\n    SELECT column1, column2\n    FROM table_name\n    WHERE condition\n)\nSELECT *\nFROM cte_name\nWHERE some_condition;\n```"},
  {"id":"qa-1775027411200","sessionId":"sess-sql","question":"What is GROUP BY?","answer":"GROUP BY groups rows that have the same values in specified columns. Used with aggregate functions like `COUNT()`, `SUM()`, `AVG()`, `MAX()`, `MIN()`.\n\n```\nSELECT department, COUNT(*) AS employee_count\nFROM employees\nGROUP BY department;\n```\n\n## Key Points\nGroups rows based on column values\nUsed with aggregate functions\nDoes not sort the result unless combined with ORDER BY"},
  {"id":"qa-1775026529658","sessionId":"sess-sql","question":"What is normalization and denormalization?","answer":"**Normalization** organizes data to reduce redundancy by dividing large tables into smaller related tables.\n\n## Normal Forms\n| Form | Rule |\n| --- | --- |\n| 1NF | No repeating groups; atomic values |\n| 2NF | 1NF + full dependency on primary key |\n| 3NF | 2NF + no transitive dependency |\n| BCNF | 3NF + stricter candidate key rules |\n\n## Before → After Normalization\n```\nBefore: Customer(ID, Name, OrderID, OrderDate, Product)\nAfter:  Customer(ID, Name)\n        Orders(OrderID, CustomerID, OrderDate)\n```\n\n**Denormalization** combines tables to improve read performance, even if it introduces redundancy.\n\n**OLTP databases** → normalized\n**OLAP / reporting databases** → often denormalized"},
  {"id":"qa-1775026313312","sessionId":"sess-sql","question":"What are keys in SQL and different types of keys?","answer":"A **key** uniquely identifies a row in a table and helps establish relationships between tables.\n\n## Types of Keys\n| Key | Description |\n| --- | --- |\n| Primary Key | Unique + Not Null. Only one per table |\n| Foreign Key | Links to Primary Key of another table |\n| Unique Key | Unique values, allows one NULL |\n| Candidate Key | Any column that could be a primary key |\n| Composite Key | Two or more columns combined as a key |\n| Super Key | Any set of columns that uniquely identifies a row |\n| Alternate Key | Candidate keys not chosen as the primary key |\n\n## Primary Key Example\n```\nCREATE TABLE employees (\n    emp_id INT PRIMARY KEY,\n    name VARCHAR(50)\n);\n```\n## Foreign Key Example\n```\nCREATE TABLE orders (\n    order_id INT PRIMARY KEY,\n    customer_id INT,\n    FOREIGN KEY (customer_id) REFERENCES customers(id)\n);\n```"},
  {"id":"qa-1775024751991","sessionId":"sess-sql","question":"Explain different types of joins","answer":"Joins combine data from two or more tables based on a related column.\n\n## Types of Joins\n| Join Type | Returns |\n| --- | --- |\n| INNER JOIN | Only matching rows from both tables |\n| LEFT JOIN | All left rows + matching right rows |\n| RIGHT JOIN | All right rows + matching left rows |\n| FULL JOIN | All rows from both tables |\n| CROSS JOIN | Cartesian product of both tables |\n| SELF JOIN | Table joined with itself |\n\n## Examples\n```\n-- INNER JOIN\nSELECT * FROM orders\nINNER JOIN customers ON orders.customer_id = customers.id;\n\n-- LEFT JOIN\nSELECT * FROM customers\nLEFT JOIN orders ON customers.id = orders.customer_id;\n\n-- SELF JOIN\nSELECT A.name, B.name AS manager\nFROM employees A\nJOIN employees B ON A.manager_id = B.id;\n```"},
  {"id":"q1","sessionId":"sess-python","question":"What is a Python decorator?","answer":"## Definition\nA **decorator** is a function that wraps another function to extend its behaviour without modifying it directly.\n\n## Example\n```\ndef my_decorator(func):\n    def wrapper():\n        print(\"Before\")\n        func()\n        print(\"After\")\n    return wrapper\n\n@my_decorator\ndef say_hello():\n    print(\"Hello!\")\n```\nCalling `say_hello()` prints: Before → Hello! → After"},
  {"id":"q3","sessionId":"sess-sql","question":"What is the difference between WHERE and HAVING?","answer":"## Comparison\n| Clause | When it filters | Works with aggregates? |\n| --- | --- | --- |\n| WHERE | Before aggregation | No |\n| HAVING | After aggregation | Yes |\n\n## Example\n```\nSELECT department, COUNT(*) as total\nFROM employees\nWHERE salary > 50000\nGROUP BY department\nHAVING COUNT(*) > 5;\n```\n**WHERE** removes rows before grouping.\n**HAVING** filters the grouped results."}
];

// ── State ──────────────────────────────────────────────────────────────────
let sessions = [];
let qas      = [];
let activeSessionId = null;
let formOpen  = false;
let editingId = null;
let ghFileSha = null;

// ── Status ─────────────────────────────────────────────────────────────────
function setStatus(state, msg) {
  const el = document.getElementById('sync-status');
  if (!el) return;
  const colors = { saving:'#e8a838', saved:'#2c5f4a', error:'#c0392b', loading:'#9e9b96' };
  const icons  = { saving:'↑', saved:'✓', error:'✕', loading:'…' };
  el.textContent = icons[state] + ' ' + msg;
  el.style.color = colors[state];
}

// ── GitHub load ────────────────────────────────────────────────────────────
async function loadData() {
  setStatus('loading', 'Connecting to GitHub…');
  if (!getToken()) {
    sessions = [...SEED_SESSIONS];
    qas      = [...SEED_QAS];
    activeSessionId = sessions[0]?.id || null;
    setStatus('error', 'No token — click Update Token');
    showToast('Add your GitHub token using "Update Token" in the sidebar.');
    return;
  }
  try {
    const res = await fetch(GH_API + '?t=' + Date.now(), { headers: getHeaders() });

    if (res.status === 404) {
      // Either data.json is missing, or the repo/token is wrong. Tell them apart.
      const access = await checkAccess(getToken());
      if (!access.ok) { const err = new Error(access.message); err.userFacing = true; throw err; }
      // Repo is fine → data.json was deleted or never created. Recreate it.
      ghFileSha = null;
      sessions = [...SEED_SESSIONS];
      qas      = [...SEED_QAS];
      await save();
      showToast('data.json was missing — recreated it.');
      activeSessionId = sessions[0]?.id || null;
      return;
    }
    if (res.status === 401) {
      const err = new Error('GitHub rejected the saved token. Click "Update Token" and paste a new one.');
      err.userFacing = true; throw err;
    }
    if (!res.ok) throw new Error('GitHub fetch failed: ' + res.status);

    const json = await res.json();
    ghFileSha = json.sha;
    const decoded = JSON.parse(decodeURIComponent(escape(atob(json.content.replace(/\n/g, '')))));

    if (!decoded.sessions || decoded.sessions.length === 0) {
      // File exists but is empty — push seed data to GitHub
      sessions = [...SEED_SESSIONS];
      qas      = [...SEED_QAS];
      await save();
    } else {
      sessions = decoded.sessions;
      qas      = decoded.qas || [];
    }
    setStatus('saved', 'Synced with GitHub');
  } catch(e) {
    console.error('GitHub load error:', e);
    // Fall back to seed data so the app still opens
    sessions = [...SEED_SESSIONS];
    qas      = [...SEED_QAS];
    if (e.userFacing) {
      setStatus('error', 'Not connected — see message');
      showToast(e.message);
    } else {
      setStatus('error', 'Offline — data not saved');
      showToast('Could not reach GitHub. Working offline.');
    }
  }
  activeSessionId = sessions[0]?.id || null;
}

// ── GitHub save ────────────────────────────────────────────────────────────
async function save() {
  setStatus('saving', 'Saving…');
  try {
    // Always fetch the latest SHA before writing to avoid 409 conflicts
    const getRes = await fetch(GH_API + '?t=' + Date.now(), { headers: getHeaders() });
    if (getRes.status === 404) {
      ghFileSha = null; // file doesn't exist yet → PUT without sha creates it
    } else if (!getRes.ok) {
      const e1 = await getRes.json().catch(() => ({}));
      throw new Error(`SHA fetch failed (${getRes.status}): ${e1.message || 'unknown'}`);
    } else {
      const getJson = await getRes.json();
      ghFileSha = getJson.sha;
    }

    const body    = { sessions, qas };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(body, null, 2))));
    const payload = { message: 'update qa data', content: encoded };
    if (ghFileSha) payload.sha = ghFileSha;
    const res = await fetch(GH_API, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(payload) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`PUT failed (${res.status}): ${err.message || 'unknown'}`);
    }
    const json = await res.json();
    ghFileSha = json.content.sha;
    setStatus('saved', 'Saved to GitHub ✓');
  } catch(e) {
    console.error('GitHub save error:', e);
    setStatus('error', 'Save failed: ' + e.message);
    showToast('Save failed — ' + e.message);
    throw e;
  }
}

// ── Sessions ───────────────────────────────────────────────────────────────
function createSession() {
  openDialog({
    title: 'New session',
    desc: 'For example: Python, PySpark, SQL, Pandas…',
    label: 'Session name',
    placeholder: 'e.g. Pandas Questions',
    secret: false,
    okText: 'Create',
    onSubmit: async (raw) => {
      const name = (raw || '').trim();
      if (!name) return 'Enter a session name.';
      if (sessions.some(s => s.name.toLowerCase() === name.toLowerCase())) return 'A session with this name already exists.';
      const sess = { id: 'sess-' + Date.now(), name };
      sessions.push(sess);
      try { await save(); }
      catch (e) { sessions.pop(); return 'Could not save to GitHub (' + e.message + '). Try "Update Token".'; }
      activeSessionId = sess.id;
      renderSidebar(); renderHeader(); renderList();
      showToast('Session created');
      return null;
    }
  });
}

function switchSession(id) {
  activeSessionId = id;
  if (formOpen) cancelForm();
  document.getElementById('search-input').value = '';
  renderSidebar(); renderHeader(); renderList();
}

function startRename(id, e) {
  e.stopPropagation();
  const item = document.getElementById('sitem-' + id);
  const nameEl = item.querySelector('.session-name');
  const actEl  = item.querySelector('.session-actions');
  const current = sessions.find(s => s.id === id)?.name || '';
  nameEl.style.display = 'none'; actEl.style.display = 'none';
  const inp = document.createElement('input');
  inp.className = 'session-rename-input'; inp.value = current;
  item.insertBefore(inp, actEl); inp.focus(); inp.select();

  async function commit() {
    const val = inp.value.trim();
    inp.remove(); nameEl.style.display = ''; actEl.style.display = '';
    if (val && val !== current) {
      const s = sessions.find(x => x.id === id);
      if (s) { s.name = val; try { await save(); showToast('Renamed'); } catch(e) { s.name = current; } }
    }
    renderSidebar();
    if (id === activeSessionId) renderHeader();
  }
  inp.addEventListener('blur', commit);
  inp.addEventListener('keydown', ev => { if (ev.key === 'Enter') commit(); if (ev.key === 'Escape') { inp.value = current; commit(); } });
}

async function deleteSession(id, e) {
  e.stopPropagation();
  const sess = sessions.find(s => s.id === id);
  const count = qas.filter(q => q.sessionId === id).length;
  const msg = count > 0 ? `Delete "${sess?.name}"? This will also delete ${count} Q&A${count > 1 ? 's' : ''}.` : `Delete "${sess?.name}"?`;
  if (!confirm(msg)) return;
  const oldSessions = [...sessions]; const oldQas = [...qas];
  sessions = sessions.filter(s => s.id !== id);
  qas = qas.filter(q => q.sessionId !== id);
  try { await save(); } catch(e) { sessions = oldSessions; qas = oldQas; return; }
  if (activeSessionId === id) activeSessionId = sessions[0]?.id || null;
  renderSidebar(); renderHeader(); renderList();
  showToast('Session deleted');
}

function renderSidebar() {
  const list = document.getElementById('session-list');
  list.innerHTML = sessions.map(s => {
    const count = qas.filter(q => q.sessionId === s.id).length;
    const active = s.id === activeSessionId ? 'active' : '';
    return `<div class="session-item ${active}" id="sitem-${s.id}" onclick="switchSession('${s.id}')">
      <span class="session-name">${escT(s.name)}</span>
      <span class="session-count">${count}</span>
      <div class="session-actions">
        <button title="Rename" onclick="startRename('${s.id}',event)">
          <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z"/><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z"/></svg>
        </button>
        <button class="del" title="Delete" onclick="deleteSession('${s.id}',event)">
          <svg width="11" height="11" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25-.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

function renderHeader() {
  const sess = sessions.find(s => s.id === activeSessionId);
  document.getElementById('session-title').textContent = sess ? sess.name : 'Q&A Hub';
  document.getElementById('session-subtitle').textContent = sess
    ? qas.filter(q => q.sessionId === activeSessionId).length + ' entries'
    : 'Select a session from the sidebar';
}

// ── Markdown + Table parser ────────────────────────────────────────────────
function parseAnswer(raw) {
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const lines = raw.split('\n');
  let html = '', i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    if (line.trimStart().startsWith('```')) {
      let code = ''; i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) { code += esc(lines[i]) + '\n'; i++; }
      html += '<pre><code>' + code.trimEnd() + '</code></pre>'; i++; continue;
    }

    // heading
    const hm = line.match(/^##\s+(.+)/);
    if (hm) { html += '<h3>' + esc(hm[1]) + '</h3>'; i++; continue; }

    // table — detect by pipe at start/end or multiple pipes
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i]); i++;
      }
      // parse: first row = header, second row = separator (--), rest = body
      const rows = tableLines.filter(r => !r.match(/^\|[\s\-|:]+\|$/));
      const parseRow = r => r.trim().replace(/^\||\|$/g,'').split('|').map(c => c.trim());
      let thtml = '<table>';
      rows.forEach((r, idx) => {
        const cells = parseRow(r);
        if (idx === 0) {
          thtml += '<tr>' + cells.map(c => `<th>${esc(c)}</th>`).join('') + '</tr>';
        } else {
          thtml += '<tr>' + cells.map(c => {
            let val = esc(c);
            val = val.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
            val = val.replace(/`([^`]+)`/g, '<code>$1</code>');
            return `<td>${val}</td>`;
          }).join('') + '</tr>';
        }
      });
      thtml += '</table>';
      html += thtml; continue;
    }

    // blank line
    if (line.trim() === '') { i++; continue; }

    // paragraph
    let inline = esc(line);
    inline = inline.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    inline = inline.replace(/`([^`]+)`/g, '<code>$1</code>');
    html += '<p>' + inline + '</p>'; i++;
  }
  return html || '<p style="color:var(--text-muted);font-style:italic">Nothing to preview yet…</p>';
}

// ── Toolbar inserts ────────────────────────────────────────────────────────
function insertSyntax(type) {
  const ta = document.getElementById('input-answer');
  const start = ta.selectionStart, end = ta.selectionEnd;
  const sel = ta.value.substring(start, end);
  const map = {
    'heading':     ['## ', '', 'Section Heading'],
    'bold':        ['**', '**', 'bold text'],
    'inline-code': ['`', '`', 'code'],
    'code-block':  ['```\n', '\n```', 'your code here'],
    'table':       ['', '', '| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Row 1 | Data | Data |\n| Row 2 | Data | Data |']
  };
  const [before, after, fallback] = map[type];
  const insert = type === 'table' ? '\n' + fallback + '\n' : before + (sel || fallback) + after;
  const newVal = ta.value.substring(0, start) + insert + ta.value.substring(end);
  ta.value = newVal;
  ta.selectionStart = ta.selectionEnd = start + insert.length - after.length;
  ta.focus();
  updatePreview();
}

// ── Tab switching ──────────────────────────────────────────────────────────
function switchTab(tab) {
  const ta = document.getElementById('input-answer');
  const preview = document.getElementById('answer-preview');
  const toolbar = document.getElementById('toolbar');
  document.getElementById('tab-write').classList.toggle('active', tab === 'write');
  document.getElementById('tab-preview').classList.toggle('active', tab === 'preview');
  if (tab === 'preview') {
    updatePreview(); ta.style.display = 'none'; toolbar.style.display = 'none'; preview.style.display = 'block';
  } else {
    ta.style.display = 'block'; toolbar.style.display = 'flex'; preview.style.display = 'none'; ta.focus();
  }
}
function updatePreview() {
  document.getElementById('answer-preview').innerHTML = parseAnswer(document.getElementById('input-answer').value);
}

// ── Form ───────────────────────────────────────────────────────────────────
function toggleForm() {
  formOpen = !formOpen;
  document.getElementById('form-panel').classList.toggle('open', formOpen);
  document.getElementById('toggle-form-btn').innerHTML = formOpen
    ? '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3.75 7.25a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5z"/></svg> Cancel'
    : '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z"/></svg> Add Q&A';
  if (formOpen) { switchTab('write'); setTimeout(() => document.getElementById('input-question').focus(), 50); }
  else { clearForm(); editingId = null; }
}

function cancelForm() { if (!formOpen) return; formOpen = true; toggleForm(); }

function clearForm() {
  document.getElementById('input-question').value = '';
  document.getElementById('input-answer').value = '';
  document.getElementById('field-question').classList.remove('has-error');
  document.getElementById('field-answer').classList.remove('has-error');
  document.getElementById('form-title').textContent = 'New Question & Answer';
  document.getElementById('form-submit-btn').textContent = 'Save Q&A';
  switchTab('write');
}

function openEditForm(id) {
  const qa = qas.find(q => q.id === id);
  if (!qa) return;
  editingId = id;
  document.getElementById('input-question').value = qa.question;
  document.getElementById('input-answer').value   = qa.answer;
  document.getElementById('form-title').textContent = 'Edit Question & Answer';
  document.getElementById('form-submit-btn').textContent = 'Update Q&A';
  if (!formOpen) toggleForm(); else { switchTab('write'); document.getElementById('input-question').focus(); }
  document.getElementById('form-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function submitQA() {
  const question = document.getElementById('input-question').value.trim();
  const answer   = document.getElementById('input-answer').value.trim();
  document.getElementById('field-question').classList.toggle('has-error', !question);
  document.getElementById('field-answer').classList.toggle('has-error', !answer);
  if (!question || !answer) return;

  const btn = document.getElementById('form-submit-btn');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    if (editingId) {
      const qa = qas.find(q => q.id === editingId);
      if (qa) { qa.question = question; qa.answer = answer; }
      await save();
      clearForm(); cancelForm(); editingId = null;
      renderList(); renderSidebar(); renderHeader();
      showToast('Q&A updated ✓');
    } else {
      if (!activeSessionId) { showToast('Please select a session first'); return; }
      const entry = { id: 'qa-' + Date.now(), sessionId: activeSessionId, question, answer };
      qas.unshift(entry);
      await save();
      clearForm(); cancelForm();
      renderList(); renderSidebar(); renderHeader();
      showToast('Q&A saved ✓');
      setTimeout(() => openItem(entry.id), 100);
    }
  } catch(e) {
    // save() already shows error toast
  } finally {
    btn.disabled = false;
    btn.textContent = editingId ? 'Update Q&A' : 'Save Q&A';
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────
async function deleteQA(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this Q&A?')) return;
  const old = [...qas];
  qas = qas.filter(q => q.id !== id);
  try { await save(); } catch(e) { qas = old; return; }
  renderList(); renderSidebar(); renderHeader();
  showToast('Deleted');
}

// ── Accordion ──────────────────────────────────────────────────────────────
function toggleItem(id) { document.getElementById('item-' + id)?.classList.toggle('open'); }
function openItem(id)   { document.getElementById('item-' + id)?.classList.add('open'); }

// ── Render ─────────────────────────────────────────────────────────────────
function escT(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderList() {
  const query = (document.getElementById('search-input').value || '').toLowerCase();
  const sessionQas = qas.filter(q => q.sessionId === activeSessionId);
  const filtered = sessionQas.filter(q =>
    q.question.toLowerCase().includes(query) || q.answer.toLowerCase().includes(query)
  );
  const list  = document.getElementById('qa-list');
  const empty = document.getElementById('empty-state');
  const badge = document.getElementById('count-badge');

  if (!filtered.length) {
    list.innerHTML = ''; empty.style.display = 'block'; badge.textContent = '';
    document.getElementById('empty-msg').textContent = query ? `No results for "${query}"` : 'No Q&As yet. Add your first one!';
    return;
  }
  empty.style.display = 'none';
  badge.textContent = filtered.length + (filtered.length === 1 ? ' entry' : ' entries');
  list.innerHTML = filtered.map(q => `
    <div class="qa-item" id="item-${q.id}">
      <div class="qa-question" onclick="toggleItem('${q.id}')">
        <span class="qa-question-text">${escT(q.question)}</span>
        <div class="qa-controls">
          <button class="icon-btn edit" title="Edit" onclick="openEditForm('${q.id}');event.stopPropagation()">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z"/><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z"/></svg>
          </button>
          <button class="icon-btn delete" title="Delete" onclick="deleteQA('${q.id}',event)">
            <svg width="13" height="13" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25-.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/></svg>
          </button>
          <svg class="chevron" width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
          </svg>
        </div>
      </div>
      <div class="qa-answer"><div class="qa-answer-inner">${parseAnswer(q.answer)}</div></div>
    </div>`).join('');
}

// ── Export ─────────────────────────────────────────────────────────────────
function exportHTML(mode) {
  let exportSessions, exportQas, docTitle;
  if (mode === 'current') {
    const sess = sessions.find(s => s.id === activeSessionId);
    if (!sess) { showToast('No session selected'); return; }
    exportSessions = [sess]; exportQas = qas.filter(q => q.sessionId === activeSessionId); docTitle = sess.name;
  } else {
    exportSessions = sessions; exportQas = qas; docTitle = 'Q&A Hub — All Sessions';
  }
  const date = new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  const sessionBlocks = exportSessions.map(sess => {
    const items = exportQas.filter(q => q.sessionId === sess.id);
    if (!items.length) return '';
    const qaItems = items.map((q, i) => `<div class="qa-item" id="q${q.id}">
      <div class="qa-header" onclick="toggle('q${q.id}')">
        <span class="qa-num">${i+1}</span>
        <span class="qa-question">${escT(q.question)}</span>
        <svg class="chevron" viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/></svg>
      </div>
      <div class="qa-body"><div class="qa-answer">${parseAnswer(q.answer)}</div></div>
    </div>`).join('');
    return `<section class="session-block"><h2 class="session-title">${escT(sess.name)} <span class="session-count">${items.length}</span></h2>${qaItems}</section>`;
  }).join('');

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${escT(docTitle)}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=DM+Sans:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}:root{--bg:#f7f5f0;--surface:#fff;--border:#e2ddd6;--text-primary:#1a1916;--text-secondary:#6b6760;--text-muted:#9e9b96;--accent:#2c5f4a;--accent-light:#eaf4ef;--code-bg:#f0ede8;--code-border:#d8d3cb;--code-text:#2c4a3e}body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text-primary);padding:2.5rem 1rem 5rem}.page{max-width:760px;margin:0 auto}.page-header{margin-bottom:2.5rem;padding-bottom:1.25rem;border-bottom:1px solid var(--border)}.page-header h1{font-family:'Playfair Display',serif;font-size:1.9rem;font-weight:600}.meta{font-size:13px;color:var(--text-muted);margin-top:5px}.session-block{margin-bottom:2.5rem}.session-title{font-family:'Playfair Display',serif;font-size:1.2rem;font-weight:500;margin-bottom:1rem;display:flex;align-items:center;gap:10px}.session-count{font-size:12px;font-weight:500;background:var(--accent-light);color:var(--accent);border:1px solid #b5d9c8;border-radius:20px;padding:2px 9px}.qa-item{background:var(--surface);border:1px solid var(--border);border-radius:10px;margin-bottom:8px;overflow:hidden}.qa-header{display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;user-select:none}.qa-header:hover{background:#faf9f7}.qa-num{font-size:12px;font-weight:500;color:var(--accent);background:var(--accent-light);border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;flex-shrink:0}.qa-question{font-weight:500;font-size:15px;flex:1}.chevron{flex-shrink:0;color:#9e9b96;transition:transform 0.2s}.qa-item.open .chevron{transform:rotate(180deg)}.qa-body{max-height:0;overflow:hidden;transition:max-height 0.3s ease;padding:0 16px}.qa-item.open .qa-body{max-height:3000px;padding:0 16px 16px}.qa-answer{font-size:15px;color:var(--text-secondary);line-height:1.75;border-top:1px solid var(--border);padding-top:14px}.qa-answer h3{font-size:12px;font-weight:500;letter-spacing:0.7px;text-transform:uppercase;color:var(--accent);margin:1rem 0 0.4rem}.qa-answer h3:first-child{margin-top:0}.qa-answer strong{color:var(--text-primary);font-weight:500}.qa-answer p{margin-bottom:0.55rem}.qa-answer code{font-family:'JetBrains Mono',monospace;font-size:13px;background:var(--code-bg);border:1px solid var(--code-border);border-radius:4px;padding:1px 5px;color:var(--code-text)}.qa-answer pre{background:#1e2a26;border-radius:8px;padding:1rem 1.1rem;margin:0.75rem 0;overflow-x:auto}.qa-answer pre code{background:none;border:none;padding:0;color:#a8d5be;line-height:1.7}.qa-answer table{width:100%;border-collapse:collapse;margin:0.75rem 0;font-size:14px}.qa-answer th{background:var(--accent-light);color:#1a3d2e;font-weight:500;text-align:left;padding:8px 12px;border:1px solid #b5d9c8;font-size:13px}.qa-answer td{padding:7px 12px;border:1px solid var(--border);vertical-align:top}.qa-answer tr:nth-child(even){background:#faf9f7}.footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--border);font-size:12px;color:var(--text-muted)}</style>
</head><body><div class="page">
<div class="page-header"><h1>${escT(docTitle)}</h1><div class="meta">Exported on ${date} &bull; ${exportQas.length} Q&amp;As across ${exportSessions.length} session${exportSessions.length!==1?'s':''}</div></div>
${sessionBlocks}
<div class="footer">Generated by Q&amp;A Hub</div></div>
<script>function toggle(id){document.getElementById(id).classList.toggle('open');}<\/script>
</body></html>`;

  const filename = (mode === 'current' ? (sessions.find(s=>s.id===activeSessionId)?.name||'session') : 'qa-hub-all').toLowerCase().replace(/[^a-z0-9]+/g,'-') + '.html';
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); URL.revokeObjectURL(a.href);
  showToast('Exported as ' + filename);
}

// ── Toast ──────────────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Keyboard ───────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.ctrlKey && formOpen) submitQA();
  if (e.key === 'Escape' && formOpen) cancelForm();
});

// ── Init ───────────────────────────────────────────────────────────────────
(async () => {
  await loadData();
  document.getElementById('loading-overlay').style.display = 'none';
  renderSidebar();
  renderHeader();
  renderList();
})();
