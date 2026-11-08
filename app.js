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
      weights: { quiz: 40, activity: 40, attendance: 20 }
    },
    subjects: generateSubjectsSeed(),
    courses: [...COURSES],
    sections: [...SECTIONS],
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
        if (!parsed.settings.weights) parsed.settings.weights = { quiz: 40, activity: 40, attendance: 20 };
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
   2b. TERM GRADE COMPONENTS (QUIZZES, ACTIVITIES, ATTENDANCE)
   Each term grade = Quizzes% x w1 + Activities% x w2 + Attendance% x w3
   Stored per student/subject: record.comp[term] = { qs, qt, acs, act, ap, ad }
     qs/qt  = quiz score / quiz total points
     acs/act = activity score / activity total points
     ap/ad  = days present / total class days
   ========================================================================== */
const TERMS = [
  { key: 'p', label: 'Prelim' },
  { key: 'm', label: 'Midterm' },
  { key: 'pf', label: 'Pre-Final' }
];
const COMP_PAIRS = [['qs', 'qt'], ['acs', 'act'], ['ap', 'ad']];

function isTeacherSession() {
  return !!(authUser && authUser.role === 'teacher');
}

function getWeights() {
  const w = (appState.settings && appState.settings.weights) || {};
  const n = (v, d) => (v === undefined || v === null || isNaN(parseFloat(v))) ? d : parseFloat(v);
  return { quiz: n(w.quiz, 40), activity: n(w.activity, 40), attendance: n(w.attendance, 20) };
}

function ratioPct(score, total) {
  const x = parseFloat(score), y = parseFloat(total);
  if (isNaN(x) || isNaN(y) || y <= 0) return null;
  return Math.max(0, Math.min(100, (x / y) * 100));
}

function calcComponents(c) {
  c = c || {};
  return { q: ratioPct(c.qs, c.qt), a: ratioPct(c.acs, c.act), att: ratioPct(c.ap, c.ad) };
}

function calcTermGrade(c) {
  const { q, a, att } = calcComponents(c);
  if (q === null || a === null || att === null) return null;
  const w = getWeights();
  const total = (w.quiz + w.activity + w.attendance) || 100;
  return (q * w.quiz + a * w.activity + att * w.attendance) / total;
}

