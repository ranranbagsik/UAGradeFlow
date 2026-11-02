/* ==========================================================================
   1. DATA MODELS & LOCAL STORAGE MANAGEMENT
   ========================================================================== */
const STORAGE_KEY = 'ua_gradeflow_v5_store';
const AUTH_KEY = 'ua_gradeflow_v5_auth';

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
      term: '1st Semester, A.Y. 2026-2027'
    },
    subjects: generateSubjectsSeed(),
    courses: [...COURSES],
    sections: [...SECTIONS],
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
  appState = generateCleanStateData();
  saveState();
  renderApp();
  showToast('Database reset to empty state.', 'info');
}

/* ==========================================================================
   2. ACADEMIC EVALUATION (PRELIM, MIDTERM, FINAL)
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
  const { p, m, f } = gradeRecord;
  const hasP = p !== null && p !== undefined && p !== '';
  const hasM = m !== null && m !== undefined && m !== '';
  const hasF = f !== null && f !== undefined && f !== '';

  if (!hasP && !hasM && !hasF) return { status: 'none', pct: null, eq: null };
  if (!hasP || !hasM || !hasF) return { status: 'inc', pct: null, eq: null };

  const pct = (parseFloat(p) + parseFloat(m) + parseFloat(f)) / 3;
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
    { id: '2026000101', name: 'Maria Clarissa Santos', course: sectionId.split('-')[0], section: sectionId, email: 'maria.santos@student.ua.edu.ph', pName: 'Juan Santos', pEmail: 'parent.santos@example.com', pin: '123456' },
    { id: '2026000102', name: 'Juan Miguel Dela Cruz', course: sectionId.split('-')[0], section: sectionId, email: 'juan.delacruz@student.ua.edu.ph', pName: 'Maria Dela Cruz', pEmail: 'parent.delacruz@example.com', pin: '654321' }
  ];
  
  const sectionSubjects = appState.subjects.filter(s => s.course === sectionId.split('-')[0]);
  
  let csvContent = `School ID,Student Name,Course,Section,Student Email,Guardian Name,Guardian Email,Guardian PIN`;
  sectionSubjects.forEach(sub => {
    csvContent += `,${sub.code}_Prelim,${sub.code}_Midterm,${sub.code}_Final`;
  });
  csvContent += `\n`;

  sampleStudents.forEach(st => {
    let row = `"${st.id}","${st.name}","${st.course}","${st.section}","${st.email}","${st.pName}","${st.pEmail}","${st.pin}"`;
    sectionSubjects.forEach(() => {
      row += `,90,92,94`;
    });
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
    csvContent += `,${sub.code}_Prelim,${sub.code}_Midterm,${sub.code}_Final`;
  });
  csvContent += `\n`;

  sectionStudents.forEach(st => {
    let row = `"${st.id}","${st.name}","${st.course}","${st.section}","${st.email}","${st.parent.name}","${st.parent.email}","${st.parent.pin}"`;
    sectionSubjects.forEach(sub => {
      const g = (appState.grades[st.id] || {})[sub.id] || { p: '', m: '', f: '' };
      row += `,${g.p ?? ''},${g.m ?? ''},${g.f ?? ''}`;
    });
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

    let student = appState.students.find(s => s.id === id);
    if (!student) {
      student = { id, name, course, section: sec, email, parent: { name: pName, email: pEmail, pin: pPin } };
      appState.students.push(student);
    } else {
      student.name = name;
      student.course = course;
      student.section = sec;
      student.email = email;
    }

    if (!appState.grades[id]) appState.grades[id] = {};

    const sectionSubjects = appState.subjects.filter(s => s.course === course);
    sectionSubjects.forEach(sub => {
      const pIdx = headers.indexOf(`${sub.code}_Prelim`);
      const mIdx = headers.indexOf(`${sub.code}_Midterm`);
      const fIdx = headers.indexOf(`${sub.code}_Final`);

      const pVal = pIdx !== -1 && cols[pIdx] !== '' ? parseFloat(cols[pIdx]) : null;
      const mVal = mIdx !== -1 && cols[mIdx] !== '' ? parseFloat(cols[mIdx]) : null;
      const fVal = fIdx !== -1 && cols[fIdx] !== '' ? parseFloat(cols[fIdx]) : null;

      appState.grades[id][sub.id] = {
        p: isNaN(pVal) ? null : pVal,
        m: isNaN(mVal) ? null : mVal,
        f: isNaN(fVal) ? null : fVal
      };
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
  entryFilter: { course: 'BSIT', section: 'BSIT-1A', subject: 'BSIT-IT101', search: '' },
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
              <input type="text" id="tLoginUser" value="markanthonymadalipay" required class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:border-amber-400 focus:outline-none" />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Password</label>
              <div class="relative">
                <input type="${uiState.teacherPasswordVisible ? 'text' : 'password'}" id="tLoginPass" value="madd79" required class="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:border-amber-400 focus:outline-none" />
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
              <label class="text-xs font-bold text-slate-700 dark:text-slate-300">Select Student Account</label>
              ${appState.students.length ? `
                <select id="sLoginStudentId" class="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:border-amber-400 focus:outline-none">
                  ${appState.students.map(s => `<option value="${s.id}">${s.name} (${s.id} - ${s.section})</option>`).join('')}
                </select>
              ` : `
                <p class="text-xs text-rose-500 font-semibold p-2 bg-rose-50 dark:bg-rose-950/50 rounded-lg">No enrolled students in database. Teachers must import or register students first.</p>
              `}
            </div>
            <button type="submit" ${!appState.students.length ? 'disabled' : ''} class="w-full py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-brand-500/30 transition-all">
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
  const username = document.getElementById('tLoginUser').value.trim();
  const pass = document.getElementById('tLoginPass').value.trim();
  if (username === 'markanthonymadalipay' && pass === 'madd79') {
    setAuth({ role: 'teacher', name: 'Prof. Mark Anthony Madalipay', email: 'mark.madalipay@ua.edu.ph' });
    showToast('Welcome back, Prof. Mark Anthony Madalipay!', 'success');
  } else {
    showToast('Invalid faculty username or password.', 'error');
  }
}

function handleStudentLogin(e) {
  e.preventDefault();
  const select = document.getElementById('sLoginStudentId');
  if (!select) return;
  const sid = select.value;
  const st = appState.students.find(s => s.id === sid);
  if (st) {
    setAuth({ role: 'student', studentId: st.id, name: st.name });
    showToast(`Signed in as ${st.name}`, 'success');
  }
}

/* ==========================================================================
   6. MAIN NAVIGATION & LAYOUT
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
    <div class="flex h-screen overflow-hidden">
      <aside class="w-64 glass-sidebar flex flex-col justify-between p-4 flex-shrink-0">
        <div class="space-y-6">
          <div class="flex items-center gap-3 px-2">
            ${getUASealSVG("w-9 h-9")}
            <div>
              <h2 class="font-black text-sm text-brand-500 dark:text-amber-400 leading-tight">UA GradeFlow</h2>
              <p class="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase">Academic System</p>
            </div>
          </div>

          <nav class="space-y-1">
            ${navItems.map(item => `
              <button type="button" onclick="switchPage('${item.id}')" 
                class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-xs transition-all ${uiState.activePage === item.id ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'}">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">${item.icon}</svg>
                <span>${item.label}</span>
              </button>
            `).join('')}
          </nav>
        </div>

        <div class="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <button type="button" onclick="toggleTheme()" class="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all hover:bg-slate-300/70 dark:hover:bg-slate-700">
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
              ${isTeacher ? 'MM' : (student ? student.name.split(' ').map(n=>n[0]).slice(0,2).join('') : 'ST')}
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

      <main class="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
        ${renderActivePage()}
      </main>
    </div>
  `;
}

function switchPage(pageId) {
  uiState.activePage = pageId;
  renderApp();
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
   8. GRADE ENTRY PAGE (3-TERM)
   ========================================================================== */
