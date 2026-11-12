// Initialize Supabase client safely
const SUPABASE_URL = 'https://cndqeuebqtfbuebrgcxy.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__PCVowMDvTwJUmfMcctm6w_P-DMOG25';
if (typeof supabase === 'undefined') {
    var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/* ==========================================================================
   1. DATA MODELS & LOCAL STORAGE MANAGEMENT
   ========================================================================== */
const STORAGE_KEY = 'ua_gradeflow_v6_store';
const AUTH_KEY = 'ua_gradeflow_v6_auth';

const COURSES = [
  { code: 'BSIT', name: 'BS Information Technology' },
  { code: 'BSCS', name: 'BS Computer Science' },
  { code: 'BSN', name: 'BS in Nursing' }
];

const SECTIONS = [
  { id: 'BSIT-1A', course: 'BSIT', year: '1st Year' },
  { id: 'BSIT-1B', course: 'BSIT', year: '1st Year' },
  { id: 'BSCS-1A', course: 'BSCS', year: '1st Year' },
  { id: 'BSN-3A', course: 'BSN', year: '3rd Year' }
];

const DEFAULT_MINORS = [
  ['GE101', 'Understanding the Self', 3],
  ['GE102', 'Purposive Communication', 3],
  ['GE103', 'Ethics', 3],
  ['PE101', 'Physical Education 1', 2],
  ['NSTP1', 'National Service Training Program 1', 3]
];

// ==========================================
// SUPABASE SYNC HELPERS
// ==========================================

// Save a specific table's item or entire state
async function syncTableToSupabase(tableName, recordId, dataObject) {
    try {
        const { error } = await supabase
            .from(tableName)
            .upsert({ id: recordId, data: dataObject, updated_at: new Date() });
        if (error) console.error(`Error syncing ${tableName}:`, error);
    } catch (err) {
        console.error(`Exception syncing ${tableName}:`, err);
    }
}

// Load an entire table into an object or array format
async function loadTableFromSupabase(tableName) {
    try {
        const { data, error } = await supabase.from(tableName).select('*');
        if (error) {
            console.error(`Error loading ${tableName}:`, error);
            return null;
        }
        // Convert rows back to your app's expected structure
        let result = tableName === 'log' ? [] : {};
        data.forEach(row => {
            if (tableName === 'log') {
                result.push(row.data);
            } else {
                result[row.id] = row.data;
            }
        });
        return result.length > 0 || Object.keys(result).length > 0 ? result : null;
    } catch (err) {
        console.error(`Exception loading ${tableName}:`, err);
        return null;
    }
}

// ==========================================
// APPSTATE SUPABASE INTEGRATION
// ==========================================

// Load entire appState from Supabase tables
async function loadAppStateFromSupabase() {
    try {
        console.log("Loading appState from Supabase...");
        const loadedSettings = await loadTableFromSupabase('settings');
        const loadedSubjects = await loadTableFromSupabase('subjects');
        const loadedCourses = await loadTableFromSupabase('courses');
        const loadedSections = await loadTableFromSupabase('sections');
        const loadedClasswork = await loadTableFromSupabase('classwork');
        const loadedTeachers = await loadTableFromSupabase('teachers');
        const loadedStudents = await loadTableFromSupabase('students');
        const loadedGrades = await loadTableFromSupabase('grades');
        const loadedLog = await loadTableFromSupabase('log');

        // Update appState if data exists in Supabase
        if (loadedSettings && loadedSettings[1]) window.appState.settings = loadedSettings[1];
        if (loadedSubjects) window.appState.subjects = loadedSubjects;
        if (loadedCourses) window.appState.courses = loadedCourses;
        if (loadedSections) window.appState.sections = loadedSections;
        if (loadedClasswork) window.appState.classwork = loadedClasswork;
        if (loadedTeachers) window.appState.teachers = loadedTeachers;
        if (loadedStudents) window.appState.students = loadedStudents;
        if (loadedGrades) window.appState.grades = loadedGrades;
        if (loadedLog) window.appState.log = loadedLog;

        console.log("appState successfully loaded from Supabase!", window.appState);
    } catch (err) {
        console.error("Error loading appState from Supabase:", err);
    }
}

function generateSubjectsSeed() {
  const subjects = [];
  const majors = {
    BSIT: [
      ['IT101', 'Introduction to Computing', 3],
      ['IT102', 'Computer Programming 1', 3],
      ['IT103', 'Data Structures and Algorithms', 3],
      ['IT104', 'Web System Development', 3]
    ],
    BSCS: [
      ['CS101', 'Introduction to Computing', 3],
      ['CS102', 'Computer Programming 1', 3],
      ['CS103', 'Data Structures and Algorithms', 3],
      ['CS104', 'Discrete Structures', 3],
      ['CS105', 'Web System Development', 3]
    ],
    BSN: [
      ['NUR101', 'Anatomy and Physiology', 5],
      ['NUR102', 'Fundamentals of Nursing', 4],
      ['NUR103', 'Health Assessment', 3]
    ]
  };

  COURSES.forEach(c => {
    const courseMajors = majors[c.code] || [['GEN101', 'Core Subject 1', 3]];
    courseMajors.forEach(m => {
      subjects.push({ id: `${c.code}-${m[0]}`, course: c.code, code: m[0], title: m[1], type: 'major', units: m[2] });
    });
    DEFAULT_MINORS.forEach(m => {
      subjects.push({ id: `${c.code}-${m[0]}`, course: c.code, code: m[0], title: m[1], type: 'minor', units: m[2] });
    });
  });
  return subjects;
}

function generateCleanStateData() {
  return {
    settings: {
      school: 'University of the Assumption',
      registrar: 'Prof. Mark Anthony Madalipay',
      term: '1st Semester, A.Y. 2026-2027',
      releasedTerm: 'p',
      weights: { quiz: 30, activity: 30, exam: 30, attendance: 10 }
    },
    subjects: generateSubjectsSeed(),
    courses: [...COURSES],
    sections: [...SECTIONS],
    classwork: {},
    teachers: [
      { username: 'markanthonymadalipay', password: 'madd79', name: 'Prof. Mark Anthony Madalipay', email: 'mark.madalipay@ua.edu.ph' }
    ],
    students: [],
    grades: {},
    log: []
  };
}

let appState = loadState();
let authUser = loadAuth();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.students && parsed.subjects && parsed.grades) {
        if (!parsed.courses) parsed.courses = [...COURSES];
        if (!parsed.sections) parsed.sections = [...SECTIONS];
        if (!parsed.settings) parsed.settings = generateCleanStateData().settings;
        if (!parsed.settings.releasedTerm) parsed.settings.releasedTerm = 'p';
        if (!parsed.settings.weights || parsed.settings.weights.exam === undefined) {
          parsed.settings.weights = { quiz: 30, activity: 30, exam: 30, attendance: 10 };
        }
        if (!parsed.classwork) parsed.classwork = {};
        if (!parsed.teachers || !parsed.teachers.length) parsed.teachers = generateCleanStateData().teachers;
        parsed.students.forEach(st => {
          if (!st.password) st.password = String(100000 + Math.floor(Math.random() * 900000));
        });
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed)); } catch (e) {}
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Storage read error, starting clean database.');
  }
  return generateCleanStateData();
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  } catch (e) {
    console.error('Storage write error:', e);
  }
}

function loadAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return null;
}

function setAuth(user) {
  authUser = user;
  if (user) localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  else localStorage.removeItem(AUTH_KEY);
  renderApp();
}

function resetStateToDefault() {
  const keepTeachers = appState.teachers;
  appState = generateCleanStateData();
  appState.teachers = keepTeachers;
  saveState();
  renderApp();
  showToast('Database reset to empty state.', 'info');
}

/* ==========================================================================
   2b. ITEMIZED CLASS RECORD
   Per section + subject + term the teacher records:
     - Quizzes     (name + total points)
     - Activities  (name + total points)
     - Exam        (total points)
     - Attendance  (class dates)
   Each student then gets a score per item and a status per date.
     Quizzes %    = total score / total points of recorded quizzes
     Activities % = total score / total points of recorded activities
     Exam %       = exam score / exam points
     Attendance % = (Present + Late) / (Present + Late + Absent)   [Excused is not counted]
     Term grade   = weighted sum using the weights in Portal Settings
   Storage:
     appState.classwork["SECTION|SUBJECT-ID|term"] = { quizzes, activities, exam, dates }
     appState.grades[studentId][subjectId] = { p, m, pf, items: {itemId: score}, att: {dateId: 'P'|'L'|'A'|'E'}, auto: {term:true} }
   ========================================================================== */
const TERMS = [
  { key: 'p', label: 'Prelim' },
  { key: 'm', label: 'Midterm' },
  { key: 'pf', label: 'Pre-Final' }
];
// Prelim & Midterm: Class Standing x2, Exam x1.  Pre-Final: Class Standing x1, Exam x2.
const TERM_MULT = { p: { cs: 2, ex: 1 }, m: { cs: 2, ex: 1 }, pf: { cs: 1, ex: 2 } };

/* ---------- Student grade release (controlled by teacher in Portal Settings) ---------- */
function releasedTerm() {
  return (appState.settings && appState.settings.releasedTerm) || 'p';
}
function finalsReleased() { return releasedTerm() === 'pf'; }
// Prelim -> only Prelim, Midterm -> only Midterm, Pre-Final -> all three
function visibleTerms() {
  const r = releasedTerm();
  return r === 'pf' ? ['p', 'm', 'pf'] : [r];
}

const ATT_STATUS = {
  P: { label: 'Present', tone: 'pass' },
  L: { label: 'Late', tone: 'warn' },
  A: { label: 'Absent', tone: 'fail' },
  E: { label: 'Excused', tone: 'muted' }
};

function isTeacherSession() {
  return !!(authUser && authUser.role === 'teacher');
}

function getWeights() {
  const w = (appState.settings && appState.settings.weights) || {};
  const n = (v, d) => (v === undefined || v === null || isNaN(parseFloat(v))) ? d : parseFloat(v);
  return { quiz: n(w.quiz, 30), activity: n(w.activity, 30), exam: n(w.exam, 30), attendance: n(w.attendance, 10) };
}

function hasVal(v) {
  return v !== undefined && v !== null && v !== '';
}

function pctOf(score, total) {
  const x = parseFloat(score), y = parseFloat(total);
  if (isNaN(x) || isNaN(y) || y <= 0) return null;
  return Math.max(0, Math.min(100, (x / y) * 100));
}

function newItemId(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function fmtDate(d) {
  try {
    return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) { return d; }
}

function getClassWork(section, subjectId, termKey, create) {
  if (!appState.classwork) appState.classwork = {};
  const k = `${section}|${subjectId}|${termKey}`;
  if (!appState.classwork[k]) {
    const empty = { quizzes: [], activities: [], exam: null, dates: [] };
    if (!create) return empty;
    appState.classwork[k] = empty;
  }
  return appState.classwork[k];
}

function computeTermBreakdown(student, subjectId, termKey) {
  const cw = getClassWork(student.section, subjectId, termKey, false);
  const rec = (appState.grades[student.id] || {})[subjectId] || {};
  const items = rec.items || {};
  const att = rec.att || {};

  const sumList = list => {
    let sc = 0, tt = 0, n = 0;
    list.forEach(it => {
      if (hasVal(items[it.id])) { sc += parseFloat(items[it.id]); tt += it.total; n++; }
    });
    return tt > 0 ? { pct: Math.max(0, Math.min(100, (sc / tt) * 100)), score: sc, total: tt, n } : null;
  };
  const quiz = sumList(cw.quizzes);
  const act = sumList(cw.activities);

  let exam = null;
  if (cw.exam && cw.exam.total > 0 && hasVal(items[cw.exam.id])) {
    exam = { pct: pctOf(items[cw.exam.id], cw.exam.total), score: parseFloat(items[cw.exam.id]), total: cw.exam.total };
  }

  let present = 0, late = 0, absent = 0, excused = 0;
  cw.dates.forEach(d => {
    const st = att[d.id];
    if (st === 'P') present++;
    else if (st === 'L') late++;
    else if (st === 'A') absent++;
    else if (st === 'E') excused++;
  });
  const counted = present + late + absent;
  const attPct = counted > 0 ? ((present + late) / counted) * 100 : null;

  // The term grade needs all four parts to have at least one recorded value
  let term = null, cs = null;
  if (quiz && act && exam && attPct !== null) {
    const w = getWeights(), m = TERM_MULT[termKey] || TERM_MULT.p;
    const cwTot = (w.quiz + w.activity + w.attendance) || 1;
    cs = (quiz.pct * w.quiz + act.pct * w.activity + attPct * w.attendance) / cwTot;   // Class Standing %
    term = (cs * m.cs + exam.pct * m.ex) / (m.cs + m.ex);
  }

  return { cw, quiz, act, exam, attendance: { pct: attPct, present, late, absent, excused, counted }, term, cs };
}

function syncTermGrade(student, subjectId, termKey) {
  const bd = computeTermBreakdown(student, subjectId, termKey);
  if (!appState.grades[student.id]) appState.grades[student.id] = {};
  let rec = appState.grades[student.id][subjectId];
  if (bd.term !== null) {
    if (!rec) rec = appState.grades[student.id][subjectId] = { p: null, m: null, pf: null };
    if (!rec.auto) rec.auto = {};
    rec[termKey] = bd.term;
    rec.auto[termKey] = true;
  } else if (rec && rec.auto && rec.auto[termKey]) {
    rec[termKey] = null;
    delete rec.auto[termKey];
  }
}

function syncClass(section, subjectId, termKey) {
  appState.students.filter(st => st.section === section).forEach(st => syncTermGrade(st, subjectId, termKey));
}

function recomputeAllTermGrades() {
  appState.students.forEach(st => {
    appState.subjects.filter(sub => sub.course === st.course).forEach(sub => {
      TERMS.forEach(t => syncTermGrade(st, sub.id, t.key));
    });
  });
}

/* ==========================================================================
   2. ACADEMIC EVALUATION (PRELIM, MIDTERM, PRE-FINAL)
   ========================================================================== */
function pctToEquiv(pct) {
  if (pct === null || pct === undefined) return null;
  const r = Math.round(pct);
  if (r >= 97) return 1.00;
  if (r >= 94) return 1.25;
  if (r >= 91) return 1.50;
  if (r >= 88) return 1.75;
  if (r >= 85) return 2.00;
  if (r >= 82) return 2.25;
  if (r >= 79) return 2.50;
  if (r >= 76) return 2.75;
  if (r >= 75) return 3.00;
  return 5.00;
}

function calculateSubjectGrade(gradeRecord) {
  if (!gradeRecord) return { status: 'none', pct: null, eq: null };
  const { p, m, pf } = gradeRecord;
  const hasP = p !== null && p !== undefined && p !== '';
  const hasM = m !== null && m !== undefined && m !== '';
  const hasPF = pf !== null && pf !== undefined && pf !== '';

  if (!hasP && !hasM && !hasPF) return { status: 'none', pct: null, eq: null };
  if (!hasP || !hasM || !hasPF) return { status: 'inc', pct: null, eq: null };

  const pct = (parseFloat(p) + parseFloat(m) + parseFloat(pf)) / 3;
  const eq = pctToEquiv(pct);
  return { status: eq <= 3.00 ? 'passed' : 'failed', pct, eq };
}

function getStudentSummary(student) {
  const studentSubjects = appState.subjects.filter(s => s.course === student.course);
  const rows = studentSubjects.map(sub => {
    const g = (appState.grades[student.id] || {})[sub.id] || null;
    return { sub, g, calc: calculateSubjectGrade(g) };
  });

  const completed = rows.filter(r => r.calc.status === 'passed' || r.calc.status === 'failed');
  const unitsEvaluated = completed.reduce((acc, r) => acc + r.sub.units, 0);
  const totalUnits = rows.reduce((acc, r) => acc + r.sub.units, 0);
  
  const gwa = unitsEvaluated > 0 
    ? completed.reduce((acc, r) => acc + (r.calc.eq * r.sub.units), 0) / unitsEvaluated
    : null;

  const failedCount = rows.filter(r => r.calc.status === 'failed').length;
  const incCount = rows.filter(r => r.calc.status === 'inc' || r.calc.status === 'none').length;
  const passedCount = rows.filter(r => r.calc.status === 'passed').length;

  const worstGrade = completed.length ? Math.max(...completed.map(r => r.calc.eq)) : null;
  const isDeansLister = gwa !== null && gwa <= 1.75 && failedCount === 0 && incCount === 0 && worstGrade <= 2.50;

  let standing = { label: 'Good Standing', color: 'emerald' };
  if (isDeansLister) standing = { label: "Dean's Lister", color: 'amber' };
  else if (failedCount > 0) standing = { label: 'Deficient / Has Failed Subj', color: 'rose' };
  else if (incCount > 0) standing = { label: 'Incomplete Grades', color: 'amber' };
  else if (gwa === null) standing = { label: 'Unevaluated', color: 'slate' };

  return {
    rows,
    completed,
    gwa,
    unitsEvaluated,
    totalUnits,
    failedCount,
    incCount,
    passedCount,
    isDeansLister,
    standing
  };
}

/* ==========================================================================
   3. CSV FILE IMPORT & EXPORT ENGINE
   ========================================================================== */
const BTN_GRAY = 'px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all';
const BTN_BLUE = 'px-3 py-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500 hover:text-white text-xs font-bold transition-all';
const BTN_GOLD = 'px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer shadow-md transition-all';
const TERM_NAME = { p: 'Prelim', m: 'Midterm', pf: 'PreFinal' };
const TERM_FILE = { p: 'Prelim', m: 'Midterm', pf: 'Final' };
const rndCode = () => String(100000 + Math.floor(Math.random() * 900000));
const sectionCourse = id => (appState.sections.find(s => s.id === id) || {}).course || String(id).split('-')[0];

function saveCSV(name, rows) {
  const text = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}

// Proper CSV parser (quoted fields, commas and line breaks inside quotes)
function parseCSV(t) {
  t = t.replace(/^\uFEFF/, '');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cur); cur = ''; rows.push(row); row = []; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}