function recomputeAllTermGrades() {
  Object.keys(appState.grades).forEach(sid => {
    const subs = appState.grades[sid] || {};
    Object.keys(subs).forEach(subId => {
      const rec = subs[subId];
      if (!rec || !rec.comp) return;
      TERMS.forEach(t => {
        const tg = calcTermGrade(rec.comp[t.key]);
        if (tg !== null) rec[t.key] = tg;
      });
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
function downloadCSVTemplate(sectionId) {
  const sampleStudents = [
    { id: '2026000101', name: 'Maria Clarissa Santos', course: sectionId.split('-')[0], section: sectionId, email: 'maria.santos@student.ua.edu.ph', pName: 'Juan Santos', pEmail: 'parent.santos@example.com', pin: '123456', password: '482915' },
    { id: '2026000102', name: 'Juan Miguel Dela Cruz', course: sectionId.split('-')[0], section: sectionId, email: 'juan.delacruz@student.ua.edu.ph', pName: 'Maria Dela Cruz', pEmail: 'parent.delacruz@example.com', pin: '654321', password: '736204' }
  ];
  
  const sectionSubjects = appState.subjects.filter(s => s.course === sectionId.split('-')[0]);
  
  let csvContent = `School ID,Student Name,Course,Section,Student Email,Guardian Name,Guardian Email,Guardian PIN`;
  sectionSubjects.forEach(sub => {
    csvContent += `,${sub.code}_Prelim,${sub.code}_Midterm,${sub.code}_PreFinal`;
  });
  csvContent += `,Student Password\n`;

  sampleStudents.forEach(st => {
    let row = `"${st.id}","${st.name}","${st.course}","${st.section}","${st.email}","${st.pName}","${st.pEmail}","${st.pin}"`;
    sectionSubjects.forEach(() => {
      row += `,90,92,94`;
    });
    row += `,"${st.password}"`;
    csvContent += row + `\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${sectionId}_Template.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Downloaded ${sectionId}_Template.csv template!`, 'success');
}

function exportSectionToCSV(sectionId) {
  const sectionStudents = appState.students.filter(s => s.section === sectionId);
  if (!sectionStudents.length) {
    showToast(`No students enrolled in ${sectionId} to export.`, 'error');
    return;
  }

  const firstStudent = sectionStudents[0];
  const sectionSubjects = appState.subjects.filter(s => s.course === firstStudent.course);

  let csvContent = `School ID,Student Name,Course,Section,Student Email,Guardian Name,Guardian Email,Guardian PIN`;
  sectionSubjects.forEach(sub => {
    csvContent += `,${sub.code}_Prelim,${sub.code}_Midterm,${sub.code}_PreFinal`;
  });
  csvContent += `,Student Password\n`;

  sectionStudents.forEach(st => {
    let row = `"${st.id}","${st.name}","${st.course}","${st.section}","${st.email}","${st.parent.name}","${st.parent.email}","${st.parent.pin}"`;
    sectionSubjects.forEach(sub => {
      const g = (appState.grades[st.id] || {})[sub.id] || { p: '', m: '', pf: '' };
      row += `,${g.p ?? ''},${g.m ?? ''},${g.pf ?? ''}`;
    });
    row += `,"${st.password || ''}"`;
    csvContent += row + `\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${sectionId}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported ${sectionId}.csv successfully!`, 'success');
}

function handleCSVImport(event, sectionId) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    parseAndImportCSV(text, sectionId);
  };
  reader.readAsText(file);
}

function parseAndImportCSV(csvText, sectionId) {
  const lines = csvText.split(/\r\n|\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) {
    showToast('Invalid CSV format: File must contain a header and student data.', 'error');
    return;
  }

  const headers = lines[0].split(',').map(h => h.replace(/^"(.*)"$/, '$1').trim());
  let importedCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const matches = [...lines[i].matchAll(/(?:^|,)(?:"([^"]*)"|([^,]*))/g)];
    const cols = matches.map(m => m[1] !== undefined ? m[1] : m[2]);

    if (cols.length < 5) continue;

    const id = cols[0]?.trim();
    const name = cols[1]?.trim();
    const course = cols[2]?.trim();
    const sec = cols[3]?.trim() || sectionId;
    const email = cols[4]?.trim();
    const pName = cols[5]?.trim() || 'Guardian';
    const pEmail = cols[6]?.trim() || '';
    const pPin = cols[7]?.trim() || String(100000 + Math.floor(Math.random() * 900000));

    if (!id || !name || !course) continue;

    const pwIdx = headers.indexOf('Student Password');
    const importedPw = pwIdx !== -1 ? (cols[pwIdx] || '').trim() : '';

    let student = appState.students.find(s => s.id === id);
    if (!student) {
      student = { id, name, course, section: sec, email, password: importedPw || String(100000 + Math.floor(Math.random() * 900000)), parent: { name: pName, email: pEmail, pin: pPin } };
      appState.students.push(student);
    } else {
      student.name = name;
      student.course = course;
      student.section = sec;
      student.email = email;
      if (importedPw) student.password = importedPw;
      else if (!student.password) student.password = String(100000 + Math.floor(Math.random() * 900000));
    }

    if (!appState.grades[id]) appState.grades[id] = {};

    const sectionSubjects = appState.subjects.filter(s => s.course === course);
    sectionSubjects.forEach(sub => {
      const pIdx = headers.indexOf(`${sub.code}_Prelim`);
      const mIdx = headers.indexOf(`${sub.code}_Midterm`);
      const pfIdx = headers.indexOf(`${sub.code}_PreFinal`);

      const pVal = pIdx !== -1 && cols[pIdx] !== '' ? parseFloat(cols[pIdx]) : null;
      const mVal = mIdx !== -1 && cols[mIdx] !== '' ? parseFloat(cols[mIdx]) : null;
      const pfVal = pfIdx !== -1 && cols[pfIdx] !== '' ? parseFloat(cols[pfIdx]) : null;

      const rec = appState.grades[id][sub.id] || { p: null, m: null, pf: null };
      const incoming = { p: isNaN(pVal) ? null : pVal, m: isNaN(mVal) ? null : mVal, pf: isNaN(pfVal) ? null : pfVal };
      TERMS.forEach(t => {
        const nv = incoming[t.key];
        const cur = rec[t.key];
        if (nv !== null && (cur === null || cur === undefined || Math.abs(cur - nv) > 0.05)) {
          // A different grade was imported: it replaces any computed components for that term
          rec[t.key] = nv;
          if (rec.comp) delete rec.comp[t.key];
        } else if (nv === null && (rec.comp === undefined || !rec.comp[t.key])) {
          rec[t.key] = null;
        }
      });
      appState.grades[id][sub.id] = rec;
    });

    importedCount++;
  }

  saveState();
  renderApp();
  showToast(`Successfully imported ${importedCount} student records into database!`, 'success');
}

/* ==========================================================================
   4. UI STATE & SYSTEM UTILITIES
   ========================================================================== */
const uiState = {
  activePage: 'dashboard',
  dashFilter: { course: 'all', section: 'all' },
  entryFilter: { course: 'BSIT', section: 'BSIT-1A', subject: 'BSIT-IT101', search: '', term: 'p' },
  studentTerm: 'p',
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
                <button type="button" onclick="toggleTeacherPassVisibility()" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-500 transition-colors">
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
                <button type="button" onclick="toggleStudentPassVisibility()" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-amber-500 transition-colors">
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

function toggleTeacherPassVisibility() {
  uiState.teacherPasswordVisible = !uiState.teacherPasswordVisible;
  renderApp();
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

function toggleStudentPassVisibility() {
  const input = document.getElementById('sLoginPass');
  if (input) input.type = input.type === 'password' ? 'text' : 'password';
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
  const termLabel = (TERMS.find(t => t.key === term) || TERMS[0]).label;
  const w = getWeights();
  const sectionStudents = appState.students.filter(s => s.section === uiState.entryFilter.section && (
    !uiState.entryFilter.search || 
    s.name.toLowerCase().includes(uiState.entryFilter.search.toLowerCase()) || 
    s.id.includes(uiState.entryFilter.search)
  ));

  const inputCls = 'w-14 px-1.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-center focus:outline-none focus:border-amber-400';
  const val = v => (v !== null && v !== undefined ? v : '');
  const pctTxt = v => (v === null || v === undefined ? '-' : v.toFixed(1) + '%');

  return `
    <div class="space-y-6">
      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <div>
          <h1 class="text-xl font-black text-slate-800 dark:text-slate-100">3–Term Grade Entry Matrix</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Enter Quizzes, Activities and Attendance for each term. The term grade is computed automatically.</p>
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
              <span class="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${activeSub.type === 'major' ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'}">
                ${activeSub.type}
              </span>
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
              ${termLabel} grade = Quizzes <b>${w.quiz}%</b> + Activities <b>${w.activity}%</b> + Attendance <b>${w.attendance}%</b>
              <span class="opacity-70">(change in Portal Settings)</span>
            </p>
          </div>
        ` : ''}
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-4">
        ${!activeSub || sectionStudents.length === 0 ? `
          <div class="text-center py-16 text-slate-500 text-xs">
            ${!activeSub ? 'Please select a valid subject.' : `No students found in section <b>${uiState.entryFilter.section}</b> matching your search.`}
          </div>
        ` : `
          <div id="entryScroll" class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                  <th class="py-3 px-3">Student Name</th>
                  <th class="py-3 px-3 text-center">Quizzes<div class="normal-case font-semibold opacity-70">score / total</div></th>
                  <th class="py-3 px-3 text-center">Activities<div class="normal-case font-semibold opacity-70">score / total</div></th>
                  <th class="py-3 px-3 text-center">Attendance<div class="normal-case font-semibold opacity-70">present / days</div></th>
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
                  const tc = (rec.comp || {})[term] || {};
                  const cc = calcComponents(tc);
                  const calc = calculateSubjectGrade(rec);
                  const statusColors = {
                    passed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    failed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                    inc: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                    none: 'bg-slate-500/10 text-slate-500'
                  };
                  const pair = (f1, f2, pctVal) => `
                    <div class="flex items-center justify-center gap-1">
                      <input id="c_${st.id}_${f1}" type="number" min="0" step="0.5" value="${val(tc[f1])}" onchange="updateComp('${st.id}', '${activeSub.id}', '${term}', '${f1}', this.value)" class="${inputCls}" placeholder="0" />
                      <span class="text-slate-400">/</span>
                      <input id="c_${st.id}_${f2}" type="number" min="0" step="0.5" value="${val(tc[f2])}" onchange="updateComp('${st.id}', '${activeSub.id}', '${term}', '${f2}', this.value)" class="${inputCls}" placeholder="0" />
                    </div>
                    <div class="text-center text-[10px] font-mono text-slate-400 mt-1">${pctTxt(pctVal)}</div>`;
                  const cell = k => `<td class="py-3 px-3 text-center font-mono ${k === term ? 'font-black text-brand-600 dark:text-amber-400' : ''}">${rec[k] !== null && rec[k] !== undefined ? Number(rec[k]).toFixed(1) : '-'}</td>`;
                  return `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td class="py-3 px-3">
                        <div class="font-bold text-slate-800 dark:text-slate-200">${st.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${st.id}</div>
                      </td>
                      <td class="py-3 px-3">${pair('qs', 'qt', cc.q)}</td>
                      <td class="py-3 px-3">${pair('acs', 'act', cc.a)}</td>
                      <td class="py-3 px-3">${pair('ap', 'ad', cc.att)}</td>
                      <td class="py-3 px-3 text-center font-mono font-black text-brand-600 dark:text-amber-400">${rec[term] !== null && rec[term] !== undefined ? Number(rec[term]).toFixed(1) + '%' : '-'}</td>
                      ${cell('p')}${cell('m')}${cell('pf')}
                      <td class="py-3 px-3 text-center font-mono font-semibold">${calc.pct !== null ? calc.pct.toFixed(1) + '%' : '-'}</td>
                      <td class="py-3 px-3 text-center font-mono font-black text-brand-600 dark:text-amber-400">${formatGradeEq(calc.eq)}</td>
                      <td class="py-3 px-3 text-center">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${statusColors[calc.status]}">
                          ${calc.status}
                        </span>
                      </td>
                      <td class="py-3 px-3 text-right">
                        <button type="button" onclick="openTranscriptModal('${st.id}')" class="px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500 hover:text-white font-bold transition-all text-xs">
                          PDF
                        </button>
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

function setEntryTerm(key) {
  uiState.entryFilter.term = key;
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

function updateComp(studentId, subjectId, termKey, field, rawVal) {
  // Only teachers may change grades. Students have no edit access.
  if (!isTeacherSession()) {
    showToast('Only teachers can edit grades.', 'error');
    return;
  }
  const num = rawVal === '' ? null : parseFloat(rawVal);
  if (rawVal !== '' && (isNaN(num) || num < 0)) {
    showToast('Please enter a valid number (0 or higher).', 'error');
    setTimeout(rerenderKeepPosition, 0);
    return;
  }

  if (!appState.grades[studentId]) appState.grades[studentId] = {};
  const rec = appState.grades[studentId][subjectId] || (appState.grades[studentId][subjectId] = { p: null, m: null, pf: null });
  if (!rec.comp) rec.comp = {};
  const tc = rec.comp[termKey] || (rec.comp[termKey] = { qs: null, qt: null, acs: null, act: null, ap: null, ad: null });

  const prev = tc[field];
  tc[field] = num;

  // score / present can never be higher than total / days
  const bad = COMP_PAIRS.find(([sc, tt]) => tc[sc] !== null && tc[tt] !== null && tc[sc] > tc[tt]);
  if (bad) {
    tc[field] = prev;
    showToast(bad[0] === 'ap' ? 'Days present cannot be more than total days.' : 'Score cannot be higher than the total points.', 'error');
    setTimeout(rerenderKeepPosition, 0);
    return;
  }

  const allEmpty = Object.values(tc).every(v => v === null);
  const tg = calcTermGrade(tc);
  rec[termKey] = tg;            // null until quizzes, activities and attendance are all filled in
  if (allEmpty) delete rec.comp[termKey];

  saveState();
  setTimeout(rerenderKeepPosition, 0);
  showToast('Saved', 'success');
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

          <div class="flex flex-wrap items-center gap-3">
            <select onchange="uiState.studentsSectionFilter = this.value; renderApp();" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200">
              ${appState.sections.map(s => `<option value="${s.id}" ${selectedSection === s.id ? 'selected' : ''}>${s.id} (${s.year || ''})</option>`).join('')}
            </select>
            <button type="button" onclick="downloadCSVTemplate('${selectedSection}')" class="px-3.5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all">
              Get Template CSV
            </button>
            <button type="button" onclick="exportSectionToCSV('${selectedSection}')" class="px-3.5 py-2 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500 hover:text-white text-xs font-bold transition-all">
              Export Section CSV
            </button>
            <label class="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer shadow-md transition-all">
              Import CSV Roster
              <input type="file" accept=".csv" class="hidden" onchange="handleCSVImport(event, '${selectedSection}')" />
            </label>
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

      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <div>
          <h2 class="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Grade Computation Weights</h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Term grade = Quizzes + Activities + Attendance, using these percentages (must total 100%). Saving recomputes all term grades.</p>
        </div>
        <form onsubmit="handleSaveWeights(event)" class="grid grid-cols-3 gap-3">
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
          <div class="col-span-3 flex justify-end">
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
  const attendance = parseFloat(document.getElementById('wAttendance').value);
  if ([quiz, activity, attendance].some(v => isNaN(v) || v < 0)) {
    showToast('Enter valid percentages.', 'error');
    return;
  }
  if (Math.abs(quiz + activity + attendance - 100) > 0.001) {
    showToast(`Weights must total 100% (currently ${quiz + activity + attendance}%).`, 'error');
    return;
  }
  appState.settings.weights = { quiz, activity, attendance };
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

  const sm = getStudentSummary(student);

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

        <button type="button" onclick="openTranscriptModal('${student.id}')" class="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          <span>Download PDF Transcript</span>
        </button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="glass-panel p-5 rounded-2xl">
          <span class="text-xs font-bold text-slate-500 uppercase">General Weighted Average</span>
          <div class="text-3xl font-black text-brand-600 dark:text-amber-400 mt-2 font-mono">${formatGwa(sm.gwa)}</div>
          <p class="text-xs text-slate-400 mt-1">1.00 Highest • 3.00 Passing</p>
        </div>

        <div class="glass-panel p-5 rounded-2xl">
          <span class="text-xs font-bold text-slate-500 uppercase">Academic Standing</span>
          <div class="mt-2">
            <span class="px-3 py-1 rounded-full text-xs font-bold bg-${sm.standing.color}-500/10 text-${sm.standing.color}-600 dark:text-${sm.standing.color}-400">
              ${sm.standing.label}
            </span>
          </div>
          <p class="text-xs text-slate-400 mt-2">Current term evaluation</p>
        </div>

        <div class="glass-panel p-5 rounded-2xl">
          <span class="text-xs font-bold text-slate-500 uppercase">Subjects Passed</span>
          <div class="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">${sm.passedCount} / ${sm.rows.length}</div>
          <p class="text-xs text-slate-400 mt-1">${sm.failedCount} failed, ${sm.incCount} incomplete</p>
        </div>

        <div class="glass-panel p-5 rounded-2xl">
          <span class="text-xs font-bold text-slate-500 uppercase">Credited Units</span>
          <div class="text-3xl font-black text-slate-900 dark:text-white mt-2 font-mono">${sm.unitsEvaluated} / ${sm.totalUnits}</div>
          <p class="text-xs text-slate-400 mt-1">Successfully earned units</p>
        </div>
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <h2 class="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Official 3–Term Grade Breakdown</h2>
        <div id="gradeCanvasWrap" class="overflow-x-auto protected-grades" oncontextmenu="return false" ondragstart="return false">
          <canvas id="gradeCanvas" role="img" aria-label="Official grade breakdown (image)" oncontextmenu="return false"></canvas>
        </div>
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">Class Standing Breakdown</h2>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Quizzes ${getWeights().quiz}% + Activities ${getWeights().activity}% + Attendance ${getWeights().attendance}% • View only</p>
          </div>
          <div class="flex rounded-xl bg-slate-200/80 dark:bg-slate-800/80 p-1 border border-slate-300 dark:border-slate-700/60 w-full md:w-auto">
            ${TERMS.map(t => `
              <button type="button" onclick="setStudentTerm('${t.key}')" class="flex-1 md:flex-none px-5 py-2 text-xs font-bold rounded-lg transition-all ${uiState.studentTerm === t.key ? 'bg-brand-500 text-white shadow-md' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}">${t.label}</button>
            `).join('')}
          </div>
        </div>
        <div id="compCanvasWrap" class="overflow-x-auto protected-grades" oncontextmenu="return false" ondragstart="return false">
          <canvas id="compCanvas" role="img" aria-label="Quizzes, activities and attendance breakdown (image)" oncontextmenu="return false"></canvas>
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
  console.log("Opening transcript modal for student ID:", studentId);
  const student = appState.students.find(s => String(s.id) === String(studentId));
  
  if (!student) {
    showToast('Student record not found for ID: ' + studentId, 'error');
    console.error("Student not found in appState.students:", studentId, appState.students);
    return;
  }

  activeTranscriptState = {
    studentId: student.id,
    recipient: 'guardian',
    passwordMode: 'pin',
    note: ''
  };

  renderTranscriptModal();
}

function renderTranscriptModal() {
  const modalRoot = document.getElementById('modalRoot');
  if (!activeTranscriptState) {
    modalRoot.innerHTML = '';
    return;
  }

  const student = appState.students.find(s => s.id === activeTranscriptState.studentId);
  if (!student) {
    modalRoot.innerHTML = '';
    return;
  }
  
  const sm = getStudentSummary(student);

  const passVal = activeTranscriptState.passwordMode === 'pin' ? student.parent.pin : student.id;
  const passLabel = activeTranscriptState.passwordMode === 'pin' ? 'Parent PIN' : 'School ID';
  const targetEmail = activeTranscriptState.recipient === 'student' ? student.email : (activeTranscriptState.recipient === 'guardian' ? student.parent.email : `${student.email}, ${student.parent.email}`);

  // Declare emailSubject and emailBody here BEFORE the template string
  const emailSubject = `Official Report of Grades - ${student.name}`;
  const emailBody = `Good day,\n\nAttached is the password-protected report of grades for ${student.name} (${student.section}). To open the PDF document, please use your secure ${passLabel}: ${passVal}.\n\n${activeTranscriptState.note ? 'Teacher Note: ' + activeTranscriptState.note + '\n\n' : ''}*** This is an auto-generated email. DO NOT REPLY TO THIS MESSAGE ***`;

  modalRoot.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div class="glass-panel w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div class="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 class="text-lg font-black text-slate-900 dark:text-white">Official Transcript & Email Dispatch</h2>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${student.name} (${student.id}) • ${student.section}</p>
          </div>
          <button type="button" onclick="closeTranscriptModal()" class="p-2 rounded-xl text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-all">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div class="p-6 overflow-y-auto space-y-6 flex-1">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="space-y-4">
              <div class="space-y-2">
                <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Recipient</label>
                <div class="grid grid-cols-3 gap-2">
                  <button type="button" onclick="activeTranscriptState.recipient='student'; renderTranscriptModal();" class="py-2.5 rounded-xl font-bold text-xs border transition-all ${activeTranscriptState.recipient === 'student' ? 'bg-brand-500 text-white border-brand-500 shadow-md' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">Student</button>
                  <button type="button" onclick="activeTranscriptState.recipient='guardian'; renderTranscriptModal();" class="py-2.5 rounded-xl font-bold text-xs border transition-all ${activeTranscriptState.recipient === 'guardian' ? 'bg-brand-500 text-white border-brand-500 shadow-md' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">Guardian</button>
                  <button type="button" onclick="activeTranscriptState.recipient='both'; renderTranscriptModal();" class="py-2.5 rounded-xl font-bold text-xs border transition-all ${activeTranscriptState.recipient === 'both' ? 'bg-brand-500 text-white border-brand-500 shadow-md' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">Both</button>
                </div>
              </div>

              <div class="space-y-2">
                <label class="text-xs font-bold text-slate-700 dark:text-slate-300">PDF Password Protection</label>
                <div class="grid grid-cols-2 gap-2">
                  <button type="button" onclick="activeTranscriptState.passwordMode='pin'; renderTranscriptModal();" class="py-2.5 rounded-xl font-bold text-xs border transition-all ${activeTranscriptState.passwordMode === 'pin' ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">Parent PIN (${student.parent.pin})</button>
                  <button type="button" onclick="activeTranscriptState.passwordMode='id'; renderTranscriptModal();" class="py-2.5 rounded-xl font-bold text-xs border transition-all ${activeTranscriptState.passwordMode === 'id' ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'}">School ID (${student.id})</button>
                </div>
              </div>

              <div class="space-y-1">
                <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Additional Message / Note</label>
                <textarea id="modalNote" oninput="activeTranscriptState.note = this.value" placeholder="Optional notes from teacher..." class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-amber-400" rows="3">${activeTranscriptState.note}</textarea>
              </div>
            </div>

            <div class="bg-slate-900 text-slate-100 p-5 rounded-2xl space-y-3 font-mono text-xs flex flex-col justify-between border border-slate-800">
              <div class="space-y-2">
                <div class="flex items-center justify-between text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                  <span>Simulated Email Dispatch</span>
                  <span>SMTP Secure</span>
                </div>
                <div class="text-slate-400">Sender: <span class="text-white">universityoftheassumptiongrades@ua.edu.ph</span></div>
                <div class="text-slate-400">To: <span class="text-white">${targetEmail}</span></div>
                <div class="text-slate-400 pt-1 border-t border-slate-800">Subject: ${emailSubject}</div>
                <div class="bg-slate-950 p-3 rounded-xl text-slate-300 whitespace-pre-line mt-2 text-[11px] leading-relaxed border border-slate-800/80">${emailBody}</div>
              </div>
              <button type="button" onclick="copyEmailDraftText('${targetEmail.replace(/'/g, "\\'")}', '${emailBody.replace(/'/g, "\\'").replace(/\n/g, '\\n')}')" class="w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all">
                Copy Email Draft & Message
              </button>
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

           <div class="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
              <button type="button" onclick="closeTranscriptModal()" class="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs">Cancel</button>
              <button type="button" onclick="dispatchTranscriptAndPDF()" class="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-all">
                📥 Download PDF
           </button>
              <a href="https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}" target="_blank" rel="noopener noreferrer" onclick="dispatchTranscriptAndPDF()" class="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2">
                <span>✉️ Download PDF & Open Gmail</span>
              </a>
         </div>
      </div>
    </div>
  `;
}

function closeTranscriptModal() {
  activeTranscriptState = null;
  renderTranscriptModal();
}

function copyEmailDraftText(to, body) {
  const fullText = `To: ${to}\nSender: universityoftheassumptiongrades@ua.edu.ph\n\n${body}`;
  navigator.clipboard.writeText(fullText).then(() => {
    showToast('Email draft and message copied to clipboard!', 'success');
  });
}

function dispatchTranscriptAndPDF() {
  const st = appState.students.find(s => s.id === activeTranscriptState.studentId);
  const sm = getStudentSummary(st);
  const password = activeTranscriptState.passwordMode === 'pin' ? st.parent.pin : st.id;
  const passLabel = activeTranscriptState.passwordMode === 'pin' ? 'Parent PIN' : 'School ID';

  if (!window.jspdf) {
    showToast('jsPDF library failed to load. Check internet connection.', 'error');
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    encryption: {
      userPassword: password,
      ownerPassword: 'ua_admin_secure_key_2026',
      userPermissions: ['print']
    }
  });

  const S = appState.settings;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(S.school, 105, 15, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Official Report of Grades • ${S.term}`, 105, 21, { align: 'center' });

  doc.setFontSize(9);
  doc.text(`Student Name: ${st.name}`, 14, 32);
  doc.text(`School ID: ${st.id}`, 14, 38);
  doc.text(`Course & Section: ${st.course} - ${st.section}`, 120, 32);
  doc.text(`Date Issued: ${new Date().toLocaleDateString()}`, 120, 38);

  let y = 48;
  doc.setFont('helvetica', 'bold');
  doc.text('Code', 14, y);
  doc.text('Subject Title', 36, y);
  doc.text('Units', 120, y, { align: 'center' });
  doc.text('Grade', 150, y, { align: 'center' });
  doc.text('Status', 185, y, { align: 'center' });

  doc.setLineWidth(0.3);
  doc.line(14, y + 2, 196, y + 2);
  y += 8;

  doc.setFont('helvetica', 'normal');
  sm.rows.forEach(r => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.text(r.sub.code, 14, y);
    doc.text(r.sub.title.substring(0, 42), 36, y);
    doc.text(String(r.sub.units), 120, y, { align: 'center' });
    doc.text(formatGradeEq(r.calc.eq), 150, y, { align: 'center' });
    doc.text(r.calc.status.toUpperCase(), 185, y, { align: 'center' });
    y += 7;
  });

  y += 6;
  doc.line(14, y, 196, y);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text(`General Weighted Average (GWA): ${formatGwa(sm.gwa)}`, 14, y);
  doc.text(`Standing: ${sm.standing.label}`, 14, y + 6);

  if (activeTranscriptState.note) {
    y += 16;
    doc.setFont('helvetica', 'bold');
    doc.text('Teacher Note:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(activeTranscriptState.note, 14, y + 6);
  }

  const filename = `UA_Grades_${st.id}_${st.section}.pdf`;
  doc.save(filename);

  appState.log.unshift({
    when: new Date().toLocaleString(),
    sid: st.id,
    name: st.name,
    to: activeTranscriptState.recipient,
    pwLabel,
    file: filename
  });
  saveState();
  renderApp();
  showToast('PDF Transcript downloaded successfully!', 'success');
}

function openGmailWebDraft() {
  const st = appState.students.find(s => s.id === activeTranscriptState.studentId);
  const password = activeTranscriptState.passwordMode === 'pin' ? st.parent.pin : st.id;
  const passLabel = activeTranscriptState.passwordMode === 'pin' ? 'Parent PIN' : 'School ID';
  const targetEmail = activeTranscriptState.recipient === 'student' ? st.email : (activeTranscriptState.recipient === 'guardian' ? st.parent.email : st.parent.email);
  
  const emailSubject = `Official Report of Grades - ${st.name}`;
  const emailBody = `Good day,\n\nAttached is the password-protected report of grades for ${st.name} (${st.section}). To open the PDF document, please use your secure ${passLabel}: ${password}.\n\n${activeTranscriptState.note ? 'Teacher Note: ' + activeTranscriptState.note + '\n\n' : ''}*** This is an auto-generated email. DO NOT REPLY TO THIS MESSAGE ***`;

  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  window.open(gmailUrl, '_blank');
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

  const cols = [
    { key: 'code', w: 96, align: 'left', label: 'CODE' },
    { key: 'title', w: 0, align: 'left', label: 'SUBJECT TITLE' },
    { key: 'units', w: 64, align: 'center', label: 'UNITS' },
    { key: 'p', w: 80, align: 'center', label: 'PRELIM' },
    { key: 'm', w: 84, align: 'center', label: 'MIDTERM' },
    { key: 'pf', w: 90, align: 'center', label: 'PRE-FINAL' },
    { key: 'pct', w: 100, align: 'center', label: 'AVERAGE %' },
    { key: 'eq', w: 80, align: 'center', label: 'GRADE' },
    { key: 'status', w: 120, align: 'center', label: 'STATUS' }
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
  const fmt = v => (v === null || v === undefined || v === '') ? '-' : String(v);

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

    // status pill
    const si = cols.length - 1, sc = cols[si];
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

function drawCompCanvas() {
  const canvas = document.getElementById('compCanvas');
  const wrap = document.getElementById('compCanvasWrap');
  if (!canvas || !wrap || !authUser || authUser.role !== 'student') return;
  const student = appState.students.find(s => s.id === authUser.studentId);
  if (!student) return;
  const sm = getStudentSummary(student);
  const term = uiState.studentTerm || 'p';

  const dark = uiState.darkMode;
  const C = dark
    ? { text: '#e2e8f0', muted: '#94a3b8', line: 'rgba(148,163,184,0.18)', code: '#fbbf24', accent: '#fbbf24' }
    : { text: '#1e293b', muted: '#94a3b8', line: 'rgba(148,163,184,0.35)', code: '#002B66', accent: '#002B66' };

  const cols = [
    { w: 90, align: 'left', label: 'CODE', font: 'code' },
    { w: 0, align: 'left', label: 'SUBJECT TITLE', font: 'title' },
    { w: 110, align: 'center', label: 'QUIZZES', font: 'mono' },
    { w: 80, align: 'center', label: 'QUIZ %', font: 'mono' },
    { w: 110, align: 'center', label: 'ACTIVITIES', font: 'mono' },
    { w: 90, align: 'center', label: 'ACTIVITY %', font: 'mono' },
    { w: 110, align: 'center', label: 'ATTENDANCE', font: 'mono' },
    { w: 100, align: 'center', label: 'ATTEND. %', font: 'mono' },
    { w: 100, align: 'center', label: 'TERM GRADE', font: 'grade' }
  ];
  const fixed = cols.reduce((a, c) => a + c.w, 0);
  const W = Math.max(wrap.clientWidth || 0, fixed + 260);
  cols[1].w = W - fixed;

  const headerH = 44, rowH = 48, H = headerH + rowH * sm.rows.length + 4;
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
  const pairTxt = (a, b) => (a === null || a === undefined || b === null || b === undefined || a === '' || b === '') ? '-' : `${a} / ${b}`;
  const pctTxt = v => (v === null || v === undefined) ? '-' : v.toFixed(1) + '%';

  ctx.textBaseline = 'middle';
  ctx.font = `700 10px ${SANS}`;
  cols.forEach((c, i) => {
    ctx.fillStyle = C.muted;
    ctx.textAlign = c.align === 'left' ? 'left' : 'center';
    ctx.fillText(c.label, place(c, i), headerH / 2);
  });
  ctx.strokeStyle = C.line; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, headerH + 0.5); ctx.lineTo(W, headerH + 0.5); ctx.stroke();

  sm.rows.forEach((r, ri) => {
    const cy = headerH + ri * rowH + rowH / 2;
    const rec = r.g || {};
    const tc = (rec.comp || {})[term] || {};
    const cc = calcComponents(tc);
    const tg = rec[term];
    const vals = [
      r.sub.code, r.sub.title,
      pairTxt(tc.qs, tc.qt), pctTxt(cc.q),
      pairTxt(tc.acs, tc.act), pctTxt(cc.a),
      pairTxt(tc.ap, tc.ad), pctTxt(cc.att),
      (tg === null || tg === undefined) ? '-' : Number(tg).toFixed(1) + '%'
    ];
    cols.forEach((c, i) => {
      ctx.textAlign = c.align === 'left' ? 'left' : 'center';
      if (c.font === 'code') { ctx.font = `700 12px ${MONO}`; ctx.fillStyle = C.code; }
      else if (c.font === 'title') { ctx.font = `600 12px ${SANS}`; ctx.fillStyle = C.text; }
      else if (c.font === 'grade') { ctx.font = `800 13px ${MONO}`; ctx.fillStyle = C.accent; }
      else { ctx.font = `400 12px ${MONO}`; ctx.fillStyle = C.text; }
      const t = c.font === 'title' ? fit(String(vals[i]), c.w - 24) : String(vals[i]);
      ctx.fillText(t, place(c, i), cy);
    });
    if (ri < sm.rows.length - 1) {
      ctx.strokeStyle = C.line;
      ctx.beginPath(); ctx.moveTo(0, headerH + (ri + 1) * rowH + 0.5); ctx.lineTo(W, headerH + (ri + 1) * rowH + 0.5); ctx.stroke();
    }
  });
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
  renderApp();
});