function renderGradeEntryPage() {
  const courseSubjects = appState.subjects.filter(s => s.course === uiState.entryFilter.course);
  const activeSub = courseSubjects.find(s => s.id === uiState.entryFilter.subject) || courseSubjects[0];
  const sectionStudents = appState.students.filter(s => s.section === uiState.entryFilter.section && (
    !uiState.entryFilter.search || 
    s.name.toLowerCase().includes(uiState.entryFilter.search.toLowerCase()) || 
    s.id.includes(uiState.entryFilter.search)
  ));

  return `
    <div class="space-y-6">
      <div class="glass-panel p-6 rounded-2xl space-y-4">
        <div>
          <h1 class="text-xl font-black text-slate-800 dark:text-slate-100">3–Term Grade Entry Matrix</h1>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Input raw numerical scores (0–100) for Prelim, Midterm, and Final.</p>
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
        ` : ''}
      </div>

      <div class="glass-panel p-6 rounded-2xl space-y-4">
        ${!activeSub || sectionStudents.length === 0 ? `
          <div class="text-center py-16 text-slate-500 text-xs">
            ${!activeSub ? 'Please select a valid subject.' : `No students found in section <b>${uiState.entryFilter.section}</b> matching your search.`}
          </div>
        ` : `
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                  <th class="py-3 px-4">Student Name</th>
                  <th class="py-3 px-4 w-28">Prelim</th>
                  <th class="py-3 px-4 w-28">Midterm</th>
                  <th class="py-3 px-4 w-28">Final</th>
                  <th class="py-3 px-4 text-center">Average %</th>
                  <th class="py-3 px-4 text-center">Equiv Grade</th>
                  <th class="py-3 px-4 text-center">Status</th>
                  <th class="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
                ${sectionStudents.map(st => {
                  const g = (appState.grades[st.id] || {})[activeSub.id] || { p: '', m: '', f: '' };
                  const calc = calculateSubjectGrade(g);
                  const statusColors = {
                    passed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                    failed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                    inc: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                    none: 'bg-slate-500/10 text-slate-500'
                  };
                  return `
                    <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td class="py-3 px-4">
                        <div class="font-bold text-slate-800 dark:text-slate-200">${st.name}</div>
                        <div class="text-[10px] text-slate-400 font-mono">${st.id}</div>
                      </td>
                      <td class="py-3 px-4">
                        <input type="number" min="0" max="100" step="0.1" value="${g.p !== null && g.p !== undefined ? g.p : ''}" onchange="updateGradeScore('${st.id}', '${activeSub.id}', 'p', this.value)" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-center focus:outline-none focus:border-amber-400" />
                      </td>
                      <td class="py-3 px-4">
                        <input type="number" min="0" max="100" step="0.1" value="${g.m !== null && g.m !== undefined ? g.m : ''}" onchange="updateGradeScore('${st.id}', '${activeSub.id}', 'm', this.value)" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-center focus:outline-none focus:border-amber-400" />
                      </td>
                      <td class="py-3 px-4">
                        <input type="number" min="0" max="100" step="0.1" value="${g.f !== null && g.f !== undefined ? g.f : ''}" onchange="updateGradeScore('${st.id}', '${activeSub.id}', 'f', this.value)" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono text-xs text-center focus:outline-none focus:border-amber-400" />
                      </td>
                      <td class="py-3 px-4 text-center font-mono font-semibold">${calc.pct !== null ? calc.pct.toFixed(1) + '%' : '-'}</td>
                      <td class="py-3 px-4 text-center font-mono font-black text-brand-600 dark:text-amber-400">${formatGradeEq(calc.eq)}</td>
                      <td class="py-3 px-4 text-center">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${statusColors[calc.status]}">
                          ${calc.status}
                        </span>
                      </td>
                      <td class="py-3 px-4 text-right">
                        <button type="button" onclick="openTranscriptModal('${st.id}')" class="px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500 hover:text-white font-bold transition-all text-xs">
                          PDF Transcript
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

function updateGradeScore(studentId, subjectId, termKey, val) {
  if (!appState.grades[studentId]) appState.grades[studentId] = {};
  if (!appState.grades[studentId][subjectId]) appState.grades[studentId][subjectId] = { p: null, m: null, f: null };
  
  const num = val === '' ? null : parseFloat(val);
  appState.grades[studentId][subjectId][termKey] = isNaN(num) ? null : num;
  saveState();
  renderApp();
  showToast('Grade updated successfully!', 'success');
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
                    <td class="py-3 px-4 font-mono font-bold text-amber-600 dark:text-amber-400">${st.parent.pin}</td>
                    <td class="py-3 px-4 text-right space-x-2">
                      <button type="button" onclick="openTranscriptModal('${st.id}')" class="px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500 hover:text-white font-bold transition-all text-xs">
                        Transcript
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
    parent: { name: pName, email: pEmail, pin }
  };

  appState.students.push(newStudent);
  appState.grades[id] = {};
  saveState();
  renderApp();
  showToast(`Successfully enrolled ${name} into ${sectionId}!`, 'success');
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
        <h2 class="text-sm font-black text-rose-600 uppercase tracking-wider">Danger Zone</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400">Resetting the database clears all students, sections, and grade records back to a clean state.</p>
        <button type="button" onclick="if(confirm('Reset all data?')) resetStateToDefault();" class="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white font-bold text-xs transition-all">
          Reset Database
        </button>
      </div>
    </div>
  `;
}

function handleSaveSettings(e) {
  e.preventDefault();
  appState.settings = {
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
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead>
              <tr class="border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                <th class="py-3 px-4">Code</th>
                <th class="py-3 px-4">Subject Title</th>
                <th class="py-3 px-4 text-center">Units</th>
                <th class="py-3 px-4 text-center">Prelim</th>
                <th class="py-3 px-4 text-center">Midterm</th>
                <th class="py-3 px-4 text-center">Final</th>
                <th class="py-3 px-4 text-center">Average %</th>
                <th class="py-3 px-4 text-center">Grade</th>
                <th class="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
              ${sm.rows.map(r => {
                const g = r.g || { p: '-', m: '-', f: '-' };
                return `
                  <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td class="py-3 px-4 font-mono font-bold text-brand-600 dark:text-amber-400">${r.sub.code}</td>
                    <td class="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">${r.sub.title}</td>
                    <td class="py-3 px-4 text-center font-mono">${r.sub.units}</td>
                    <td class="py-3 px-4 text-center font-mono">${g.p ?? '-'}</td>
                    <td class="py-3 px-4 text-center font-mono">${g.m ?? '-'}</td>
                    <td class="py-3 px-4 text-center font-mono">${g.f ?? '-'}</td>
                    <td class="py-3 px-4 text-center font-mono font-semibold">${r.calc.pct !== null ? r.calc.pct.toFixed(1) + '%' : '-'}</td>
                    <td class="py-3 px-4 text-center font-mono font-black text-brand-600 dark:text-amber-400">${formatGradeEq(r.calc.eq)}</td>
                    <td class="py-3 px-4 text-center">
                      <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${r.calc.status === 'passed' ? 'bg-emerald-500/10 text-emerald-600' : r.calc.status === 'failed' ? 'bg-rose-500/10 text-rose-600' : 'bg-amber-500/10 text-amber-600'}">
                        ${r.calc.status}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
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
  const student = appState.students.find(s => s.id === studentId);
  if (!student) return;

  activeTranscriptState = {
    studentId,
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
  const sm = getStudentSummary(student);
  const passVal = activeTranscriptState.passwordMode === 'pin' ? student.parent.pin : student.id;
  const targetEmail = activeTranscriptState.recipient === 'student' ? student.email : (activeTranscriptState.recipient === 'guardian' ? student.parent.email : `${student.email}, ${student.parent.email}`);
  const passLabel = activeTranscriptState.passwordMode === 'pin' ? 'Parent PIN' : 'School ID';

  const emailBody = `Good day,\n\nAttached is the password-protected report of grades for ${student.name} (${student.section}). To open the PDF document, please use your secure ${passLabel}: ${passVal}.\n\n*** This is an auto-generated email. DO NOT REPLY TO THIS MESSAGE ***`;

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
                <div class="text-slate-400 pt-1 border-t border-slate-800">Subject: Official Report of Grades - ${student.name} (${appState.settings.term})</div>
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
          <button type="button" onclick="dispatchTranscriptAndPDF()" class="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            <span>Send Email & Download PDF</span>
          </button>
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

  const targetEmail = activeTranscriptState.recipient === 'student' ? st.email : (activeTranscriptState.recipient === 'guardian' ? st.parent.email : st.parent.email);
  const emailSubject = `Official Report of Grades - ${st.name}`;
  const emailBody = `Good day,\n\nAttached is the password-protected report of grades for ${st.name} (${st.section}). To open the PDF document, please use your secure ${passLabel}: ${password}.\n\n${activeTranscriptState.note ? 'Teacher Note: ' + activeTranscriptState.note + '\n\n' : ''}*** This is an auto-generated email. DO NOT REPLY TO THIS MESSAGE ***`;

  // Open Gmail Web directly in a new tab with pre-filled fields
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(targetEmail)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
  window.open(gmailUrl, '_blank');

  closeTranscriptModal();
  renderApp();
  showToast('PDF downloaded & Gmail Web opened in new tab!', 'success');
}

/* ==========================================================================
   16. APPLICATION BOOTSTRAP & INITIALIZATION
   ========================================================================== */
function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;

  if (!authUser) {
    root.innerHTML = renderLoginPage();
  } else {
    root.innerHTML = renderMainLayout();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderApp();
});