function readCSVFile(event, cb) {
  const f = event.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = e => { event.target.value = ''; const rows = parseCSV(String(e.target.result)); rows.length < 2 ? showToast('CSV needs a header row and at least one data row.', 'error') : cb(rows); };
  r.readAsText(f);
}

/* ---------- STUDENTS CSV (roster only: no grades) ---------- */
const ROSTER_HEAD = ['School ID', 'Student Name', 'Course', 'Section', 'Student Email', 'Guardian Name', 'Guardian Email', 'Guardian PIN', 'Student Password'];

function downloadRosterTemplate(sectionId) {
  const c = sectionCourse(sectionId);
  saveCSV(`${sectionId}_Students_Template.csv`, [ROSTER_HEAD,
    ['2026000101', 'Maria Clarissa Santos', c, sectionId, 'maria.santos@student.ua.edu.ph', 'Juan Santos', 'parent.santos@example.com', '123456', '482915'],
    ['2026000102', 'Juan Miguel Dela Cruz', c, sectionId, 'juan.delacruz@student.ua.edu.ph', 'Maria Dela Cruz', 'parent.delacruz@example.com', '654321', '736204']]);
  showToast('Students template downloaded.', 'success');
}

function exportRosterCSV(sectionId) {
  const list = appState.students.filter(s => s.section === sectionId);
  if (!list.length) return showToast(`No students enrolled in ${sectionId} to export.`, 'error');
  saveCSV(`${sectionId}_Students.csv`, [ROSTER_HEAD, ...list.map(s => { const p = s.parent || {}; return [s.id, s.name, s.course, s.section, s.email, p.name, p.email, p.pin, s.password]; })]);
  showToast(`Exported ${sectionId}_Students.csv`, 'success');
}

function importRosterCSV(event, sectionId) {
  readCSVFile(event, rows => {
    const H = rows[0].map(h => h.trim().toLowerCase());
    let added = 0, updated = 0;
    rows.slice(1).forEach(c => {
      const get = n => { const i = H.indexOf(n); return i < 0 ? '' : (c[i] || '').trim(); };
      const id = get('school id'), name = get('student name');
      if (!id || !name) return;
      const sec = get('section') || sectionId, course = get('course') || sectionCourse(sec);
      let st = appState.students.find(s => s.id === id);
      if (!st) {
        st = { id, name, course, section: sec, email: get('student email'), password: get('student password') || rndCode(),
          parent: { name: get('guardian name') || 'Guardian', email: get('guardian email'), pin: get('guardian pin') || rndCode() } };
        appState.students.push(st); added++;
      } else {
        const o = st.parent || {};
        Object.assign(st, { name, course, section: sec, email: get('student email') || st.email });
        if (get('student password')) st.password = get('student password');
        st.parent = { name: get('guardian name') || o.name || 'Guardian', email: get('guardian email') || o.email || '', pin: get('guardian pin') || o.pin || rndCode() };
        updated++;
      }
      if (!appState.grades[id]) appState.grades[id] = {};
    });
    saveState(); renderApp();
    showToast(`Students imported: ${added} new, ${updated} updated.`, 'success');
  });
}

/* ---------- GRADES CSV (Prelim / Midterm / Final = all terms) ---------- */
function gradeColumns(course, term) {
  const keys = term === 'pf' ? ['p', 'm', 'pf'] : [term], cols = [];
  appState.subjects.filter(s => s.course === course).forEach(sub => {
    keys.forEach(k => cols.push({ sub, k, h: `${sub.code}_${TERM_NAME[k]}` }));
    if (term === 'pf') { cols.push({ sub, calc: 'pct', h: `${sub.code}_Average` }); cols.push({ sub, calc: 'eq', h: `${sub.code}_Grade` }); }
  });
  return cols;
}

function buildGradesRows(sectionId, term, blank) {
  const cols = gradeColumns(sectionCourse(sectionId), term);
  const studs = appState.students.filter(s => s.section === sectionId);
  const list = blank && !studs.length ? [{ id: '2026000101', name: 'Sample Student' }] : studs;
  return [['School ID', 'Student Name', ...cols.map(c => c.h)], ...list.map(st => [st.id, st.name, ...cols.map(c => {
    if (blank) return '';
    const rec = (appState.grades[st.id] || {})[c.sub.id] || null;
    if (c.calc) { const cc = calculateSubjectGrade(rec), v = c.calc === 'pct' ? cc.pct : cc.eq; return v == null ? '' : v.toFixed(2); }
    const v = rec ? rec[c.k] : null;
    return v == null ? '' : Number(v).toFixed(1);
  })])];
}

function downloadGradesTemplate(sectionId) {
  const t = uiState.csvTerm || 'p';
  saveCSV(`${sectionId}_${TERM_FILE[t]}_Grades_Template.csv`, buildGradesRows(sectionId, t, true));
  showToast(`${TERM_FILE[t]} grades template downloaded.`, 'success');
}

function exportGradesCSV(sectionId) {
  const t = uiState.csvTerm || 'p';
  if (!appState.students.some(s => s.section === sectionId)) return showToast(`No students enrolled in ${sectionId}.`, 'error');
  saveCSV(`${sectionId}_${TERM_FILE[t]}_Grades.csv`, buildGradesRows(sectionId, t, false));
  showToast(`Exported ${TERM_FILE[t]} grades.`, 'success');
}

// Updates only the columns present in the file (e.g. a Prelim file never touches Midterm). Blank cells are skipped.
function importGradesCSV(event, sectionId) {
  readCSVFile(event, rows => {
    const H = rows[0].map(h => h.trim());
    const idIdx = H.findIndex(h => h.toLowerCase() === 'school id');
    if (idIdx < 0) return showToast('Missing "School ID" column.', 'error');
    const map = [];
    H.forEach((h, i) => { const m = h.match(/^(.+)_(Prelim|Midterm|PreFinal)$/i); if (m) map.push({ i, code: m[1].toUpperCase(), k: { prelim: 'p', midterm: 'm', prefinal: 'pf' }[m[2].toLowerCase()] }); });
    if (!map.length) return showToast('No grade columns found (expected e.g. IT101_Prelim).', 'error');
    let upd = 0, skipped = 0, bad = 0;
    rows.slice(1).forEach(r => {
      const st = appState.students.find(s => String(s.id) === (r[idIdx] || '').trim());
      if (!st) { skipped++; return; }
      let hit = false;
      map.forEach(m => {
        const sub = appState.subjects.find(s => s.course === st.course && s.code.toUpperCase() === m.code);
        const v = (r[m.i] || '').trim();
        if (!sub || v === '') return;
        const n = parseFloat(v);
        if (isNaN(n) || n < 0 || n > 100) { bad++; return; }
        if (!appState.grades[st.id]) appState.grades[st.id] = {};
        const rec = appState.grades[st.id][sub.id] || (appState.grades[st.id][sub.id] = { p: null, m: null, pf: null });
        rec[m.k] = n; if (rec.auto) delete rec.auto[m.k];
        hit = true;
      });
      if (hit) upd++;
    });
    saveState(); renderApp();
    showToast(`Grades imported for ${upd} student(s)${skipped ? `, ${skipped} unknown ID(s) skipped` : ''}${bad ? `, ${bad} invalid value(s) ignored` : ''}.`, bad ? 'error' : 'success');
  });
}

/* ==========================================================================
   4. UI STATE & SYSTEM UTILITIES
   ========================================================================== */
const uiState = {
  activePage: 'dashboard',
  dashFilter: { course: 'all', section: 'all' },
  entryFilter: { course: 'BSIT', section: 'BSIT-1A', subject: 'BSIT-IT101', search: '', term: 'p', view: 'summary' },
  studentTerm: 'p',
  studentSubject: '',
  studentsSectionFilter: 'BSIT-1A',
  studentsSearch: '',
  teacherPasswordVisible: false,
  darkMode: localStorage.getItem('gradeflow_theme') === 'dark' || (!('gradeflow_theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)
};

function applyTheme() {
  if (uiState.darkMode) {
    document.documentElement.classList.add('dark');
    localStorage.setItem('gradeflow_theme', 'dark');
  } else {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('gradeflow_theme', 'light');
  }
}

function toggleTheme() {
  uiState.darkMode = !uiState.darkMode;
  applyTheme();
  renderApp();
}
applyTheme();

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  const bg = type === 'error' ? 'bg-rose-600' : type === 'success' ? 'bg-emerald-600' : 'bg-slate-800 dark:bg-slate-100';
  const text = type === 'error' || type === 'success' ? 'text-white' : 'text-white dark:text-slate-900';
  toast.className = `pointer-events-auto flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg ${bg} ${text} text-sm font-medium transition-all duration-300 transform translate-y-2 opacity-0`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function getUASealSVG(extraCls = "w-10 h-10") {
  return `<img src="https://thumb.wikimedia.org/wikipedia/commons/thumb/1/11/Ua-logo.png/250px-Ua-logo.png" alt="University of the Assumption Logo" class="${extraCls} object-contain" onerror="this.onerror=null; this.src='https://placehold.co/100x100/002B66/FFFFFF?text=UA';" />`;
}

function formatGradeEq(val) {
  return val === null || val === undefined ? '-' : val.toFixed(2);
}

function formatGwa(val) {
  return val === null || val === undefined ? 'N/A' : val.toFixed(2);
}

/* ==========================================================================
   5. AUTHENTICATION & LOGIN UI
   ========================================================================== */
function renderLoginPage() {
  return `
    <div class="min-h-screen w-full flex flex-col justify-center items-center p-4 bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-100 relative overflow-hidden transition-colors duration-200">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-blue-100/60 dark:from-blue-900/40 via-slate-100 dark:via-slate-950 to-slate-200 dark:to-slate-950 pointer-events-none"></div>
      
      <button type="button" onclick="toggleTheme()" class="absolute top-5 right-5 z-20 p-2.5 rounded-full bg-slate-200/80 dark:bg-slate-800/80 text-slate-700 dark:text-amber-400 border border-slate-300 dark:border-slate-700 shadow-md hover:scale-105 transition-all">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          ${uiState.darkMode 
            ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>'
            : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>'}
        </svg>
      </button>

      <div class="w-full max-w-md space-y-6 relative z-10">
        <div class="text-center space-y-3">
          <div class="inline-block p-3 rounded-2xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-2xl">
            ${getUASealSVG("w-16 h-16")}
          </div>
          <div>
            <h1 class="text-2xl font-extrabold text-brand-500 dark:text-white tracking-tight">University of the Assumption</h1>
            <p class="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-widest mt-1">GradeFlow Academic Portal</p>
          </div>
        </div>

        <div class="glass-panel p-6 rounded-3xl shadow-2xl space-y-6 border border-slate-200 dark:border-slate-700/50">
          <div class="flex rounded-xl bg-slate-200/80 dark:bg-slate-800/80 p-1 border border-slate-300 dark:border-slate-700/60">
            <button type="button" onclick="switchLoginTab('teacher')" id="tabBtnTeacher" class="flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-brand-500 text-white shadow-md">Teacher Portal</button>
            <button type="button" onclick="switchLoginTab('student')" id="tabBtnStudent" class="flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">Student Portal</button>
          </div>

          <form id="teacherLoginForm" onsubmit="handleTeacherLogin(event)" class="space-y-4">
            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Faculty Username</label>
              <input type="text" id="tLoginUser" required autocomplete="username" placeholder="Enter your username" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:border-amber-400 focus:outline-none" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
              <div class="relative">
                <input type="${uiState.teacherPasswordVisible ? 'text' : 'password'}" id="tLoginPass" required autocomplete="current-password" placeholder="Enter your password" class="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:border-amber-400 focus:outline-none" />
                <button type="button" onclick="togglePass('tLoginPass', this)" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-500 transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    ${uiState.teacherPasswordVisible 
                      ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/>' 
                      : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>'}
                  </svg>
                </button>
              </div>
            </div>
            <button type="submit" class="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all">
              Sign In as Teacher
            </button>
          </form>

          <form id="studentLoginForm" onsubmit="handleStudentLogin(event)" class="space-y-4 hidden">
            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Student Number</label>
              <input type="text" id="sLoginNumber" required inputmode="numeric" autocomplete="username" placeholder="e.g. 2026000101" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm font-mono focus:border-amber-400 focus:outline-none" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
              <div class="relative">
                <input type="password" id="sLoginPass" required autocomplete="current-password" placeholder="Enter your password" class="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:border-amber-400 focus:outline-none" />
                <button type="button" onclick="togglePass('sLoginPass', this)" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-500 transition-colors">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                </button>
              </div>
              <p class="text-[10px] text-slate-500 dark:text-slate-400">Your password is provided by your teacher.</p>
            </div>
            <button type="submit" class="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-sm shadow-lg shadow-brand-500/30 transition-all">
              Access Student Portal
            </button>
          </form>
        </div>

        <p class="text-center text-xs text-slate-500 font-medium">University of the Assumption &copy; 2026. All Rights Reserved.</p>
      </div>
    </div>
  `;
}

function switchLoginTab(role) {
  const tForm = document.getElementById('teacherLoginForm');
  const sForm = document.getElementById('studentLoginForm');
  const tBtn = document.getElementById('tabBtnTeacher');
  const sBtn = document.getElementById('tabBtnStudent');

  if (role === 'teacher') {
    tForm.classList.remove('hidden');
    sForm.classList.add('hidden');
    tBtn.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-brand-500 text-white shadow-md";
    sBtn.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
  } else {
    sForm.classList.remove('hidden');
    tForm.classList.add('hidden');
    sBtn.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-brand-500 text-white shadow-md";
    tBtn.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white";
  }
}

const EYE_ON = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>';
const EYE_OFF = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/>';
// Toggles the field in place (no re-render, so typed text is kept)
function togglePass(id, btn) {
  const i = document.getElementById(id);
  if (!i) return;
  const show = i.type === 'password';
  i.type = show ? 'text' : 'password';
  const svg = btn.querySelector('svg');
  if (svg) svg.innerHTML = show ? EYE_OFF : EYE_ON;
}

function handleTeacherLogin(e) {
  e.preventDefault();
  const username = document.getElementById('tLoginUser').value.trim().toLowerCase();
  const pass = document.getElementById('tLoginPass').value;
  const t = (appState.teachers || []).find(x => x.username.toLowerCase() === username && x.password === pass);
  if (t) {
    setAuth({ role: 'teacher', username: t.username, name: t.name, email: t.email || '' });
    showToast(`Welcome back, ${t.name}!`, 'success');
  } else {
    showToast('Invalid faculty username or password.', 'error');
  }
}


function handleStudentLogin(e) {
  e.preventDefault();
  const number = document.getElementById('sLoginNumber').value.trim();
  const pass = document.getElementById('sLoginPass').value;
  const st = appState.students.find(s => String(s.id) === number);
  if (st && st.password && st.password === pass) {
    setAuth({ role: 'student', studentId: st.id, name: st.name });
    showToast(`Signed in as ${st.name}`, 'success');
  } else {
    showToast('Invalid student number or password.', 'error');
  }
}

/* ==========================================================================
   6. MAIN NAVIGATION & LAYOUT (WITH ANIMATED MOBILE DRAWER)
   ========================================================================== */
function renderMainLayout() {
  const isTeacher = authUser.role === 'teacher';
  const student = !isTeacher ? appState.students.find(s => s.id === authUser.studentId) : null;

  const navItems = isTeacher ? [
    { id: 'dashboard', label: 'Teacher Dashboard', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>' },
    { id: 'entry', label: 'Grade Entry (3-Term)', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>' },
    { id: 'students', label: 'Student Records', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/>' },
    { id: 'subjects', label: 'Curriculum Subjects', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>' },
    { id: 'courses', label: 'Courses & Sections', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>' },
    { id: 'log', label: 'Dispatch Log', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>' },
    { id: 'settings', label: 'Portal Settings', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>' }
  ] : [
    { id: 'dashboard', label: 'My Grades Dashboard', icon: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>' }
  ];

  return `
    <div class="flex flex-col md:flex-row h-screen overflow-hidden relative">
      <!-- Mobile Top Navigation Bar -->
      <div class="md:hidden flex items-center justify-between p-4 glass-sidebar border-b border-slate-800 flex-shrink-0 z-20">
        <div class="flex items-center gap-2">
          ${getUASealSVG("w-7 h-7")}
          <h2 class="font-black text-xs text-brand-500 dark:text-amber-400">UA GradeFlow</h2>
        </div>
        <button type="button" onclick="toggleMobileMenu()" class="p-2 rounded-xl bg-slate-800 text-slate-200">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
        </button>
      </div>

      <!-- Animated Sidebar Drawer -->
      <aside id="appSidebar" class="mobile-closed md:flex md:w-64 glass-sidebar flex-col justify-between p-4 flex-shrink-0 shadow-2xl">
        <div class="space-y-6">
          <div class="flex items-center justify-between px-2">
            <div class="flex items-center gap-3">
              ${getUASealSVG("w-9 h-9")}
              <div>
                <h2 class="font-black text-sm text-brand-500 dark:text-amber-400 leading-tight">UA GradeFlow</h2>
                <p class="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase">Academic System</p>
              </div>
            </div>
            <button type="button" onclick="toggleMobileMenu()" class="md:hidden p-2 rounded-xl text-slate-400 hover:text-white bg-slate-800/80">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <nav class="space-y-1">
            ${navItems.map(item => `
              <button type="button" onclick="switchPage('${item.id}'); if(window.innerWidth < 768) toggleMobileMenu();" 
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-xs transition-all ${uiState.activePage === item.id ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">${item.icon}</svg>
                <span>${item.label}</span>
              </button>
            `).join('')}
          </nav>
        </div>

        <div class="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <button type="button" onclick="toggleTheme()" class="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-200/70 dark:bg-slate-800/75 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all">
            <span class="flex items-center gap-2">
              <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                ${uiState.darkMode 
                  ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>'
                  : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>'}
              </svg>
              <span>${uiState.darkMode ? 'Light Theme' : 'Dark Theme'}</span>
            </span>
            <span class="text-[10px] uppercase tracking-wider font-extrabold opacity-60">${uiState.darkMode ? 'ON' : 'OFF'}</span>
          </button>

          <div class="flex items-center gap-3 px-2">
            <div class="w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-extrabold text-xs flex items-center justify-center">
              ${isTeacher ? authUser.name.replace(/^(Prof\.|Dr\.|Mr\.|Ms\.|Mrs\.)\s+/i,'').split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase() : (student ? student.name.split(' ').map(n=>n[0]).slice(0,2).join('') : 'ST')}
            </div>
            <div class="overflow-hidden">
              <p class="text-xs font-bold truncate text-slate-800 dark:text-slate-200">${isTeacher ? authUser.name : (student ? student.name : 'Student')}</p>
              <p class="text-[10px] text-slate-500 truncate capitalize">${authUser.role}</p>
            </div>
          </div>

          <button type="button" onclick="setAuth(null)" class="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-bold transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      <main class="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 space-y-6">
        ${renderActivePage()}
      </main>
    </div>
  `;
}

function switchPage(pageId) {
  uiState.activePage = pageId;
  renderApp();
}

function toggleMobileMenu() {
  const sidebar = document.getElementById('appSidebar');
  if (sidebar) {
    if (sidebar.classList.contains('mobile-closed')) {
      sidebar.classList.remove('mobile-closed');
      sidebar.classList.add('mobile-open');
    } else {
      sidebar.classList.remove('mobile-open');
      sidebar.classList.add('mobile-closed');
    }
  }
}

function renderActivePage() {
  if (authUser.role === 'student') {
    return renderStudentDashboard();
  }

  switch (uiState.activePage) {
    case 'dashboard': return renderTeacherDashboard();
    case 'entry': return renderGradeEntryPage();
    case 'students': return renderStudentsPage();
    case 'subjects': return renderSubjectsPage();
    case 'courses': return renderCoursesSectionsPage();
    case 'log': return renderLogPage();
    case 'settings': return renderSettingsPage();
    default: return renderTeacherDashboard();
  }
}

/* ==========================================================================
   7. TEACHER DASHBOARD VIEW
   ========================================================================== */
function renderTeacherDashboard() {
  const studs = appState.students.filter(s => 
    (uiState.dashFilter.course === 'all' || s.course === uiState.dashFilter.course) &&
    (uiState.dashFilter.section === 'all' || s.section === uiState.dashFilter.section)
  );

  const summaries = studs.map(st => ({ student: st, summary: getStudentSummary(st) }));
  
  let totalPassed = 0, totalFailed = 0, totalInc = 0;
  summaries.forEach(s => {
    totalPassed += s.summary.passedCount;
    totalFailed += s.summary.failedCount;
    totalInc += s.summary.incCount;
  });

  const totalGraded = totalPassed + totalFailed;
  const passRate = totalGraded > 0 ? Math.round((totalPassed / totalGraded) * 100) : 0;
  
  const validGwas = summaries.map(s => s.summary.gwa).filter(g => g !== null);
  const avgGwa = validGwas.length ? validGwas.reduce((a,b)=>a+b,0) / validGwas.length : null;
  const deansListCount = summaries.filter(s => s.summary.isDeansLister).length;

  return `
    <div class="space-y-6">
      <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl">
        <div>
          <h1 class="text-xl font-black text-slate-800 dark:text-slate-100">Teacher Dashboard</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Overview of class performance, pass rates, and student standings.</p>
        </div>
        <div class="flex items-center gap-3 w-full md:w-auto">
          <select id="dashFilterCourse" onchange="updateDashFilterCourse(this.value)" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
            <option value="all">All Courses</option>
            ${appState.courses.map(c => `<option value="${c.code}" ${uiState.dashFilter.course === c.code ? 'selected' : ''}>${c.code}</option>`).join('')}
          </select>
          <select id="dashFilterSection" onchange="updateDashFilterSection(this.value)" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
            <option value="all">All Sections</option>
            ${appState.sections.map(s => `<option value="${s.id}" ${uiState.dashFilter.section === s.id ? 'selected' : ''}>${s.id}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="glass-panel p-5 rounded-2xl relative overflow-hidden">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Pass Rate</span>
            <span class="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </span>
          </div>
          <div class="mt-4">
            <div class="text-2xl font-black text-slate-900 dark:text-white">${passRate}%</div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${totalPassed} passed of ${totalGraded} graded subjects</p>
          </div>
        </div>

        <div class="glass-panel p-5 rounded-2xl relative overflow-hidden">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Average GWA</span>
            <span class="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            </span>
          </div>
          <div class="mt-4">
            <div class="text-2xl font-black text-slate-900 dark:text-white">${formatGwa(avgGwa)}</div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Weighted average across enrolled students</p>
          </div>
        </div>

        <div class="glass-panel p-5 rounded-2xl relative overflow-hidden">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Dean's Listers</span>
            <span class="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/></svg>
            </span>
          </div>
          <div class="mt-4">
            <div class="text-2xl font-black text-slate-900 dark:text-white">${deansListCount}</div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Qualifiers for Academic Excellence</p>
          </div>
        </div>

        <div class="glass-panel p-5 rounded-2xl relative overflow-hidden">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-500 uppercase tracking-wider">Incomplete / Deficient</span>
            <span class="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </span>
          </div>
          <div class="mt-4">
            <div class="text-2xl font-black text-slate-900 dark:text-white">${totalInc}</div>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">Subjects requiring pending grades</p>
          </div>
        </div>
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <h2 class="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Enrolled Roster Performance</h2>
        ${studs.length === 0 ? `
          <div class="text-center py-12 text-slate-500 text-xs">No students found matching current filters. Go to Student Records to add students.</div>
        ` : `
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                  <th class="py-3 px-4">Student ID & Name</th>
                  <th class="py-3 px-4">Course / Section</th>
                  <th class="py-3 px-4 text-center">Units Taken</th>
                  <th class="py-3 px-4 text-center">GWA</th>
                  <th class="py-3 px-4">Standing</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
                ${studs.map(st => {
                  const sm = getStudentSummary(st);
                  return `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td class="py-3 px-4">
                        <div class="font-bold text-slate-800 dark:text-slate-200">${st.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${st.id}</div>
                      </td>
                      <td class="py-3 px-4">
                        <span class="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold">${st.section}</span>
                      </td>
                      <td class="py-3 px-4 text-center font-bold">${sm.unitsEvaluated} / ${sm.totalUnits}</td>
                      <td class="py-3 px-4 text-center font-mono font-black text-brand-600 dark:text-amber-400">${formatGwa(sm.gwa)}</td>
                      <td class="py-3 px-4">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-${sm.standing.color}-500/10 text-${sm.standing.color}-600 dark:text-${sm.standing.color}-400">
                          ${sm.standing.label}
                        </span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;
}

function updateDashFilterCourse(val) {
  uiState.dashFilter.course = val;
  uiState.dashFilter.section = 'all';
  renderApp();
}

function updateDashFilterSection(val) {
  uiState.dashFilter.section = val;
  renderApp();
}

/* ==========================================================================
   8. GRADE ENTRY PAGE (PRELIM, MIDTERM, PRE-FINAL)
   ========================================================================== */
function renderGradeEntryPage() {
  const courseSubjects = appState.subjects.filter(s => s.course === uiState.entryFilter.course);
  const activeSub = courseSubjects.find(s => s.id === uiState.entryFilter.subject) || courseSubjects[0];
  const term = uiState.entryFilter.term || 'p';
  const view = uiState.entryFilter.view || 'summary';
  const termLabel = (TERMS.find(t => t.key === term) || TERMS[0]).label;
  const w = getWeights();
  const sectionStudents = appState.students.filter(s => s.section === uiState.entryFilter.section && (
    !uiState.entryFilter.search ||
    s.name.toLowerCase().includes(uiState.entryFilter.search.toLowerCase()) ||
    s.id.includes(uiState.entryFilter.search)
  ));
  const cw = activeSub ? getClassWork(uiState.entryFilter.section, activeSub.id, term, false) : null;

  const VIEWS = [
    { key: 'summary', label: 'Summary' },
    { key: 'quizzes', label: 'Quizzes' },
    { key: 'activities', label: 'Activities' },
    { key: 'exam', label: 'Exam' },
    { key: 'attendance', label: 'Attendance' }
  ];

  const field = 'px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400';
  const scoreCls = 'w-16 px-1.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-center focus:outline-none focus:border-amber-400';
  const pctTxt = v => (v === null || v === undefined ? '-' : v.toFixed(1) + '%');

  const emptyBox = msg => `<div class="text-center py-12 text-slate-500 text-xs">${msg}</div>`;

  // ---------- view bodies ----------
  const viewBody = () => {
    if (!activeSub) return emptyBox('Please select a valid subject.');
    if (sectionStudents.length === 0) {
      return emptyBox(`No students found in section <b>${uiState.entryFilter.section}</b> matching your search.`);
    }

    // ----- SUMMARY -----
    if (view === 'summary') {
      return `
        <div id="entryScroll" class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                <th class="py-3 px-3">Student Name</th>
                <th class="py-3 px-3 text-center">Quizzes</th>
                <th class="py-3 px-3 text-center">Activities</th>
                <th class="py-3 px-3 text-center">Exam</th>
                <th class="py-3 px-3 text-center">Attendance</th>
                <th class="py-3 px-3 text-center">${termLabel} Grade</th>
                <th class="py-3 px-3 text-center">Prelim</th>
                <th class="py-3 px-3 text-center">Midterm</th>
                <th class="py-3 px-3 text-center">Pre-Final</th>
                <th class="py-3 px-3 text-center">Avg %</th>
                <th class="py-3 px-3 text-center">Equiv</th>
                <th class="py-3 px-3 text-center">Status</th>
                <th class="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
              ${sectionStudents.map(st => {
                const rec = (appState.grades[st.id] || {})[activeSub.id] || { p: null, m: null, pf: null };
                const bd = computeTermBreakdown(st, activeSub.id, term);
                const calc = calculateSubjectGrade(rec);
                const statusColors = {
                  passed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                  failed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                  inc: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                  none: 'bg-slate-500/10 text-slate-500'
                };
                const two = (main, sub) => `<div class="font-mono font-semibold">${main}</div><div class="text-[10px] font-mono text-slate-400">${sub}</div>`;
                const tv = k => (rec[k] !== null && rec[k] !== undefined ? Number(rec[k]).toFixed(1) : '-');
                const cell = k => `<td class="py-3 px-3 text-center font-mono ${k === term ? 'font-black text-brand-600 dark:text-amber-400' : ''}">${tv(k)}</td>`;
                const a = bd.attendance;
                return `
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td class="py-3 px-3">
                      <div class="font-bold text-slate-800 dark:text-slate-200">${st.name}</div>
                      <div class="text-[10px] text-slate-400 font-mono">${st.id}</div>
                    </td>
                    <td class="py-3 px-3 text-center">${two(pctTxt(bd.quiz && bd.quiz.pct), bd.quiz ? `${bd.quiz.score}/${bd.quiz.total}` : '-')}</td>
                    <td class="py-3 px-3 text-center">${two(pctTxt(bd.act && bd.act.pct), bd.act ? `${bd.act.score}/${bd.act.total}` : '-')}</td>
                    <td class="py-3 px-3 text-center">${two(pctTxt(bd.exam && bd.exam.pct), bd.exam ? `${bd.exam.score}/${bd.exam.total}` : '-')}</td>
                    <td class="py-3 px-3 text-center">${two(pctTxt(a.pct), a.counted || a.excused ? `P${a.present} L${a.late} A${a.absent} E${a.excused}` : '-')}</td>
                    <td class="py-3 px-3 text-center font-mono font-black text-brand-600 dark:text-amber-400">${rec[term] !== null && rec[term] !== undefined ? Number(rec[term]).toFixed(1) + '%' : '-'}</td>
                    ${cell('p')}${cell('m')}${cell('pf')}
                    <td class="py-3 px-3 text-center font-mono font-semibold">${calc.pct !== null ? calc.pct.toFixed(1) + '%' : '-'}</td>
                    <td class="py-3 px-3 text-center font-mono font-black text-brand-600 dark:text-amber-400">${formatGradeEq(calc.eq)}</td>
                    <td class="py-3 px-3 text-center">
                      <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${statusColors[calc.status]}">${calc.status}</span>
                    </td>
                    <td class="py-3 px-3 text-right">
                      <button type="button" onclick="openTranscriptModal('${st.id}')" class="px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500 hover:text-white font-bold transition-all text-xs">PDF</button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        <p class="text-[11px] text-slate-500 dark:text-slate-400">A term grade appears once the class has at least one quiz, one activity, the exam and one attendance date recorded for the student. Use the tabs above to enter them.</p>`;
    }

    // ----- QUIZZES / ACTIVITIES -----
    if (view === 'quizzes' || view === 'activities') {
      const list = cw[view];
      const noun = view === 'quizzes' ? 'Quiz' : 'Activity';
      return `
        <form onsubmit="addClassItem(event, '${view}')" class="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div class="space-y-1 flex-1">
            <label class="text-xs font-bold text-slate-600 dark:text-slate-400">${noun} name</label>
            <input type="text" id="newItemName" required placeholder="${noun} ${list.length + 1}" class="w-full ${field}" />
          </div>
          <div class="space-y-1 w-full sm:w-32">
            <label class="text-xs font-bold text-slate-600 dark:text-slate-400">Total points</label>
            <input type="number" id="newItemTotal" required min="1" step="0.5" placeholder="50" class="w-full ${field} font-mono" />
          </div>
          <button type="submit" class="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-md transition-all">+ Add ${noun}</button>
        </form>
        ${list.length === 0 ? emptyBox(`No ${view} yet for ${termLabel}. Add one above, then enter each student's score.`) : `
          <div id="entryScroll" class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                  <th class="py-3 px-3">Student Name</th>
                  ${list.map(it => `
                    <th class="py-3 px-3 text-center">
                      <div class="normal-case text-slate-600 dark:text-slate-300 font-bold">${it.name}</div>
                      <div class="normal-case font-semibold opacity-70">/ ${it.total} pts</div>
                      <button type="button" onclick="removeClassItem('${view}', '${it.id}')" class="normal-case text-rose-500 hover:text-rose-700 font-bold">Remove</button>
                    </th>`).join('')}
                  <th class="py-3 px-3 text-center">${noun === 'Quiz' ? 'Quizzes' : 'Activities'} %</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
                ${sectionStudents.map(st => {
                  const rec = (appState.grades[st.id] || {})[activeSub.id] || {};
                  const items = rec.items || {};
                  const bd = computeTermBreakdown(st, activeSub.id, term);
                  const agg = view === 'quizzes' ? bd.quiz : bd.act;
                  return `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td class="py-3 px-3">
                        <div class="font-bold text-slate-800 dark:text-slate-200">${st.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${st.id}</div>
                      </td>
                      ${list.map(it => `
                        <td class="py-3 px-3 text-center">
                          <input id="i_${st.id}_${it.id}" type="number" min="0" max="${it.total}" step="0.5" value="${hasVal(items[it.id]) ? items[it.id] : ''}" onchange="setItemScore('${st.id}', '${activeSub.id}', '${it.id}', this.value, ${it.total})" class="${scoreCls}" />
                        </td>`).join('')}
                      <td class="py-3 px-3 text-center font-mono font-black text-brand-600 dark:text-amber-400">${agg ? agg.pct.toFixed(1) + '%' : '-'}</td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`}`;
    }

    // ----- EXAM -----
    if (view === 'exam') {
      const ex = cw.exam;
      return `
        <form onsubmit="setExamTotal(event)" class="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div class="space-y-1 w-full sm:w-48">
            <label class="text-xs font-bold text-slate-600 dark:text-slate-400">${termLabel} exam total points</label>
            <input type="number" id="examTotalInput" required min="1" step="0.5" value="${ex ? ex.total : ''}" placeholder="100" class="w-full ${field} font-mono" />
          </div>
          <button type="submit" class="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-md transition-all">${ex ? 'Update Total' : '+ Set Exam'}</button>
          ${ex ? `<button type="button" onclick="removeExam()" class="px-4 py-2.5 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white font-bold text-xs transition-all">Remove Exam</button>` : ''}
        </form>
        ${!ex ? emptyBox(`No exam set for ${termLabel}. Enter the total points above, then record each student's score.`) : `
          <div id="entryScroll" class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                  <th class="py-3 px-3">Student Name</th>
                  <th class="py-3 px-3 text-center">Exam score<div class="normal-case font-semibold opacity-70">/ ${ex.total} pts</div></th>
                  <th class="py-3 px-3 text-center">Exam %</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
                ${sectionStudents.map(st => {
                  const rec = (appState.grades[st.id] || {})[activeSub.id] || {};
                  const items = rec.items || {};
                  const bd = computeTermBreakdown(st, activeSub.id, term);
                  return `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td class="py-3 px-3">
                        <div class="font-bold text-slate-800 dark:text-slate-200">${st.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${st.id}</div>
                      </td>
                      <td class="py-3 px-3 text-center">
                        <input id="i_${st.id}_${ex.id}" type="number" min="0" max="${ex.total}" step="0.5" value="${hasVal(items[ex.id]) ? items[ex.id] : ''}" onchange="setItemScore('${st.id}', '${activeSub.id}', '${ex.id}', this.value, ${ex.total})" class="${scoreCls}" />
                      </td>
                      <td class="py-3 px-3 text-center font-mono font-black text-brand-600 dark:text-amber-400">${bd.exam ? bd.exam.pct.toFixed(1) + '%' : '-'}</td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`}`;
    }

    // ----- ATTENDANCE -----
    const dates = cw.dates;
    return `
      <form onsubmit="addAttendanceDate(event)" class="flex flex-col sm:flex-row gap-3 sm:items-end">
        <div class="space-y-1 w-full sm:w-52">
          <label class="text-xs font-bold text-slate-600 dark:text-slate-400">Class date</label>
          <input type="date" id="newAttDate" required class="w-full ${field}" />
        </div>
        <button type="submit" class="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-md transition-all">+ Add Date</button>
        <p class="text-[11px] text-slate-500 dark:text-slate-400">☑ Checked = Present • Unchecked = Absent • L = Late (counts as present) • E = Excused (not counted). New dates start with everyone present.</p>
      </form>
      ${dates.length === 0 ? emptyBox(`No class dates yet for ${termLabel}. Add a date above, then mark each student.`) : `
        <div id="entryScroll" class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                <th class="py-3 px-3">Student Name</th>
                ${dates.map(d => `
                  <th class="py-3 px-3 text-center">
                    <div class="normal-case text-slate-600 dark:text-slate-300 font-bold">${fmtDate(d.date)}</div>
                    <button type="button" onclick="markAllPresent('${d.id}')" class="normal-case mt-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500 hover:text-white font-bold transition-all">✓ All present</button>
                    <span class="opacity-40">•</span>
                    <button type="button" onclick="removeAttendanceDate('${d.id}')" class="normal-case text-rose-500 hover:text-rose-700 font-bold">Remove</button>
                  </th>`).join('')}
                <th class="py-3 px-3 text-center">Attendance %</th>
                <th class="py-3 px-3 text-center">P / L / A / E</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
              ${sectionStudents.map(st => {
                const rec = (appState.grades[st.id] || {})[activeSub.id] || {};
                const att = rec.att || {};
                const a = computeTermBreakdown(st, activeSub.id, term).attendance;
                return `
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td class="py-3 px-3">
                      <div class="font-bold text-slate-800 dark:text-slate-200">${st.name}</div>
                      <div class="text-[10px] text-slate-400 font-mono">${st.id}</div>
                    </td>
                    ${dates.map(d => `
                      <td class="py-3 px-3 text-center">
                        <div class="inline-flex items-center gap-1.5">
                          <input id="a_${st.id}_${d.id}" type="checkbox" ${att[d.id] === 'P' || att[d.id] === 'L' ? 'checked' : ''} onchange="setAttendance('${st.id}', '${activeSub.id}', '${d.id}', this.checked ? 'P' : 'A')" class="w-5 h-5 accent-emerald-600 cursor-pointer" title="Checked = Present, unchecked = Absent" />
                          <button type="button" title="Late (counts as present)" onclick="setAttendance('${st.id}', '${activeSub.id}', '${d.id}', '${att[d.id] === 'L' ? 'P' : 'L'}')" class="w-5 h-5 rounded text-[10px] font-black ${att[d.id] === 'L' ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}">L</button>
                          <button type="button" title="Excused (not counted)" onclick="setAttendance('${st.id}', '${activeSub.id}', '${d.id}', '${att[d.id] === 'E' ? 'A' : 'E'}')" class="w-5 h-5 rounded text-[10px] font-black ${att[d.id] === 'E' ? 'bg-sky-500 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-400'}">E</button>
                        </div>
                      </td>`).join('')}
                    <td class="py-3 px-3 text-center font-mono font-black text-brand-600 dark:text-amber-400">${a.pct !== null ? a.pct.toFixed(1) + '%' : '-'}</td>
                    <td class="py-3 px-3 text-center font-mono text-slate-500">${a.present} / ${a.late} / ${a.absent} / ${a.excused}</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`}`;
  };

  return `
    <div class="space-y-6">
      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <div>
          <h1 class="text-xl font-black text-slate-800 dark:text-slate-100">3–Term Class Record</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Record quizzes, activities, exam scores and attendance by date. Students can see these (view only).</p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-600 dark:text-slate-400">Course</label>
            <select onchange="updateEntryCourse(this.value)" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
              ${appState.courses.map(c => `<option value="${c.code}" ${uiState.entryFilter.course === c.code ? 'selected' : ''}>${c.code} - ${c.name}</option>`).join('')}
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-600 dark:text-slate-400">Section</label>
            <select onchange="updateEntrySection(this.value)" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
              ${appState.sections.filter(s => s.course === uiState.entryFilter.course).map(s => `<option value="${s.id}" ${uiState.entryFilter.section === s.id ? 'selected' : ''}>${s.id}</option>`).join('')}
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-600 dark:text-slate-400">Subject</label>
            <select onchange="updateEntrySubject(this.value)" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
              ${courseSubjects.map(sub => `<option value="${sub.id}" ${uiState.entryFilter.subject === sub.id ? 'selected' : ''}>${sub.code} - ${sub.title} (${sub.type.toUpperCase()})</option>`).join('')}
            </select>
          </div>
        </div>

        ${activeSub ? `
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
            <div class="flex items-center gap-3">
              <span class="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${activeSub.type === 'major' ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}">${activeSub.type}</span>
              <div>
                <div class="text-sm font-black text-slate-800 dark:text-slate-100">${activeSub.title}</div>
                <div class="text-xs text-slate-400 font-mono">${activeSub.code} • ${activeSub.units} Units</div>
              </div>
            </div>
            <div class="w-full sm:w-72">
              <input type="text" placeholder="Search student by name or ID..." value="${uiState.entryFilter.search}" oninput="updateEntrySearch(this.value)" class="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
            </div>
          </div>

          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div class="flex rounded-xl bg-slate-200/80 dark:bg-slate-800/80 p-1 border border-slate-300 dark:border-slate-700/60 w-full md:w-auto">
              ${TERMS.map(t => `
                <button type="button" onclick="setEntryTerm('${t.key}')" class="flex-1 md:flex-none px-5 py-2 text-xs font-bold rounded-lg transition-all ${term === t.key ? 'bg-brand-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}">${t.label}</button>
              `).join('')}
            </div>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
              ${termLabel} grade = Class Standing <b>×${TERM_MULT[term].cs}</b> + Exam <b>×${TERM_MULT[term].ex}</b> <span class="opacity-70">(Class Standing = Quizzes ${w.quiz} : Activities ${w.activity} : Attendance ${w.attendance})</span>
              <span class="opacity-70">(change in Portal Settings)</span>
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            ${VIEWS.map(v => `
              <button type="button" onclick="setEntryView('${v.key}')" class="px-4 py-2 text-xs font-bold rounded-xl border transition-all ${view === v.key ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800'}">${v.label}</button>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-4">
        ${viewBody()}
      </div>
    </div>
  `;
}

function setEntryTerm(key) {
  uiState.entryFilter.term = key;
  renderApp();
}

function setEntryView(key) {
  uiState.entryFilter.view = key;
  renderApp();
}

function updateEntryCourse(val) {
  uiState.entryFilter.course = val;
  const firstSec = appState.sections.find(s => s.course === val);
  uiState.entryFilter.section = firstSec ? firstSec.id : '';
  const firstSub = appState.subjects.find(s => s.course === val);
  uiState.entryFilter.subject = firstSub ? firstSub.id : '';
  renderApp();
}

function updateEntrySection(val) {
  uiState.entryFilter.section = val;
  renderApp();
}

function updateEntrySubject(val) {
  uiState.entryFilter.subject = val;
  renderApp();
}

function updateEntrySearch(val) {
  uiState.entryFilter.search = val;
}

function rerenderKeepPosition() {
  const activeId = document.activeElement && document.activeElement.id;
  const main = document.querySelector('main');
  const mainTop = main ? main.scrollTop : 0;
  const sc = document.getElementById('entryScroll');
  const left = sc ? sc.scrollLeft : 0;
  renderApp();
  const main2 = document.querySelector('main');
  if (main2) main2.scrollTop = mainTop;
  const sc2 = document.getElementById('entryScroll');
  if (sc2) sc2.scrollLeft = left;
  if (activeId) {
    const el = document.getElementById(activeId);
    if (el) { el.focus(); if (el.select) el.select(); }
  }
}

function entryCtx() {
  const courseSubjects = appState.subjects.filter(s => s.course === uiState.entryFilter.course);
  const sub = courseSubjects.find(s => s.id === uiState.entryFilter.subject) || courseSubjects[0];
  return { section: uiState.entryFilter.section, subjectId: sub ? sub.id : null, term: uiState.entryFilter.term || 'p' };
}

function requireTeacher() {
  if (!isTeacherSession()) {
    showToast('Only teachers can edit grades.', 'error');
    return false;
  }
  return true;
}

function addClassItem(e, kind) {
  e.preventDefault();
  if (!requireTeacher()) return;
  const { section, subjectId, term } = entryCtx();
  if (!subjectId) return;
  const name = document.getElementById('newItemName').value.trim();
  const total = parseFloat(document.getElementById('newItemTotal').value);
  if (!name || isNaN(total) || total <= 0) {
    showToast('Enter a name and total points greater than 0.', 'error');
    return;
  }
  const cw = getClassWork(section, subjectId, term, true);
  cw[kind].push({ id: newItemId(kind === 'quizzes' ? 'q' : 'a'), name, total });
  syncClass(section, subjectId, term);
  saveState();
  rerenderKeepPosition();
  showToast(`${name} added.`, 'success');
}

function removeClassItem(kind, itemId) {
  if (!requireTeacher()) return;
  const { section, subjectId, term } = entryCtx();
  const cw = getClassWork(section, subjectId, term, true);
  const it = cw[kind].find(x => x.id === itemId);
  if (!it || !confirm(`Remove "${it.name}" and all student scores for it?`)) return;
  cw[kind] = cw[kind].filter(x => x.id !== itemId);
  appState.students.filter(st => st.section === section).forEach(st => {
    const rec = (appState.grades[st.id] || {})[subjectId];
    if (rec && rec.items) delete rec.items[itemId];
  });
  syncClass(section, subjectId, term);
  saveState();
  rerenderKeepPosition();
  showToast('Removed.', 'success');
}

function setExamTotal(e) {
  e.preventDefault();
  if (!requireTeacher()) return;
  const { section, subjectId, term } = entryCtx();
  if (!subjectId) return;
  const total = parseFloat(document.getElementById('examTotalInput').value);
  if (isNaN(total) || total <= 0) {
    showToast('Enter total points greater than 0.', 'error');
    return;
  }
  const cw = getClassWork(section, subjectId, term, true);
  if (cw.exam) cw.exam.total = total;
  else cw.exam = { id: newItemId('x'), total };
  syncClass(section, subjectId, term);
  saveState();
  rerenderKeepPosition();
  showToast('Exam saved.', 'success');
}

function removeExam() {
  if (!requireTeacher()) return;
  const { section, subjectId, term } = entryCtx();
  const cw = getClassWork(section, subjectId, term, true);
  if (!cw.exam || !confirm('Remove the exam and all student exam scores for this term?')) return;
  const exId = cw.exam.id;
  cw.exam = null;
  appState.students.filter(st => st.section === section).forEach(st => {
    const rec = (appState.grades[st.id] || {})[subjectId];
    if (rec && rec.items) delete rec.items[exId];
  });
  syncClass(section, subjectId, term);
  saveState();
  rerenderKeepPosition();
  showToast('Exam removed.', 'success');
}

function setItemScore(studentId, subjectId, itemId, rawVal, total) {
  if (!requireTeacher()) return;
  const { section, term } = entryCtx();
  const num = rawVal === '' ? null : parseFloat(rawVal);
  if (rawVal !== '' && (isNaN(num) || num < 0 || num > total)) {
    showToast(`Score must be between 0 and ${total}.`, 'error');
    setTimeout(rerenderKeepPosition, 0);
    return;
  }
  if (!appState.grades[studentId]) appState.grades[studentId] = {};
  const rec = appState.grades[studentId][subjectId] || (appState.grades[studentId][subjectId] = { p: null, m: null, pf: null });
  if (!rec.items) rec.items = {};
  if (num === null) delete rec.items[itemId];
  else rec.items[itemId] = num;

  const st = appState.students.find(s => s.id === studentId);
  if (st) syncTermGrade(st, subjectId, term);
  saveState();
  setTimeout(rerenderKeepPosition, 0);
  showToast('Saved', 'success');
}

function addAttendanceDate(e) {
  e.preventDefault();
  if (!requireTeacher()) return;
  const { section, subjectId, term } = entryCtx();
  if (!subjectId) return;
  const date = document.getElementById('newAttDate').value;
  if (!date) return;
  const cw = getClassWork(section, subjectId, term, true);
  if (cw.dates.some(d => d.date === date)) {
    showToast('That date is already added.', 'error');
    return;
  }
  const nd = { id: newItemId('d'), date };
  cw.dates.push(nd);
  appState.students.filter(st => st.section === section).forEach(st => {
    if (!appState.grades[st.id]) appState.grades[st.id] = {};
    const r = appState.grades[st.id][subjectId] || (appState.grades[st.id][subjectId] = { p: null, m: null, pf: null });
    if (!r.att) r.att = {};
    r.att[nd.id] = 'P';
  });
  cw.dates.sort((a, b) => a.date.localeCompare(b.date));
  syncClass(section, subjectId, term);
  saveState();
  rerenderKeepPosition();
  showToast(`${fmtDate(date)} added.`, 'success');
}

function removeAttendanceDate(dateId) {
  if (!requireTeacher()) return;
  const { section, subjectId, term } = entryCtx();
  const cw = getClassWork(section, subjectId, term, true);
  const d = cw.dates.find(x => x.id === dateId);
  if (!d || !confirm(`Remove ${fmtDate(d.date)} and every student's attendance mark for it?`)) return;
  cw.dates = cw.dates.filter(x => x.id !== dateId);
  appState.students.filter(st => st.section === section).forEach(st => {
    const rec = (appState.grades[st.id] || {})[subjectId];
    if (rec && rec.att) delete rec.att[dateId];
  });
  syncClass(section, subjectId, term);
  saveState();
  rerenderKeepPosition();
  showToast('Date removed.', 'success');
}

function setAttendance(studentId, subjectId, dateId, status) {
  if (!requireTeacher()) return;
  const { term } = entryCtx();
  if (status && !ATT_STATUS[status]) return;
  if (!appState.grades[studentId]) appState.grades[studentId] = {};
  const rec = appState.grades[studentId][subjectId] || (appState.grades[studentId][subjectId] = { p: null, m: null, pf: null });
  if (!rec.att) rec.att = {};
  if (status) rec.att[dateId] = status;
  else delete rec.att[dateId];

  const st = appState.students.find(s => s.id === studentId);
  if (st) syncTermGrade(st, subjectId, term);
  saveState();
  setTimeout(rerenderKeepPosition, 0);
  showToast('Saved', 'success');
}

function markAllPresent(dateId) {
  if (!requireTeacher()) return;
  const { section, subjectId, term } = entryCtx();
  let n = 0;
  appState.students.filter(st => st.section === section).forEach(st => {
    if (!appState.grades[st.id]) appState.grades[st.id] = {};
    const rec = appState.grades[st.id][subjectId] || (appState.grades[st.id][subjectId] = { p: null, m: null, pf: null });
    if (!rec.att) rec.att = {};
    if (rec.att[dateId] !== 'P') { rec.att[dateId] = 'P'; n++; }
  });
  syncClass(section, subjectId, term);
  saveState();
  rerenderKeepPosition();
  showToast(n ? `Marked ${n} student(s) present.` : 'Everyone is already present.', 'success');
}

/* ==========================================================================
   9. STUDENT RECORDS & CSV / MANUAL ENROLLMENT PAGE
   ========================================================================== */
function renderStudentsPage() {
  const selectedSection = uiState.studentsSectionFilter || (appState.sections[0] ? appState.sections[0].id : 'BSIT-1A');
  const sectionStudents = appState.students.filter(s => s.section === selectedSection && (
    !uiState.studentsSearch || 
    s.name.toLowerCase().includes(uiState.studentsSearch.toLowerCase()) || 
    s.id.includes(uiState.studentsSearch)
  ));

  const currentSecObj = appState.sections.find(s => s.id === selectedSection);
  const courseCode = currentSecObj ? currentSecObj.course : 'BSIT';

  return `
    <div class="space-y-6">
      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 class="text-xl font-black text-slate-800 dark:text-slate-100">Student Records & CSV Database</h1>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage student rosters or import/export section CSV databases.</p>
          </div>

          <div class="flex flex-col gap-2 w-full md:w-auto md:items-end">
            <select onchange="uiState.studentsSectionFilter = this.value; renderApp();" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
              ${appState.sections.map(s => `<option value="${s.id}" ${selectedSection === s.id ? 'selected' : ''}>${s.id} (${s.year || ''})</option>`).join('')}
            </select>
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 w-24">Students CSV</span>
              <button type="button" onclick="downloadRosterTemplate('${selectedSection}')" class="${BTN_GRAY}">Template</button>
              <button type="button" onclick="exportRosterCSV('${selectedSection}')" class="${BTN_BLUE}">Export</button>
              <label class="${BTN_GOLD}">Import<input type="file" accept=".csv" class="hidden" onchange="importRosterCSV(event, '${selectedSection}')" /></label>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 w-24">Grades CSV</span>
              <select onchange="uiState.csvTerm = this.value; renderApp();" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
                ${[['p', 'Prelim'], ['m', 'Midterm'], ['pf', 'Final (all terms)']].map(t => `<option value="${t[0]}" ${(uiState.csvTerm || 'p') === t[0] ? 'selected' : ''}>${t[1]}</option>`).join('')}
              </select>
              <button type="button" onclick="downloadGradesTemplate('${selectedSection}')" class="${BTN_GRAY}">Template</button>
              <button type="button" onclick="exportGradesCSV('${selectedSection}')" class="${BTN_BLUE}">Export</button>
              <label class="${BTN_GOLD}">Import<input type="file" accept=".csv" class="hidden" onchange="importGradesCSV(event, '${selectedSection}')" /></label>
            </div>
          </div>
        </div>
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <h2 class="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Enroll New Individual Student in ${selectedSection}</h2>
        <form onsubmit="handleManualStudentAdd(event, '${selectedSection}', '${courseCode}')" class="space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-600 dark:text-slate-400">School ID (10 digits)</label>
              <input type="text" id="mStudentId" required maxlength="10" placeholder="2026000101" class="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-600 dark:text-slate-400">Full Name</label>
              <input type="text" id="mStudentName" required placeholder="Juan Dela Cruz" class="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-600 dark:text-slate-400">Student Email</label>
              <input type="email" id="mStudentEmail" required placeholder="juan.delacruz@student.ua.edu.ph" class="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-600 dark:text-slate-400">Guardian Name & Email</label>
              <div class="flex gap-2">
                <input type="text" id="mGuardianName" required placeholder="Parent Name" class="w-1/2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
                <input type="email" id="mGuardianEmail" required placeholder="parent@example.com" class="w-1/2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
              </div>
            </div>
          </div>
          <div class="flex justify-end pt-2">
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-md transition-all">
              + Enroll Student
            </button>
          </div>
        </form>
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Enrolled Students in ${selectedSection} (${sectionStudents.length})</h2>
          <div class="w-72">
            <input type="text" placeholder="Search student..." value="${uiState.studentsSearch}" oninput="uiState.studentsSearch = this.value; renderApp();" class="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
          </div>
        </div>

        ${sectionStudents.length === 0 ? `
          <div class="text-center py-12 text-slate-500 text-xs">No students found in section <b>${selectedSection}</b>. Import a CSV roster or add a student above.</div>
        ` : `
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                  <th class="py-3 px-4">Student ID & Name</th>
                  <th class="py-3 px-4">Course / Section</th>
                  <th class="py-3 px-4">Student Email</th>
                  <th class="py-3 px-4">Guardian / Parent</th>
                  <th class="py-3 px-4">Student Password</th>
                  <th class="py-3 px-4">Parent PIN</th>
                  <th class="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
                ${sectionStudents.map(st => `
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td class="py-3 px-4">
                      <div class="font-bold text-slate-800 dark:text-slate-200">${st.name}</div>
                      <div class="text-[10px] text-slate-400 font-mono">${st.id}</div>
                    </td>
                    <td class="py-3 px-4">
                      <span class="px-2 py-0.5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold">${st.section}</span>
                    </td>
                    <td class="py-3 px-4 text-slate-600 dark:text-slate-300">${st.email}</td>
                    <td class="py-3 px-4">
                      <div class="font-semibold">${st.parent.name}</div>
                      <div class="text-[10px] text-slate-400">${st.parent.email}</div>
                    </td>
                    <td class="py-3 px-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">${st.password || '-'}</td>
                    <td class="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-400">${st.parent.pin}</td>
                    <td class="py-3 px-4 text-right space-x-2">
                      <button type="button" onclick="openTranscriptModal('${st.id}')" class="px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500 hover:text-white font-bold transition-all text-xs">
                        Transcript
                      </button>
                      <button type="button" onclick="resetStudentPassword('${st.id}')" class="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white font-bold transition-all text-xs">
                        Set Password
                      </button>
                      <button type="button" onclick="deleteStudent('${st.id}')" class="px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white font-bold transition-all text-xs">
                        Delete
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    </div>
  `;
}

function handleManualStudentAdd(e, sectionId, courseCode) {
  e.preventDefault();
  const id = document.getElementById('mStudentId').value.trim();
  const name = document.getElementById('mStudentName').value.trim();
  const email = document.getElementById('mStudentEmail').value.trim();
  const pName = document.getElementById('mGuardianName').value.trim();
  const pEmail = document.getElementById('mGuardianEmail').value.trim();

  if (!/^\d{10}$/.test(id)) {
    showToast('School ID must be exactly 10 digits.', 'error');
    return;
  }

  if (appState.students.some(s => s.id === id)) {
    showToast('Student ID already exists in database.', 'error');
    return;
  }

  const pin = String(100000 + Math.floor(Math.random() * 900000));
  const newStudent = {
    id,
    name,
    course: courseCode,
    section: sectionId,
    email,
    password: String(100000 + Math.floor(Math.random() * 900000)),
    parent: { name: pName, email: pEmail, pin }
  };

  appState.students.push(newStudent);
  appState.grades[id] = {};
  saveState();
  renderApp();
  showToast(`Successfully enrolled ${name} into ${sectionId}!`, 'success');
}

function resetStudentPassword(id) {
  const st = appState.students.find(s => s.id === id);
  if (!st) return;
  const input = prompt(`Set a new password for ${st.name}.\nLeave blank to generate a random one.`, '');
  if (input === null) return;
  const pw = input.trim() || String(100000 + Math.floor(Math.random() * 900000));
  st.password = pw;
  saveState();
  renderApp();
  showToast(`New password for ${st.name}: ${pw}`, 'success');
}

function deleteStudent(id) {
  if (!confirm('Are you sure you want to delete this student and their grades?')) return;
  appState.students = appState.students.filter(s => s.id !== id);
  delete appState.grades[id];
  saveState();
  renderApp();
  showToast('Student record deleted.', 'success');
}

/* ==========================================================================
   10. COURSES & SECTIONS MANAGEMENT PAGE
   ========================================================================== */
function renderCoursesSectionsPage() {
  return `
    <div class="space-y-6">
      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <div>
          <h1 class="text-xl font-black text-slate-800 dark:text-slate-100">Courses & Sections Management</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Add new academic courses (e.g. BS in Nursing) and sections with year levels.</p>
        </div>

        <form onsubmit="handleAddCourse(event)" class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-600 dark:text-slate-400">Course Code</label>
            <input type="text" id="newCourseCode" required placeholder="BSN" class="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400 uppercase font-mono" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-600 dark:text-slate-400">Course Full Name</label>
            <input type="text" id="newCourseName" required placeholder="BS in Nursing" class="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
          </div>
          <div class="flex items-end">
            <button type="submit" class="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-md transition-all">
              + Add Course
            </button>
          </div>
        </form>
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <h2 class="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Add Section & Year Level</h2>
        <form onsubmit="handleAddSection(event)" class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-600 dark:text-slate-400">Select Course</label>
            <select id="newSecCourse" class="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
              ${appState.courses.map(c => `<option value="${c.code}">${c.code} - ${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-600 dark:text-slate-400">Section ID</label>
            <input type="text" id="newSecId" required placeholder="BSN-3A" class="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400 font-mono uppercase" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-600 dark:text-slate-400">Year Level</label>
            <input type="text" id="newSecYear" required placeholder="3rd Year" class="w-full px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
          </div>
          <div class="sm:col-span-3 flex justify-end">
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all">
              + Add Section
            </button>
          </div>
        </form>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="glass-panel p-6 rounded-2xl space-y-4">
          <h3 class="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Active Courses (${appState.courses.length})</h3>
          <div class="space-y-2">
            ${appState.courses.map(c => `
              <div class="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div>
                  <span class="font-mono font-bold text-brand-600 dark:text-amber-400">${c.code}</span>
                  <span class="text-xs text-slate-700 dark:text-slate-300 ml-2">${c.name}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="glass-panel p-6 rounded-2xl space-y-4">
          <h3 class="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Active Sections & Year Levels (${appState.sections.length})</h3>
          <div class="space-y-2">
            ${appState.sections.map(s => `
              <div class="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                <div>
                  <span class="font-mono font-bold text-brand-600 dark:text-amber-400">${s.id}</span>
                  <span class="text-xs text-slate-500 ml-2">(${s.year || 'General'})</span>
                </div>
                <button type="button" onclick="handleRemoveSection('${s.id}')" class="text-rose-500 hover:text-rose-700 text-xs font-bold">Delete</button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function handleAddCourse(e) {
  e.preventDefault();
  const code = document.getElementById('newCourseCode').value.trim().toUpperCase();
  const name = document.getElementById('newCourseName').value.trim();

  if (appState.courses.some(c => c.code === code)) {
    showToast('Course code already exists.', 'error');
    return;
  }

  appState.courses.push({ code, name });
  saveState();
  renderApp();
  showToast(`Course ${code} - ${name} added successfully!`, 'success');
}

function handleAddSection(e) {
  e.preventDefault();
  const course = document.getElementById('newSecCourse').value;
  const id = document.getElementById('newSecId').value.trim().toUpperCase();
  const year = document.getElementById('newSecYear').value.trim();

  if (appState.sections.some(s => s.id === id)) {
    showToast('Section ID already exists.', 'error');
    return;
  }

  appState.sections.push({ id, course, year });
  saveState();
  renderApp();
  showToast(`Section ${id} (${year}) added successfully!`, 'success');
}

function handleRemoveSection(id) {
  if (!confirm(`Remove section ${id}?`)) return;
  appState.sections = appState.sections.filter(s => s.id !== id);
  saveState();
  renderApp();
  showToast(`Section ${id} removed.`, 'success');
}

/* ==========================================================================
   11. CURRICULUM SUBJECTS PAGE
   ========================================================================== */
function renderSubjectsPage() {
  uiState.subjCourse = uiState.subjCourse || 'BSIT';
  const subs = appState.subjects.filter(s => s.course === uiState.subjCourse);

  return `
    <div class="space-y-6">
      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-black text-slate-800 dark:text-slate-100">Curriculum Subjects</h1>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage major and minor subjects for each course.</p>
          </div>
          <select onchange="uiState.subjCourse = this.value; renderApp();" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
            ${appState.courses.map(c => `<option value="${c.code}" ${uiState.subjCourse === c.code ? 'selected' : ''}>${c.code}</option>`).join('')}
          </select>
        </div>

        <form onsubmit="handleAddSubject(event)" class="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
          <input type="text" id="sCode" required placeholder="Subject Code (e.g. IT105)" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono uppercase text-slate-800 dark:text-slate-100" />
          <input type="text" id="sTitle" required placeholder="Subject Title" class="sm:col-span-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100" />
          <select id="sType" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200">
            <option value="major">Major</option>
            <option value="minor">Minor (Gen Ed)</option>
          </select>
          <div class="flex gap-2">
            <input type="number" id="sUnits" required min="1" max="6" value="3" class="w-16 px-2 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-center font-mono text-slate-800 dark:text-slate-100" />
            <button type="submit" class="flex-1 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-md">Add</button>
          </div>
        </form>
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <h2 class="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Curriculum for ${uiState.subjCourse} (${subs.length} Subjects)</h2>
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                <th class="py-3 px-4">Code</th>
                <th class="py-3 px-4">Subject Title</th>
                <th class="py-3 px-4 text-center">Units</th>
                <th class="py-3 px-4 text-center">Type</th>
                <th class="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
              ${subs.map(s => `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td class="py-3 px-4 font-mono font-bold text-brand-600 dark:text-amber-400">${s.code}</td>
                  <td class="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">${s.title}</td>
                  <td class="py-3 px-4 text-center font-mono">${s.units}</td>
                  <td class="py-3 px-4 text-center">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${s.type === 'major' ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}">
                      ${s.type}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <button type="button" onclick="handleRemoveSubject('${s.id}')" class="text-rose-500 hover:text-rose-700 text-xs font-bold">Remove</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function handleAddSubject(e) {
  e.preventDefault();
  const course = uiState.subjCourse;
  const code = document.getElementById('sCode').value.trim().toUpperCase();
  const title = document.getElementById('sTitle').value.trim();
  const type = document.getElementById('sType').value;
  const units = parseInt(document.getElementById('sUnits').value);

  const id = `${course}-${code}`;
  if (appState.subjects.some(s => s.id === id)) {
    showToast('Subject code already exists in this course.', 'error');
    return;
  }

  appState.subjects.push({ id, course, code, title, type, units });
  saveState();
  renderApp();
  showToast(`Subject ${code} added successfully!`, 'success');
}

function handleRemoveSubject(id) {
  if (!confirm('Remove this subject?')) return;
  appState.subjects = appState.subjects.filter(s => s.id !== id);
  saveState();
  renderApp();
  showToast('Subject removed.', 'success');
}

/* ==========================================================================
   12. DISPATCH LOG PAGE
   ========================================================================== */
function renderLogPage() {
  return `
    <div class="glass-panel p-6 rounded-2xl space-y-4">
      <h1 class="text-xl font-black text-slate-800 dark:text-slate-100">Transcript Dispatch Log</h1>
      <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">History of password-protected transcripts dispatched to students and guardians.</p>

      ${appState.log.length === 0 ? `
        <div class="text-center py-16 text-slate-500 text-xs">No transcripts dispatched yet. Click "Transcript" on any student record to send.</div>
      ` : `
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                <th class="py-3 px-4">Timestamp</th>
                <th class="py-3 px-4">Student</th>
                <th class="py-3 px-4">Recipient</th>
                <th class="py-3 px-4">Password Protection</th>
                <th class="py-3 px-4">File Name</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
              ${appState.log.map(l => `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td class="py-3 px-4 text-slate-500">${l.when}</td>
                  <td class="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">${l.name} <span class="text-[10px] text-slate-400 font-mono">(${l.sid})</span></td>
                  <td class="py-3 px-4">${l.to}</td>
                  <td class="py-3 px-4"><span class="px-2 py-0.5 rounded bg-brand-500/10 text-brand-600 font-mono font-semibold">${l.pwLabel}</span></td>
                  <td class="py-3 px-4 font-mono text-slate-500">${l.file}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

/* ==========================================================================
   13. SETTINGS PAGE
   ========================================================================== */
function renderSettingsPage() {
  const s = appState.settings;
  return `
    <div class="space-y-6 max-w-2xl">
      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <h1 class="text-xl font-black text-slate-800 dark:text-slate-100">Portal Settings</h1>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize institutional details shown on official PDF transcripts.</p>

        <form onsubmit="handleSaveSettings(event)" class="space-y-4 pt-2">
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">School Name</label>
            <input type="text" id="setSchool" required value="${s.school}" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Registrar / Professor Name</label>
            <input type="text" id="setRegistrar" required value="${s.registrar}" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Active Term</label>
            <input type="text" id="setTerm" required value="${s.term}" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
          </div>
          <button type="submit" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all">
            Save Settings
          </button>
        </form>
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-3">
        <div>
          <h2 class="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Student Grade Release</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Prelim shows only Prelim grades, Midterm shows only Midterm grades, and Pre-Final shows all grades with GWA, standing and the PDF transcript.</p>
        </div>
        <select onchange="handleReleasedTerm(this.value)" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
          ${[['p', 'Prelim period'], ['m', 'Midterm period'], ['pf', 'Finals (show all grades)']].map(o =>
            `<option value="${o[0]}" ${releasedTerm() === o[0] ? 'selected' : ''}>${o[1]}</option>`).join('')}
        </select>
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <div>
          <h2 class="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Grade Computation Weights</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">These set how Quizzes, Activities and Attendance are split inside Class Standing (relative weights). Prelim & Midterm = Class Standing ×2 + Exam ×1; Pre-Final = Class Standing ×1 + Exam ×2. Saving recomputes all term grades.</p>
        </div>
        <form onsubmit="handleSaveWeights(event)" class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Quizzes %</label>
            <input type="number" id="wQuiz" min="0" max="100" step="1" required value="${s.weights.quiz}" class="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Activities %</label>
            <input type="number" id="wActivity" min="0" max="100" step="1" required value="${s.weights.activity}" class="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
          </div>
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Attendance %</label>
            <input type="number" id="wAttendance" min="0" max="100" step="1" required value="${s.weights.attendance}" class="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
          </div>
          <div class="col-span-1 sm:col-span-3 flex justify-end">
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all">Save Weights</button>
          </div>
        </form>
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <div>
          <h2 class="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Teacher Accounts</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Add faculty members who can sign in to the Teacher Portal.</p>
        </div>
        <form onsubmit="handleAddTeacher(event)" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="text" id="newTName" required placeholder="Full name (e.g. Prof. Juan Dela Cruz)" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
          <input type="email" id="newTEmail" placeholder="Email (optional)" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
          <input type="text" id="newTUser" required placeholder="Username" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
          <input type="text" id="newTPass" required minlength="6" placeholder="Password (min 6 characters)" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" />
          <div class="sm:col-span-2 flex justify-end">
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-md transition-all">+ Add Teacher</button>
          </div>
        </form>
        <div class="space-y-2">
          ${(appState.teachers || []).map(t => `
            <div class="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div>
                <div class="text-xs font-bold text-slate-800 dark:text-slate-200">${t.name}</div>
                <div class="text-[10px] text-slate-500 font-mono">${t.username}${t.email ? ' • ' + t.email : ''}</div>
              </div>
              ${t.username === authUser.username ? '<span class="text-[10px] font-bold text-emerald-600">You</span>' : `<button type="button" onclick="handleRemoveTeacher('${t.username}')" class="text-rose-500 hover:text-rose-700 text-xs font-bold">Remove</button>`}
            </div>
          `).join('')}
        </div>
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-3">
        <h2 class="text-sm font-black text-rose-600 uppercase tracking-wider">Danger Zone</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400">Resetting the database clears all students, sections, and grade records back to a clean state.</p>
        <button type="button" onclick="if(confirm('Reset all data?')) resetStateToDefault();" class="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white font-bold text-xs transition-all">
          Reset Database
        </button>
      </div>
    </div>
  `;
}

function handleReleasedTerm(val) {
  if (!isTeacherSession()) return;
  appState.settings.releasedTerm = val;
  saveState();
  renderApp();
  showToast('Student view updated.', 'success');
}

function handleAddTeacher(e) {
  e.preventDefault();
  const name = document.getElementById('newTName').value.trim();
  const email = document.getElementById('newTEmail').value.trim();
  const username = document.getElementById('newTUser').value.trim();
  const password = document.getElementById('newTPass').value;
  if (appState.teachers.some(t => t.username.toLowerCase() === username.toLowerCase())) {
    showToast('That username is already taken.', 'error');
    return;
  }
  appState.teachers.push({ username, password, name, email });
  saveState();
  renderApp();
  showToast(`Teacher account for ${name} created!`, 'success');
}

function handleRemoveTeacher(username) {
  if (!confirm(`Remove teacher account "${username}"?`)) return;
  appState.teachers = appState.teachers.filter(t => t.username !== username);
  saveState();
  renderApp();
  showToast('Teacher account removed.', 'success');
}

function handleSaveWeights(e) {
  e.preventDefault();
  if (!isTeacherSession()) return;
  const quiz = parseFloat(document.getElementById('wQuiz').value);
  const activity = parseFloat(document.getElementById('wActivity').value);
  const exam = (appState.settings.weights || {}).exam || 0;
  const attendance = parseFloat(document.getElementById('wAttendance').value);
  const all = [quiz, activity, exam, attendance];
  if (all.some(v => isNaN(v) || v < 0)) {
    showToast('Enter valid percentages.', 'error');
    return;
  }
  if (quiz + activity + attendance <= 0) {
    showToast('Enter at least one weight above 0.', 'error');
    return;
  }
  appState.settings.weights = { quiz, activity, exam, attendance };
  recomputeAllTermGrades();
  saveState();
  renderApp();
  showToast('Weights saved. All term grades recomputed.', 'success');
}

function handleSaveSettings(e) {
  e.preventDefault();
  appState.settings = {
    ...appState.settings,
    school: document.getElementById('setSchool').value.trim(),
    registrar: document.getElementById('setRegistrar').value.trim(),
    term: document.getElementById('setTerm').value.trim()
  };
  saveState();
  renderApp();
  showToast('Settings saved successfully!', 'success');
}

/* ==========================================================================
   14. STUDENT DASHBOARD VIEW
   ========================================================================== */
function renderStudentDashboard() {
  const student = appState.students.find(s => s.id === authUser.studentId);
  if (!student) return `<div class="p-8 text-center text-xs text-slate-500">Student account not found in database.</div>`;

  // Released-term gating: Prelim/Midterm show only that term; Finals show everything
  const fin = finalsReleased();
  if (!visibleTerms().includes(uiState.studentTerm)) uiState.studentTerm = releasedTerm();
  const lockTxt = '<div class="text-sm font-bold text-slate-400 mt-2">Available after Finals</div>';

  const sm = getStudentSummary(student);
  const classData = getStudentClassData(student);

  return `
    <div class="space-y-6 max-w-5xl mx-auto">
      <div class="glass-panel p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <div class="w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 font-black text-lg flex items-center justify-center shadow-lg">
            ${student.name.split(' ').map(n=>n[0]).slice(0,2).join('')}
          </div>
          <div>
            <h1 class="text-xl font-black text-slate-900 dark:text-white">${student.name}</h1>
            <p class="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">${student.id} • ${student.section} • ${student.email}</p>
          </div>
        </div>

        ${fin ? `<button type="button" onclick="openTranscriptModal('${student.id}')" class="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span>Download PDF Transcript</span>
        </button>` : `<span class="text-xs font-bold text-slate-400">PDF transcript available after Finals</span>`}
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="glass-panel p-5 rounded-2xl">
          <span class="text-xs font-bold text-slate-500 uppercase">General Weighted Average</span>
          ${fin ? `<div class="text-3xl font-black text-brand-600 dark:text-amber-400 mt-2 font-mono">${formatGwa(sm.gwa)}</div>
          <p class="text-xs text-slate-400 mt-1">1.00 Highest • 3.00 Passing</p>` : lockTxt}
        </div>

        <div class="glass-panel p-5 rounded-2xl">
          <span class="text-xs font-bold text-slate-500 uppercase">Academic Standing</span>
          ${fin ? `<div class="mt-2"><span class="px-3 py-1 rounded-full text-xs font-bold bg-${sm.standing.color}-500/10 text-${sm.standing.color}-600 dark:text-${sm.standing.color}-400">${sm.standing.label}</span></div>
          <p class="text-xs text-slate-400 mt-2">Current term evaluation</p>` : lockTxt}
        </div>

        <div class="glass-panel p-5 rounded-2xl">
          <span class="text-xs font-bold text-slate-500 uppercase">Subjects Passed</span>
          ${fin ? `<div class="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">${sm.passedCount} / ${sm.rows.length}</div>
          <p class="text-xs text-slate-400 mt-1">${sm.failedCount} failed, ${sm.incCount} incomplete</p>` : lockTxt}
        </div>

        <div class="glass-panel p-5 rounded-2xl">
          <span class="text-xs font-bold text-slate-500 uppercase">Credited Units</span>
          ${fin ? `<div class="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">${sm.unitsEvaluated} / ${sm.totalUnits}</div>
          <p class="text-xs text-slate-400 mt-1">Successfully earned units</p>` : lockTxt}
        </div>
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <h2 class="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">${fin ? 'Official 3–Term Grade Breakdown' : (TERMS.find(t => t.key === releasedTerm()).label + ' Grades')}</h2>
        <div id="gradeCanvasWrap" class="overflow-x-auto protected-grades" oncontextmenu="return false" ondragstart="return false">
          <canvas id="gradeCanvas" role="img" aria-label="Official grade breakdown (image)" oncontextmenu="return false"></canvas>
        </div>
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-5">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Class Record</h2>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Class Standing (quizzes, activities, attendance) ×${TERM_MULT[uiState.studentTerm || 'p'].cs} + Exam ×${TERM_MULT[uiState.studentTerm || 'p'].ex} • View only</p>
          </div>
          <div class="flex rounded-xl bg-slate-200/80 dark:bg-slate-800/80 p-1 border border-slate-300 dark:border-slate-700/60 w-full md:w-auto">
            ${TERMS.filter(t => visibleTerms().includes(t.key)).map(t => `
              <button type="button" onclick="setStudentTerm('${t.key}')" class="flex-1 md:flex-none px-5 py-2 text-xs font-bold rounded-lg transition-all ${uiState.studentTerm === t.key ? 'bg-brand-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}">${t.label}</button>
            `).join('')}
          </div>
        </div>

        <div class="space-y-2">
          <h3 class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">All Subjects — ${(TERMS.find(t => t.key === uiState.studentTerm) || TERMS[0]).label}</h3>
          <div id="stSummaryWrap" class="overflow-x-auto protected-grades" oncontextmenu="return false" ondragstart="return false">
            <canvas id="stSummaryCanvas" role="img" aria-label="Term summary per subject (image)" oncontextmenu="return false"></canvas>
          </div>
        </div>

        <div class="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 class="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">Details per Subject</h3>
            <select onchange="setStudentSubject(this.value)" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
              ${classData.subjects.map(sub => `<option value="${sub.id}" ${classData.subjectId === sub.id ? 'selected' : ''}>${sub.code} - ${sub.title}</option>`).join('')}
            </select>
          </div>

          ${[
            { id: 'Quiz', title: 'Quizzes', n: classData.detail.quizzes.length, none: 'No quizzes recorded yet.' },
            { id: 'Act', title: 'Activities', n: classData.detail.activities.length, none: 'No activities recorded yet.' },
            { id: 'Exam', title: 'Exam', n: classData.detail.exam.length, none: 'No exam recorded yet.' },
            { id: 'Att', title: 'Attendance', n: classData.detail.attendance.length, none: 'No attendance recorded yet.' }
          ].map(b => `
            <div class="space-y-2">
              <h4 class="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">${b.title}</h4>
              ${b.n === 0
                ? `<p class="text-xs text-slate-500 dark:text-slate-400 px-1">${b.none}</p>`
                : `<div id="st${b.id}Wrap" class="overflow-x-auto protected-grades" oncontextmenu="return false" ondragstart="return false">
                     <canvas id="st${b.id}Canvas" role="img" aria-label="${b.title} (image)" oncontextmenu="return false"></canvas>
                   </div>`}
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/* ==========================================================================
   15. TRANSCRIPT MODAL & PDF + GUARDIAN EMAIL DISPATCHER
   ========================================================================== */
let activeTranscriptState = null;

function openTranscriptModal(studentId) {
  // Students can only open their transcript once Finals are released
  if (authUser && authUser.role === 'student' && !finalsReleased()) {
    showToast('Your transcript is available after Finals are released.', 'error');
    return;
  }

  console.log("Opening transcript modal for student ID:", studentId);
  const student = appState.students.find(s => String(s.id) === String(studentId));
  
  if (!student) {
    showToast('Student record not found for ID: ' + studentId, 'error');
    console.error("Student not found in appState.students:", studentId, appState.students);
    return;
  }

  activeTranscriptState = {
    studentId: student.id,
    to: '',
    passwordMode: 'pin',
    note: ''
  };

  renderTranscriptModal();
}

function transcriptEmail(st) {
  const T = activeTranscriptState;
  const pass = T.passwordMode === 'pin' ? st.parent.pin : st.id, label = T.passwordMode === 'pin' ? 'Parent PIN' : 'School ID';
  return { pass, label, subject: `Official Report of Grades - ${st.name}`,
    body: `Good day,\n\nAttached is the password-protected report of grades for ${st.name} (${st.section}). To open the PDF document, please use your secure ${label}: ${pass}.\n\n${T.note ? 'Teacher Note: ' + T.note + '\n\n' : ''}*** This is an auto-generated email. DO NOT REPLY TO THIS MESSAGE ***` };
}

function refreshEmailPreview() {
  const st = activeTranscriptState && appState.students.find(s => s.id === activeTranscriptState.studentId);
  if (!st) return;
  const a = document.getElementById('emailPreviewTo'), b = document.getElementById('emailPreviewBody');
  if (a) a.textContent = activeTranscriptState.to || '(type the recipient email)';
  if (b) b.textContent = transcriptEmail(st).body;
}

function renderTranscriptModal() {
  const root = document.getElementById('modalRoot');
  const T = activeTranscriptState;
  const st = T && appState.students.find(s => s.id === T.studentId);
  if (!st) { root.innerHTML = ''; return; }
  const sm = getStudentSummary(st);
  const on = 'bg-amber-500 text-slate-950 border-amber-500 shadow-md', off = 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300';
  const inp = 'w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400';
  root.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div class="glass-panel w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 class="text-lg font-black text-slate-900 dark:text-white">Official Transcript & Email Dispatch</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${st.name} (${st.id}) • ${st.section}</p>
          </div>
          <button type="button" onclick="closeTranscriptModal()" class="p-2 rounded-xl text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all">✕</button>
        </div>
        <div class="p-6 overflow-y-auto space-y-6 flex-1">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Send to (your own email entry)</label>
                <input type="email" id="modalTo" value="${(T.to || '').replace(/"/g, '&quot;')}" oninput="activeTranscriptState.to = this.value.trim(); refreshEmailPreview()" placeholder="type recipient email, e.g. parent@gmail.com" class="${inp}" />
              </div>
              <div class="space-y-2">
                <label class="text-xs font-bold text-slate-700 dark:text-slate-300">PDF Password Protection</label>
                <div class="grid grid-cols-2 gap-2">
                  <button type="button" onclick="activeTranscriptState.passwordMode='pin'; renderTranscriptModal();" class="py-2.5 rounded-xl font-bold text-xs border transition-all ${T.passwordMode === 'pin' ? on : off}">Parent PIN (${st.parent.pin})</button>
                  <button type="button" onclick="activeTranscriptState.passwordMode='id'; renderTranscriptModal();" class="py-2.5 rounded-xl font-bold text-xs border transition-all ${T.passwordMode === 'id' ? on : off}">School ID (${st.id})</button>
                </div>
              </div>
              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Additional Message / Note</label>
                <textarea id="modalNote" oninput="activeTranscriptState.note = this.value; refreshEmailPreview()" placeholder="Optional notes from teacher..." class="${inp}" rows="3">${T.note}</textarea>
              </div>
            </div>
            <div class="bg-slate-900 text-slate-100 p-5 rounded-2xl space-y-3 font-mono text-xs flex flex-col justify-between border border-slate-800">
              <div class="space-y-2">
                <div class="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Email Preview</div>
                <div class="text-slate-400">To: <span id="emailPreviewTo" class="text-white"></span></div>
                <div class="text-slate-400 pt-1 border-t border-slate-800">Subject: Official Report of Grades - ${st.name}</div>
                <div id="emailPreviewBody" class="bg-slate-950 p-3 rounded-xl text-slate-300 whitespace-pre-line mt-2 text-[11px] leading-relaxed border border-slate-800/80"></div>
              </div>
              <button type="button" onclick="copyEmailDraftText()" class="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all">Copy Email Draft</button>
            </div>
          </div>
          <div class="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
            <h3 class="font-bold text-slate-800 dark:text-slate-100">Transcript Summary Preview</h3>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
              <div>GWA: <b class="text-brand-600 dark:text-amber-400">${formatGwa(sm.gwa)}</b></div>
              <div>Standing: <b>${sm.standing.label}</b></div>
              <div>Passed: <b>${sm.passedCount} / ${sm.rows.length}</b></div>
              <div>Units: <b>${sm.unitsEvaluated}</b></div>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
          <button type="button" onclick="closeTranscriptModal()" class="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs">Cancel</button>
          <button type="button" onclick="dispatchTranscriptAndPDF(false)" class="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all">📥 Download PDF</button>
          <button type="button" onclick="dispatchTranscriptAndPDF(true)" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all">✉️ Download PDF & Open Gmail</button>
        </div>
      </div>
    </div>`;
  refreshEmailPreview();
}

function closeTranscriptModal() {
  activeTranscriptState = null;
  renderTranscriptModal();
}

function copyEmailDraftText() {
  const T = activeTranscriptState, st = appState.students.find(s => s.id === T.studentId), em = transcriptEmail(st);
  navigator.clipboard.writeText(`To: ${T.to}\nSubject: ${em.subject}\n\n${em.body}`).then(() => showToast('Email draft copied!', 'success'));
}

function dispatchTranscriptAndPDF(openMail) {
  const T = activeTranscriptState;
  if (!T) return;
  const st = appState.students.find(s => s.id === T.studentId);
  if (!st) return;
  const to = (T.to || '').trim();
  if (openMail && !/^\S+@\S+\.\S+$/.test(to)) return showToast('Type a valid recipient email first.', 'error');
  if (!window.jspdf) return showToast('jsPDF library failed to load. Check internet connection.', 'error');

  const sm = getStudentSummary(st), em = transcriptEmail(st), S = appState.settings;
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', encryption: { userPassword: em.pass, ownerPassword: 'ua_admin_secure_key_2026', userPermissions: ['print'] } });
  const BLUE = [0, 43, 102], GOLD = [245, 166, 35], GRAY = [100, 116, 139], INK = [30, 41, 59];
  const g = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? '-' : Number(v).toFixed(1);

  // Header band
  doc.setFillColor(...BLUE); doc.rect(0, 0, 210, 30, 'F');
  doc.setFillColor(...GOLD); doc.rect(0, 30, 210, 1.5, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(S.school, 105, 13, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text('OFFICIAL REPORT OF GRADES', 105, 20, { align: 'center' });
  doc.text(S.term, 105, 25.5, { align: 'center' });

  // Student info card
  doc.setDrawColor(203, 213, 225); doc.setFillColor(248, 250, 252); doc.roundedRect(14, 37, 182, 22, 2, 2, 'FD');
  const kv = (l, v, x, y) => { doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GRAY); doc.text(l, x, y); doc.setFont('helvetica', 'normal'); doc.setTextColor(...INK); doc.text(String(v), x + 30, y); };
  kv('Student Name', st.name, 18, 44); kv('School ID', st.id, 18, 50); kv('Course', st.course, 18, 56);
  kv('Section', st.section, 112, 44); kv('Date Issued', new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }), 112, 50); kv('Units Credited', `${sm.unitsEvaluated} / ${sm.totalUnits}`, 112, 56);

  // Grades table
  const cols = [['CODE', 16, 'left'], ['SUBJECT TITLE', 36, 'left'], ['UNITS', 99, 'center'], ['PRELIM', 113, 'center'], ['MIDTERM', 129, 'center'], ['PRE-FINAL', 146, 'center'], ['AVG %', 162, 'center'], ['GRADE', 176, 'center'], ['STATUS', 188, 'center']];
  const head = y => {
    doc.setFillColor(...BLUE); doc.rect(14, y, 182, 8, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    cols.forEach(c => doc.text(c[0], c[1], y + 5.3, { align: c[2] }));
  };
  let y = 65; head(y); y += 8;
  sm.rows.forEach((r, i) => {
    if (y > 262) { doc.addPage(); y = 20; head(y); y += 8; }
    if (i % 2 === 0) { doc.setFillColor(241, 245, 249); doc.rect(14, y, 182, 7.5, 'F'); }
    const gr = r.g || {}, st2 = r.calc.status, ty = y + 5;
    doc.setFontSize(8.5); doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold'); doc.text(r.sub.code, 16, ty);
    doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(r.sub.title, 56)[0], 36, ty);
    [[String(r.sub.units), 99], [g(gr.p), 113], [g(gr.m), 129], [g(gr.pf), 146], [r.calc.pct !== null ? r.calc.pct.toFixed(1) : '-', 162]].forEach(v => doc.text(v[0], v[1], ty, { align: 'center' }));
    doc.setFont('helvetica', 'bold'); doc.text(formatGradeEq(r.calc.eq), 176, ty, { align: 'center' });
    doc.setTextColor(...(st2 === 'passed' ? [5, 150, 105] : st2 === 'failed' ? [225, 29, 72] : [217, 119, 6]));
    doc.setFontSize(7.5); doc.text(st2 === 'passed' ? 'PASSED' : st2 === 'failed' ? 'FAILED' : 'INC', 188, ty, { align: 'center' });
    y += 7.5;
  });
  doc.setDrawColor(...BLUE); doc.setLineWidth(0.4); doc.line(14, y, 196, y);

  // Summary card
  if (y > 225) { doc.addPage(); y = 20; }
  y += 8;
  doc.setFillColor(238, 242, 255); doc.setDrawColor(203, 213, 225); doc.roundedRect(14, y, 182, 24, 2, 2, 'FD');
  doc.setTextColor(...GRAY); doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.text('GENERAL WEIGHTED AVERAGE', 20, y + 7);
  doc.setTextColor(...BLUE); doc.setFontSize(20); doc.text(formatGwa(sm.gwa), 20, y + 18);
  doc.setFontSize(9); doc.setTextColor(...INK);
  doc.text(`Standing: ${sm.standing.label}`, 80, y + 9);
  doc.setFont('helvetica', 'normal'); doc.text(`Passed: ${sm.passedCount}   Failed: ${sm.failedCount}   Incomplete: ${sm.incCount}   Total subjects: ${sm.rows.length}`, 80, y + 16);
  y += 31;

  if (T.note) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...INK); doc.text('Teacher Note:', 14, y);
    doc.setFont('helvetica', 'normal'); const lines = doc.splitTextToSize(T.note, 180); doc.text(lines, 14, y + 5); y += 5 + lines.length * 4.5 + 4;
  }
  if (y > 245) { doc.addPage(); y = 20; }
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...GRAY);
  doc.text(doc.splitTextToSize('Grading scale: 97-100 = 1.00 | 94-96 = 1.25 | 91-93 = 1.50 | 88-90 = 1.75 | 85-87 = 2.00 | 82-84 = 2.25 | 79-81 = 2.50 | 76-78 = 2.75 | 75 = 3.00 (lowest passing) | below 75 = 5.00 (failed). Term grades: Prelim & Midterm = Class Standing x2 + Exam x1; Pre-Final = Class Standing x1 + Exam x2.', 182), 14, y);
  y += 22;
  doc.setDrawColor(...INK); doc.setLineWidth(0.3); doc.line(130, y, 192, y);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...INK); doc.text(S.registrar, 161, y + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRAY); doc.text('Registrar / Professor', 161, y + 9.5, { align: 'center' });

  // Footer on every page
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p); doc.setDrawColor(203, 213, 225); doc.setLineWidth(0.2); doc.line(14, 285, 196, 285);
    doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text(`${S.school} • ${st.name} (${st.id}) • Confidential`, 14, 290);
    doc.text(`Page ${p} of ${n}`, 196, 290, { align: 'right' });
  }

  const filename = `UA_Grades_${st.id}_${st.section}.pdf`;
  doc.save(filename);
  appState.log.unshift({ when: new Date().toLocaleString(), sid: st.id, name: st.name, to: to || '(download only)', pwLabel: em.label, file: filename });
  saveState();
  if (openMail) window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(em.subject)}&body=${encodeURIComponent(em.body)}`, '_blank');
  showToast(openMail ? 'PDF downloaded. Attach it in the Gmail window.' : 'PDF downloaded successfully!', 'success');
}

/* ==========================================================================
   16. APPLICATION BOOTSTRAP & INITIALIZATION
   ========================================================================== */
/* ==========================================================================
   Student grade table drawn as an image (canvas) so the numbers are not
   present as text in the page's HTML.
   ========================================================================== */
function drawGradeCanvas() {
  const canvas = document.getElementById('gradeCanvas');
  const wrap = document.getElementById('gradeCanvasWrap');
  if (!canvas || !wrap || !authUser || authUser.role !== 'student') return;
  const student = appState.students.find(s => s.id === authUser.studentId);
  if (!student) return;
  const sm = getStudentSummary(student);

  const dark = uiState.darkMode;
  const C = dark ? {
    text: '#e2e8f0', muted: '#94a3b8', line: 'rgba(148,163,184,0.18)', code: '#fbbf24', grade: '#fbbf24',
    passedBg: 'rgba(16,185,129,0.15)', passedFg: '#34d399', failedBg: 'rgba(244,63,94,0.15)', failedFg: '#fb7185',
    otherBg: 'rgba(245,158,11,0.15)', otherFg: '#fbbf24'
  } : {
    text: '#1e293b', muted: '#94a3b8', line: 'rgba(148,163,184,0.35)', code: '#002B66', grade: '#002B66',
    passedBg: 'rgba(16,185,129,0.12)', passedFg: '#059669', failedBg: 'rgba(244,63,94,0.12)', failedFg: '#e11d48',
    otherBg: 'rgba(245,158,11,0.15)', otherFg: '#d97706'
  };

  // Only the released term(s) are shown; average/grade/status appear after Finals
  const vis = visibleTerms(), fin = finalsReleased();
  const cols = [
    { key: 'code', w: 96, align: 'left', label: 'CODE' },
    { key: 'title', w: 0, align: 'left', label: 'SUBJECT TITLE' },
    { key: 'units', w: 64, align: 'center', label: 'UNITS' },
    ...(vis.includes('p') ? [{ key: 'p', w: 80, align: 'center', label: 'PRELIM' }] : []),
    ...(vis.includes('m') ? [{ key: 'm', w: 84, align: 'center', label: 'MIDTERM' }] : []),
    ...(vis.includes('pf') ? [{ key: 'pf', w: 90, align: 'center', label: 'PRE-FINAL' }] : []),
    ...(fin ? [
      { key: 'pct', w: 100, align: 'center', label: 'AVERAGE %' },
      { key: 'eq', w: 80, align: 'center', label: 'GRADE' },
      { key: 'status', w: 120, align: 'center', label: 'STATUS' }
    ] : [])
  ];
  const fixed = cols.reduce((a, c) => a + c.w, 0);
  const W = Math.max(wrap.clientWidth || 0, fixed + 280);
  cols.find(c => c.key === 'title').w = W - fixed;

  const headerH = 44, rowH = 52, H = headerH + rowH * sm.rows.length + 4;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const SANS = '"Plus Jakarta Sans", sans-serif';
  const MONO = '"JetBrains Mono", monospace';
  const fmt = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? '-' : Number(v).toFixed(1);

  const fit = (text, maxW) => {
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text + '…';
  };

  const colX = [];
  let x = 0;
  cols.forEach(c => { colX.push(x); x += c.w; });
  const place = (c, i, pad = 16) => c.align === 'left' ? colX[i] + pad : colX[i] + c.w / 2;

  // header
  ctx.textBaseline = 'middle';
  ctx.font = `700 10px ${SANS}`;
  cols.forEach((c, i) => {
    ctx.fillStyle = C.muted;
    ctx.textAlign = c.align === 'left' ? 'left' : 'center';
    ctx.fillText(c.label, place(c, i), headerH / 2);
  });
  ctx.strokeStyle = C.line; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, headerH + 0.5); ctx.lineTo(W, headerH + 0.5); ctx.stroke();

  // rows
  sm.rows.forEach((r, ri) => {
    const cy = headerH + ri * rowH + rowH / 2;
    const g = r.g || {};
    const status = r.calc.status;
    const vals = {
      code: r.sub.code, title: r.sub.title, units: r.sub.units,
      p: fmt(g.p), m: fmt(g.m), pf: fmt(g.pf),
      pct: r.calc.pct !== null ? r.calc.pct.toFixed(1) + '%' : '-',
      eq: formatGradeEq(r.calc.eq)
    };

    cols.forEach((c, i) => {
      if (c.key === 'status') return;
      ctx.textAlign = c.align === 'left' ? 'left' : 'center';
      if (c.key === 'code') { ctx.font = `700 12px ${MONO}`; ctx.fillStyle = C.code; }
      else if (c.key === 'title') { ctx.font = `600 12px ${SANS}`; ctx.fillStyle = C.text; }
      else if (c.key === 'eq') { ctx.font = `800 13px ${MONO}`; ctx.fillStyle = C.grade; }
      else if (c.key === 'pct') { ctx.font = `600 12px ${MONO}`; ctx.fillStyle = C.text; }
      else { ctx.font = `400 12px ${MONO}`; ctx.fillStyle = C.text; }
      const t = c.key === 'title' ? fit(String(vals.title), c.w - 24) : String(vals[c.key]);
      ctx.fillText(t, place(c, i), cy);
    });

    // status pill (only when Finals are released)
    const si = cols.findIndex(c => c.key === 'status');
    if (si >= 0) {
      const sc = cols[si];
      const label = status.toUpperCase();
      ctx.font = `700 10px ${SANS}`;
      const pw = ctx.measureText(label).width + 22, ph = 22;
      const px = colX[si] + sc.w / 2 - pw / 2, py = cy - ph / 2;
      ctx.fillStyle = status === 'passed' ? C.passedBg : status === 'failed' ? C.failedBg : C.otherBg;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 11); else ctx.rect(px, py, pw, ph);
      ctx.fill();
      ctx.fillStyle = status === 'passed' ? C.passedFg : status === 'failed' ? C.failedFg : C.otherFg;
      ctx.textAlign = 'center';
      ctx.fillText(label, colX[si] + sc.w / 2, cy + 0.5);
    }

    if (ri < sm.rows.length - 1) {
      ctx.strokeStyle = C.line;
      ctx.beginPath(); ctx.moveTo(0, headerH + (ri + 1) * rowH + 0.5); ctx.lineTo(W, headerH + (ri + 1) * rowH + 0.5); ctx.stroke();
    }
  });
}

function setStudentTerm(key) {
  uiState.studentTerm = key;
  renderApp();
}

function setStudentSubject(id) {
  uiState.studentSubject = id;
  renderApp();
}

function getStudentClassData(student) {
  const term = uiState.studentTerm || 'p';
  const subjects = appState.subjects.filter(s => s.course === student.course);
  const picked = subjects.find(s => s.id === uiState.studentSubject) || subjects[0];
  const subjectId = picked ? picked.id : null;

  const summary = subjects.map(sub => {
    const bd = computeTermBreakdown(student, sub.id, term);
    const rec = (appState.grades[student.id] || {})[sub.id] || {};
    return { sub, bd, grade: rec[term] };
  });

  const detail = { quizzes: [], activities: [], exam: [], attendance: [] };
  if (subjectId) {
    const cw = getClassWork(student.section, subjectId, term, false);
    const rec = (appState.grades[student.id] || {})[subjectId] || {};
    const items = rec.items || {};
    const att = rec.att || {};
    const pct = (sc, tt) => hasVal(sc) ? pctOf(sc, tt).toFixed(1) + '%' : '-';
    const row = it => [it.name, hasVal(items[it.id]) ? String(items[it.id]) : '-', String(it.total), pct(items[it.id], it.total)];
    detail.quizzes = cw.quizzes.map(row);
    detail.activities = cw.activities.map(row);
    if (cw.exam) detail.exam = [row({ id: cw.exam.id, name: 'Exam', total: cw.exam.total })];
    detail.attendance = cw.dates.map(d => {
      const st = att[d.id];
      return [fmtDate(d.date), st ? { t: ATT_STATUS[st].label, pill: true, tone: ATT_STATUS[st].tone } : { t: 'Not marked', tone: 'muted' }];
    });
  }
  return { term, subjects, subjectId, summary, detail };
}

/* Generic image-table renderer: draws text onto a canvas so it is not present in the page HTML */
function drawGenericTable(canvasId, wrapId, cols, rows, minFlex) {
  const canvas = document.getElementById(canvasId);
  const wrap = document.getElementById(wrapId);
  if (!canvas || !wrap) return;

  const dark = uiState.darkMode;
  const C = dark
    ? { text: '#e2e8f0', muted: '#94a3b8', line: 'rgba(148,163,184,0.18)', code: '#fbbf24', accent: '#fbbf24',
        pass: ['rgba(16,185,129,0.15)', '#34d399'], fail: ['rgba(244,63,94,0.15)', '#fb7185'],
        warn: ['rgba(245,158,11,0.15)', '#fbbf24'], muted2: ['rgba(148,163,184,0.15)', '#94a3b8'] }
    : { text: '#1e293b', muted: '#94a3b8', line: 'rgba(148,163,184,0.35)', code: '#002B66', accent: '#002B66',
        pass: ['rgba(16,185,129,0.12)', '#059669'], fail: ['rgba(244,63,94,0.12)', '#e11d48'],
        warn: ['rgba(245,158,11,0.15)', '#d97706'], muted2: ['rgba(100,116,139,0.12)', '#64748b'] };

  const flexIdx = cols.findIndex(c => c.w === 0);
  const fixed = cols.reduce((a, c) => a + c.w, 0);
  const W = Math.max(wrap.clientWidth || 0, fixed + (minFlex || 200));
  if (flexIdx >= 0) cols[flexIdx].w = W - fixed;

  const headerH = 42, rowH = 44, H = headerH + rowH * rows.length + 4;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  canvas.style.display = 'block';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const SANS = '"Plus Jakarta Sans", sans-serif';
  const MONO = '"JetBrains Mono", monospace';
  const colX = [];
  let x = 0;
  cols.forEach(c => { colX.push(x); x += c.w; });
  const place = (c, i) => c.align === 'left' ? colX[i] + 16 : colX[i] + c.w / 2;
  const fit = (text, maxW) => {
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text + '…';
  };

  ctx.textBaseline = 'middle';
  ctx.font = `700 10px ${SANS}`;
  cols.forEach((c, i) => {
    ctx.fillStyle = C.muted;
    ctx.textAlign = c.align === 'left' ? 'left' : 'center';
    ctx.fillText(c.label, place(c, i), headerH / 2);
  });
  ctx.strokeStyle = C.line; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, headerH + 0.5); ctx.lineTo(W, headerH + 0.5); ctx.stroke();

  rows.forEach((r, ri) => {
    const cy = headerH + ri * rowH + rowH / 2;
    cols.forEach((c, i) => {
      const cell = (r[i] !== null && typeof r[i] === 'object') ? r[i] : { t: String(r[i]) };
      ctx.textAlign = c.align === 'left' ? 'left' : 'center';
      if (cell.pill) {
        ctx.font = `700 10px ${SANS}`;
        const label = cell.t.toUpperCase();
        const pw = ctx.measureText(label).width + 22, ph = 22;
        const px = colX[i] + c.w / 2 - pw / 2, py = cy - ph / 2;
        const pal = cell.tone === 'pass' ? C.pass : cell.tone === 'fail' ? C.fail : cell.tone === 'warn' ? C.warn : C.muted2;
        ctx.fillStyle = pal[0];
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 11); else ctx.rect(px, py, pw, ph);
        ctx.fill();
        ctx.fillStyle = pal[1];
        ctx.textAlign = 'center';
        ctx.fillText(label, colX[i] + c.w / 2, cy + 0.5);
        return;
      }
      if (c.font === 'code') { ctx.font = `700 12px ${MONO}`; ctx.fillStyle = C.code; }
      else if (c.font === 'title') { ctx.font = `600 12px ${SANS}`; ctx.fillStyle = C.text; }
      else if (c.font === 'grade') { ctx.font = `800 13px ${MONO}`; ctx.fillStyle = C.accent; }
      else { ctx.font = `400 12px ${MONO}`; ctx.fillStyle = C.text; }
      if (cell.tone === 'muted') ctx.fillStyle = C.muted;
      const t = c.align === 'left' ? fit(cell.t, c.w - 24) : cell.t;
      ctx.fillText(t, place(c, i), cy);
    });
    if (ri < rows.length - 1) {
      ctx.strokeStyle = C.line;
      ctx.beginPath(); ctx.moveTo(0, headerH + (ri + 1) * rowH + 0.5); ctx.lineTo(W, headerH + (ri + 1) * rowH + 0.5); ctx.stroke();
    }
  });
}

function drawCompCanvas() {
  if (!authUser || authUser.role !== 'student') return;
  const student = appState.students.find(s => s.id === authUser.studentId);
  if (!student) return;
  const d = getStudentClassData(student);
  const pct = v => (v === null || v === undefined) ? '-' : v.toFixed(1) + '%';

  drawGenericTable('stSummaryCanvas', 'stSummaryWrap', [
    { w: 90, align: 'left', label: 'CODE', font: 'code' },
    { w: 0, align: 'left', label: 'SUBJECT TITLE', font: 'title' },
    { w: 100, align: 'center', label: 'QUIZZES', font: 'mono' },
    { w: 100, align: 'center', label: 'ACTIVITIES', font: 'mono' },
    { w: 90, align: 'center', label: 'EXAM', font: 'mono' },
    { w: 110, align: 'center', label: 'ATTENDANCE', font: 'mono' },
    { w: 110, align: 'center', label: 'TERM GRADE', font: 'grade' }
  ], d.summary.map(r => [
    r.sub.code, r.sub.title,
    pct(r.bd.quiz && r.bd.quiz.pct), pct(r.bd.act && r.bd.act.pct), pct(r.bd.exam && r.bd.exam.pct), pct(r.bd.attendance.pct),
    (r.grade === null || r.grade === undefined) ? '-' : Number(r.grade).toFixed(1) + '%'
  ]), 240);

  const scoreCols = label => [
    { w: 0, align: 'left', label, font: 'title' },
    { w: 100, align: 'center', label: 'SCORE', font: 'mono' },
    { w: 100, align: 'center', label: 'TOTAL', font: 'mono' },
    { w: 110, align: 'center', label: 'PERCENT', font: 'grade' }
  ];
  drawGenericTable('stQuizCanvas', 'stQuizWrap', scoreCols('QUIZ'), d.detail.quizzes, 200);
  drawGenericTable('stActCanvas', 'stActWrap', scoreCols('ACTIVITY'), d.detail.activities, 200);
  drawGenericTable('stExamCanvas', 'stExamWrap', scoreCols('EXAM'), d.detail.exam, 200);
  drawGenericTable('stAttCanvas', 'stAttWrap', [
    { w: 0, align: 'left', label: 'DATE', font: 'title' },
    { w: 160, align: 'center', label: 'STATUS', font: 'mono' }
  ], d.detail.attendance, 200);
}

let gradeCanvasResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(gradeCanvasResizeTimer);
  gradeCanvasResizeTimer = setTimeout(() => { drawGradeCanvas(); drawCompCanvas(); }, 150);
});

function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;

  if (!authUser) {
    root.innerHTML = renderLoginPage();
  } else {
    root.innerHTML = renderMainLayout();
    drawGradeCanvas();
    drawCompCanvas();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { drawGradeCanvas(); drawCompCanvas(); });
  }
}

/* Deterrents for student view: block right-click, copy and common dev-tool shortcuts */
function isStudentSession() {
  return authUser && authUser.role === 'student';
}
document.addEventListener('contextmenu', e => { if (isStudentSession()) e.preventDefault(); });
document.addEventListener('copy', e => { if (isStudentSession()) e.preventDefault(); });
document.addEventListener('selectstart', e => { if (isStudentSession()) e.preventDefault(); });
document.addEventListener('keydown', e => {
  if (!isStudentSession()) return;
  const k = e.key.toLowerCase();
  const blocked = e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && ['i', 'j', 'c'].includes(k)) ||
    (e.ctrlKey && ['u', 's', 'c', 'a'].includes(k));
  if (blocked) e.preventDefault();
});

document.addEventListener('DOMContentLoaded', () => {
  recomputeAllTermGrades();   // apply the x2 / x1 formula to existing records
  saveState();
  renderApp();
});
