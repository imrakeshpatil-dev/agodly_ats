const STORAGE_KEY = "agodly_ats_frontend_state_v2";
const API_BASE_KEY = "agodly_ats_api_base";
const CURRENT_USER_ID_KEY = "agodly_ats_current_user_id";
const AUTH_TOKEN_KEY = "agodly_ats_auth_token";
const AUTH_USER_KEY = "agodly_ats_auth_user";
const CANDIDATE_VIEWS_KEY = "agodly_ats_candidate_views_v1";
const AGODLY_EMAIL_DOMAIN = "@agodly.com";
const RUNTIME_API_BASE =
  typeof window !== "undefined" && typeof window.AGODLY_API_BASE === "string"
    ? String(window.AGODLY_API_BASE).trim()
    : "";
const DEFAULT_API_BASE =
  RUNTIME_API_BASE && /^https?:\/\//.test(RUNTIME_API_BASE)
    ? RUNTIME_API_BASE
    : typeof window !== "undefined" && /^https?:\/\//.test(String(window.location.origin || ""))
      ? window.location.origin
    : "http://localhost:4000";
const API_ROUTES = {
  authLogin: "/api/auth/login",
  authLogout: "/api/auth/logout",
  authMe: "/api/auth/me",
  authPassword: "/api/auth/password",
  readiness: "/ready",
  diagnostics: "/api/diagnostics",
  bootstrap: "/api/bootstrap",
  bootstrapSync: "/api/bootstrap/sync",
  parseBulkUpload: "/api/bulk-upload/parse",
  listCandidates: "/api/candidates",
  createCandidate: "/api/candidates",
  getCandidate: (candidateId) => `/api/candidates/${encodeURIComponent(candidateId)}`,
  candidateResume: (candidateId) => `/api/candidates/${encodeURIComponent(candidateId)}/resume`,
  listDuplicates: "/api/candidates/duplicates",
  mergeDuplicate: "/api/candidates/merge",
  ignoreDuplicate: (duplicateId) => `/api/candidates/duplicates/${encodeURIComponent(duplicateId)}/ignore`,
  updateCandidate: (candidateId) => `/api/candidates/${encodeURIComponent(candidateId)}`,
  reparseCandidate: (candidateId) => `/api/candidates/${encodeURIComponent(candidateId)}/reparse-ai`,
  deleteCandidate: (candidateId) => `/api/candidates/${encodeURIComponent(candidateId)}/delete`,
  restoreCandidate: (candidateId) => `/api/candidates/${encodeURIComponent(candidateId)}/restore`,
  aiChat: "/api/ai/chat",
  aiFeedback: "/api/ai/feedback",
  aiMatchScore: "/api/ai/match-score",
  jobs: "/api/jobs",
  job: (jobId) => `/api/jobs/${encodeURIComponent(jobId)}`,
  jobStatus: (jobId) => `/api/jobs/${encodeURIComponent(jobId)}/status`,
  jobArchive: (jobId) => `/api/jobs/${encodeURIComponent(jobId)}/archive`,
  jobDuplicate: (jobId) => `/api/jobs/${encodeURIComponent(jobId)}/duplicate`,
  jobCandidatePool: (jobId) => `/api/jobs/${encodeURIComponent(jobId)}/candidate-pool`,
  founderReview: (candidateId) => `/api/candidates/${encodeURIComponent(candidateId)}/founder-review`,
  jobInsights: "/api/jobs/insights",
  insightCandidatePool: "/api/jobs/insights/candidate-pool"
};
const BULK_MAX_FILE_SIZE = 10 * 1024 * 1024;
const BULK_ALLOWED_EXTENSIONS = new Set(["csv", "xlsx", "pdf", "doc", "docx"]);
const BULK_CV_EXTENSIONS = new Set(["pdf", "doc", "docx"]);
const SHARED_STATE_REFRESH_INTERVAL_MS = 15_000;
let pipelineDragState = null;

const PIPELINE_STAGES = ["Identified", "Qualified", "Submitted", "Client Review", "Interview", "Offer", "Onboarded", "On Hold", "Pool", "Dropped"];
const PIPELINE_DISPOSITION_STAGES = new Set(["On Hold", "Pool"]);
const PIPELINE_INACTIVE_STAGES = new Set(["Onboarded", "On Hold", "Pool", "Dropped"]);
const PIPELINE_PROGRESS_RANK = new Map([
  ["Identified", 0],
  ["Qualified", 1],
  ["Submitted", 2],
  ["Client Review", 3],
  ["Interview", 4],
  ["Offer", 5],
  ["Onboarded", 6],
  ["Dropped", 7]
]);
const CLOSURE_TYPE_OPTIONS = ["FTE", "Contractual"];
const TRACKING_STATUS_OPTIONS = ["Not Screened", "Screened", "Rejected", "Submitted", "Interview", "Offer", "Onboarded", "On Hold", "Pool", "Dropped"];
const JOB_TYPE_OPTIONS = ["FTE", "C2C", "C2H"];
const BILLING_RATE_TYPE_OPTIONS = ["Monthly", "Hourly"];
const JOB_STATUS_OPTIONS = ["DRAFT", "ACTIVE", "PAUSED", "ON_HOLD", "FILLED", "CLOSED", "CANCELLED", "ARCHIVED"];
const JOB_PRIORITY_OPTIONS = ["CRITICAL", "HIGH", "NORMAL", "LOW"];
const JOB_TIME_ZONE_OPTIONS = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC"
];
const AI_SKILL_CATALOG = [
  "typescript",
  "javascript",
  "node.js",
  "node",
  "react",
  "next.js",
  "nextjs",
  "python",
  "java",
  "spring",
  "django",
  "aws",
  "azure",
  "gcp",
  "docker",
  "kubernetes",
  "terraform",
  "postgresql",
  "mysql",
  "mongodb",
  "redis",
  "graphql",
  "rest",
  "salesforce",
  "mulesoft",
  "data cloud",
  "cpq",
  "apex",
  "lightning",
  "soql",
  "qa",
  "testing",
  "automation",
  "selenium",
  "cypress",
  "playwright",
  "java",
  "spring boot",
  "angular",
  "vue",
  "php",
  "laravel",
  "dotnet",
  ".net",
  "c#",
  "c++",
  "sap",
  "oracle",
  "etl",
  "power bi",
  "tableau",
  "ci/cd",
  "devops",
  "microservices",
  "recruitment",
  "talent acquisition",
  "sourcing",
  "stakeholder management",
  "communication",
  "figma",
  "design systems",
  "user research"
];
const FILENAME_SKILL_HINTS = [
  "Salesforce",
  "Mulesoft",
  "Data Cloud",
  "CPQ",
  "Apex",
  "Lightning",
  "SOQL",
  "Node.js",
  "React",
  "Next.js",
  "JavaScript",
  "TypeScript",
  "Python",
  "Java",
  "Spring Boot",
  "AWS",
  "Azure",
  "GCP",
  "Docker",
  "Kubernetes",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "GraphQL",
  "REST",
  "QA",
  "Testing",
  "Automation",
  "Selenium",
  "Cypress",
  "Playwright",
  "DevOps",
  "Data Engineering",
  "ETL",
  "Power BI",
  "Tableau",
  "SAP",
  "Oracle",
  "Angular",
  "Vue",
  "PHP",
  "Laravel",
  ".NET",
  "C#",
  "C++"
];
const ROLE_HINTS = [
  "software engineer",
  "backend engineer",
  "frontend engineer",
  "full stack engineer",
  "devops engineer",
  "data engineer",
  "qa engineer",
  "sre",
  "product manager",
  "project manager",
  "business analyst",
  "technical recruiter",
  "recruiter",
  "talent acquisition specialist",
  "sourcer",
  "designer",
  "ux designer",
  "ui designer",
  "data scientist",
  "machine learning engineer"
];
const LOCAL_QUERY_STOP_WORDS = new Set([
  "find",
  "search",
  "show",
  "list",
  "get",
  "candidate",
  "candidates",
  "profile",
  "profiles",
  "talent",
  "with",
  "from",
  "for",
  "and",
  "the",
  "that",
  "who",
  "having",
  "experience",
  "years",
  "year"
]);
const INDIA_CITY_OPTIONS = [
  "Bengaluru",
  "Hyderabad",
  "Pune",
  "Mumbai",
  "Delhi NCR",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
  "Gurugram",
  "Noida"
];

const STAGE_BADGE = {
  Identified: "blue",
  Qualified: "purple",
  Submitted: "yellow",
  "Client Review": "yellow",
  Interview: "blue",
  Offer: "purple",
  Onboarded: "green",
  "On Hold": "yellow",
  Pool: "blue",
  Dropped: "red"
};

const USER_ROLE_OPTIONS = ["CEO", "Managing Director", "Admin", "TA Manager", "Recruiter", "Viewer"];
const FOUNDER_ROLES = new Set(["CEO", "Managing Director", "Admin"]);
const RECRUITING_ROLES = new Set(["TA Manager", "Recruiter"]);
const READ_ONLY_ROLES = new Set(["Viewer"]);
const USER_CREATOR_ROLES = FOUNDER_ROLES;

const SECTION_CONFIG = {
  dashboard: { title: "Dashboard", entity: null },
  candidates: { title: "Candidates", entity: "candidates" },
  "candidate-pool": { title: "Candidate Pool", entity: null },
  clients: { title: "Clients", entity: "clients" },
  jobs: { title: "Jobs", entity: "jobs" },
  "ai-match": { title: "MY LLM", entity: null },
  pipeline: { title: "Pipeline", entity: null },
  interviews: { title: "Interviews", entity: "interviews" },
  "bulk-upload": { title: "Bulk Upload", entity: null },
  users: { title: "Users", entity: "users" },
  "team-dashboard": { title: "Team Dashboard", entity: null },
  diagnostics: { title: "Diagnostics", entity: null },
  revenue: { title: "Revenue", entity: null },
  "recruiter-performance": { title: "Recruiter Performance", entity: null },
  leaderboard: { title: "Leaderboard", entity: null },
  "activity-log": { title: "Activity Log", entity: null }
};

const FORM_SCHEMAS = {
  candidates: [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "phone", label: "Phone", type: "text", required: true },
    { name: "currentRole", label: "Current Role", type: "text", required: true },
    { name: "experienceYears", label: "Total Experience (Years)", type: "number", required: true },
    { name: "location", label: "Location", type: "text", required: true },
    { name: "currentCompany", label: "Current Company", type: "text", required: false },
    { name: "skills", label: "Skills (comma separated)", type: "text", required: true },
    { name: "source", label: "Source", type: "text", required: true },
    { name: "recruiter", label: "Recruiter", type: "text", required: true },
    { name: "stage", label: "Stage", type: "select", options: PIPELINE_STAGES, required: true },
    { name: "jobId", label: "Target Job ID", type: "text", required: false }
  ],
  clients: [
    { name: "name", label: "Client Name", type: "text", required: true },
    { name: "industry", label: "Industry", type: "text", required: true },
    { name: "owner", label: "Owner", type: "text", required: true }
  ],
  jobs: [
    { name: "title", label: "Job Title", type: "text", required: true },
    { name: "clientId", label: "Client ID", type: "text", required: true },
    { name: "location", label: "Location", type: "text", required: true },
    { name: "status", label: "Status", type: "select", options: ["Open", "Paused", "Closed"], required: true },
    { name: "openings", label: "Openings", type: "number", required: true },
    { name: "requiredSkills", label: "Required Skills (comma separated)", type: "text", required: true }
  ],
  interviews: [
    { name: "candidateId", label: "Candidate ID", type: "text", required: true },
    { name: "jobId", label: "Job ID", type: "text", required: true },
    { name: "round", label: "Round", type: "select", options: ["L1", "L2", "L3", "Client"], required: true },
    { name: "scheduledAt", label: "Scheduled At", type: "date", required: true },
    { name: "status", label: "Status", type: "select", options: ["Scheduled", "Completed", "Cancelled"], required: true }
  ],
  users: [
    { name: "name", label: "Full Name", type: "text", required: true },
    {
      name: "email",
      label: "Agodly Email",
      type: "email",
      required: true,
      placeholder: "name@agodly.com",
      pattern: "^[^\\s@]+@agodly\\.com$",
      title: "Use an @agodly.com company email address"
    },
    {
      name: "password",
      label: "Password",
      type: "password",
      required: true,
      minLength: 8,
      autocomplete: "new-password",
      placeholder: "Minimum 8 characters"
    },
    { name: "phone", label: "Phone", type: "text", required: true },
    {
      name: "role",
      label: "Role",
      type: "select",
      options: USER_ROLE_OPTIONS,
      required: true
    },
    { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"], required: true },
    { name: "team", label: "Team", type: "text", required: false },
    { name: "manager", label: "Manager", type: "text", required: false },
    { name: "monthlyTarget", label: "Monthly Candidate Target", type: "number", required: false },
    { name: "revenueTarget", label: "Monthly Revenue Target (INR)", type: "number", required: false }
  ]
};

const ui = {
  activeSection: "dashboard",
  search: "",
  period: "all",
  pipelineFilter: "all",
  pipelineRecruiterFilter: "all",
  pipelineJobFilter: "all",
  aiMatch: {
    prompt: "",
    jdText: "",
    keywordText: "",
    isLoading: false,
    lastResponse: null,
    lastInteractionId: "",
    conversationId: "",
    chatHistory: [],
    currentMatches: []
  },
  candidates: {
    view: "active",
    selectedId: "",
    editDraft: null,
    reparseInProgress: false,
    resumeUploadInProgress: false,
    isLoading: false,
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
    sortBy: "createdAt",
    sortDir: "desc",
    pageRows: [],
    activeCount: 0,
    deletedCount: 0,
    lastQueryKey: "",
    inFlightQueryKey: "",
    inlineEdit: false,
    selectedIds: [],
    qualityFilter: "all",
    workQueue: "all",
    bulkField: "stage",
    bulkValue: "",
    savedViews: [],
    noteDraft: "",
    undoStack: []
  },
  candidatePool: {
    skill: "all",
    role: "all",
    source: "all",
    location: "all",
    expMin: "",
    expMax: ""
  },
  jobs: {
    mode: "list",
    search: "",
    statusFilter: "active",
    clientFilter: "all",
    draft: createJobDraft(),
    insights: null,
    insightsLoading: false,
    insightsError: "",
    auditJobId: "",
    auditEntries: [],
    auditLoading: false,
    isSaving: false
  },
  bulkUpload: {
    isProcessing: false,
    isPreviewing: false,
    pendingImportFiles: [],
    preview: null
  },
  users: {
    selectedId: "",
    editDraft: null,
    resetPassword: ""
  },
  notifications: {
    open: false,
    submittingReviewId: "",
    drafts: {}
  },
  bootstrapLoaded: false,
  bootstrapError: "",
  backendSyncInFlight: false,
  backendSyncTimerId: 0,
  sharedStateRefreshTimerId: 0,
  isHydratingFromBackend: false,
  duplicateSyncInFlight: false,
  lastDuplicateSyncAt: 0,
  diagnostics: {
    isLoading: false,
    error: "",
    data: null,
    lastLoadedAt: ""
  },
  api: {
    base: localStorage.getItem(API_BASE_KEY) || DEFAULT_API_BASE,
    connected: false,
    message: "Checking backend..."
  }
};

const el = {};

function refreshElementRefs() {
  Object.assign(el, {
    layout: document.getElementById("layout"),
    sidebar: document.getElementById("sidebar"),
    sidebarToggle: document.getElementById("sidebarToggle"),
    mobileMenuBtn: document.getElementById("mobileMenuBtn"),
    navButtons: Array.from(document.querySelectorAll(".nav-btn")),

    pageTitle: document.getElementById("pageTitle"),
    searchInput: document.getElementById("searchInput"),
    periodFilter: document.getElementById("periodFilter"),
    newRecordBtn: document.getElementById("newRecordBtn"),
    notificationCenter: document.getElementById("notificationCenter"),

    apiDot: document.getElementById("apiDot"),
    apiStatus: document.getElementById("apiStatus"),
    apiBaseText: document.getElementById("apiBaseText"),
    usageCandidates: document.getElementById("usageCandidates"),

    sectionContainer: document.getElementById("sectionContainer"),
    authRoot: document.getElementById("authRoot"),
    modalRoot: document.getElementById("modalRoot"),

    recordDialog: document.getElementById("recordDialog"),
    recordForm: document.getElementById("recordForm"),
    recordDialogTitle: document.getElementById("recordDialogTitle"),
    recordFields: document.getElementById("recordFields"),
    dialogCancelBtn: document.getElementById("dialogCancelBtn"),

    candidateProfileDialog: document.getElementById("candidateProfileDialog"),
    candidateProfileTitle: document.getElementById("candidateProfileTitle"),
    candidateProfileContent: document.getElementById("candidateProfileContent"),
    candidateProfileCloseBtn: document.getElementById("candidateProfileCloseBtn"),
    currentUserName: document.getElementById("currentUserName"),
    currentUserEmail: document.getElementById("currentUserEmail"),
    changePasswordBtn: document.getElementById("changePasswordBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    loginScreen: document.getElementById("loginScreen"),
    loginForm: document.getElementById("loginForm"),
    loginEmail: document.getElementById("loginEmail"),
    loginPassword: document.getElementById("loginPassword"),
    loginError: document.getElementById("loginError"),
    loginSubmitBtn: document.getElementById("loginSubmitBtn")
  });
}

refreshElementRefs();

function ensureLoginScreenMounted() {
  if (document.getElementById("loginScreen")) {
    refreshElementRefs();
    return;
  }

  const target = document.getElementById("authRoot") || document.body;
  target.insertAdjacentHTML(
    "beforeend",
    `
      <section class="login-screen" id="loginScreen" aria-label="Login">
        <div class="login-card card shadow-lg">
          <div class="brand-mark login-brand">A</div>
          <p class="login-eyebrow">Recruitment Copilot</p>
          <h2>Sign in to Agodly ATS</h2>
          <p class="login-copy">Use your company credentials to access candidates, jobs, AI matching, and team dashboards.</p>
          <form id="loginForm" class="login-form needs-validation">
            <label>
              <span>Email</span>
              <input id="loginEmail" type="email" autocomplete="email" placeholder="you@agodly.com" required />
            </label>
            <label>
              <span>Password</span>
              <input id="loginPassword" type="password" autocomplete="current-password" placeholder="Password" required />
            </label>
            <p class="login-error" id="loginError"></p>
            <button class="tool-btn primary btn" id="loginSubmitBtn" type="submit">Sign In</button>
          </form>
        </div>
      </section>
    `
  );
  refreshElementRefs();
  el.loginForm?.addEventListener("submit", onLoginSubmit);
}

function unmountLoginScreen() {
  document.getElementById("loginScreen")?.remove();
  refreshElementRefs();
}

function ensureRecordDialogMounted() {
  if (!document.getElementById("recordDialog")) {
    const target = document.getElementById("modalRoot") || document.body;
    target.insertAdjacentHTML(
      "beforeend",
      `
        <dialog id="recordDialog">
          <form id="recordForm">
            <h3 id="recordDialogTitle">New Record</h3>
            <div id="recordFields" class="dialog-fields"></div>
            <div class="dialog-actions">
              <button class="tool-btn" type="button" id="dialogCancelBtn">Cancel</button>
              <button class="tool-btn primary" type="submit">Save</button>
            </div>
          </form>
        </dialog>
      `
    );
  }

  refreshElementRefs();
  el.dialogCancelBtn?.addEventListener("click", closeRecordDialog, { once: true });
  el.recordForm?.addEventListener("submit", onSubmitRecord, { once: false });
}

function closeRecordDialog() {
  if (el.recordDialog?.open) el.recordDialog.close();
  document.getElementById("recordDialog")?.remove();
  refreshElementRefs();
}

function ensureCandidateProfileDialogMounted() {
  if (!document.getElementById("candidateProfileDialog")) {
    const target = document.getElementById("modalRoot") || document.body;
    target.insertAdjacentHTML(
      "beforeend",
      `
        <dialog id="candidateProfileDialog">
          <article class="profile-dialog-inner">
            <header class="profile-dialog-head">
              <h3 id="candidateProfileTitle">Candidate Profile</h3>
              <button class="tool-btn" type="button" id="candidateProfileCloseBtn">Close</button>
            </header>
            <div id="candidateProfileContent"></div>
          </article>
        </dialog>
      `
    );
  }

  refreshElementRefs();
  el.candidateProfileCloseBtn?.addEventListener("click", closeCandidateProfileDialog, { once: true });
}

function closeCandidateProfileDialog() {
  if (el.candidateProfileDialog?.open) el.candidateProfileDialog.close();
  document.getElementById("candidateProfileDialog")?.remove();
  refreshElementRefs();
}

let state = emptyState();
let auth = loadAuthState();

initialize();

function initialize() {
  ui.candidates.savedViews = loadCandidateViews();
  applySharedCandidateViewFromUrl();
  bindEvents();
  render();
  checkBackendHealth();
  startSharedStateRefresh();
}

function bindEvents() {
  window.addEventListener("focus", () => {
    void refreshSharedStateFromBackendIfIdle();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refreshSharedStateFromBackendIfIdle();
  });

  el.sidebarToggle?.addEventListener("click", () => {
    el.layout?.classList.toggle("sidebar-collapsed");
  });

  el.mobileMenuBtn?.addEventListener("click", () => {
    el.layout?.classList.toggle("sidebar-open");
  });

  el.navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.section;
      if (!section) return;

      ui.activeSection = section;
      render();
      el.layout?.classList.remove("sidebar-open");
    });
  });

  el.searchInput?.addEventListener("input", (event) => {
    ui.search = event.target.value.trim().toLowerCase();
    if (ui.activeSection === "candidates") {
      ui.candidates.page = 1;
      ui.candidates.selectedId = "";
      ui.candidates.editDraft = null;
      ui.candidates.inFlightQueryKey = "";
      ui.candidates.lastQueryKey = "";
    }
    renderSection();
  });

  el.periodFilter?.addEventListener("change", (event) => {
    ui.period = event.target.value;
    if (ui.activeSection === "candidates") {
      ui.candidates.page = 1;
      ui.candidates.inFlightQueryKey = "";
      ui.candidates.lastQueryKey = "";
    }
    renderSection();
  });

  el.newRecordBtn?.addEventListener("click", openCreateDialog);
  el.notificationCenter?.addEventListener("click", onNotificationClick);
  el.notificationCenter?.addEventListener("input", onNotificationInput);
  el.notificationCenter?.addEventListener("change", onNotificationInput);
  el.logoutBtn?.addEventListener("click", logoutCurrentUser);
  el.changePasswordBtn?.addEventListener("click", () => {
    openCurrentUserPasswordPanel();
  });
  el.sectionContainer?.addEventListener("click", onSectionClick);
  el.sectionContainer?.addEventListener("change", onSectionChange);
  el.sectionContainer?.addEventListener("input", onSectionInput);
  el.sectionContainer?.addEventListener("keydown", onSectionKeydown);
  el.sectionContainer?.addEventListener("wheel", onSectionWheel, { passive: false });
  el.sectionContainer?.addEventListener("pointerdown", onSectionPointerDown);
  el.sectionContainer?.addEventListener("pointermove", onSectionPointerMove);
  el.sectionContainer?.addEventListener("pointerup", endPipelinePointerScroll);
  el.sectionContainer?.addEventListener("pointercancel", endPipelinePointerScroll);
  el.sectionContainer?.addEventListener("dragover", onSectionDragOver);
  el.sectionContainer?.addEventListener("dragleave", onSectionDragLeave);
  el.sectionContainer?.addEventListener("drop", onSectionDrop);
}

function onSectionClick(event) {
  const actionNode = event.target.closest("[data-action]");
  if (!actionNode) return;

  const action = actionNode.dataset.action;

  if (action === "go-section") {
    goToSection(actionNode.dataset.section || "dashboard");
    return;
  }

  if (action === "retry-bootstrap") {
    ui.bootstrapError = "";
    void checkBackendHealth();
    renderSection();
    return;
  }

  if (action === "reload-diagnostics") {
    ui.diagnostics.data = null;
    ui.diagnostics.error = "";
    void loadDiagnostics();
    renderSection();
    return;
  }

  if (action === "open-pipeline-stage") {
    if (!getAllowedSectionsForCurrentUser().has("pipeline")) {
      alert("Your role does not have access to this section.");
      return;
    }
    ui.activeSection = "pipeline";
    ui.pipelineFilter = actionNode.dataset.stage || "all";
    render();
    return;
  }

  if (action === "open-candidate-work-queue") {
    ui.activeSection = "candidates";
    ui.candidates.view = "active";
    ui.candidates.workQueue = actionNode.dataset.queue || "all";
    ui.candidates.qualityFilter = "all";
    ui.candidates.page = 1;
    render();
    return;
  }

  if (action === "open-daily-candidate") {
    const candidate = findCandidateByIdAnywhere(actionNode.dataset.candidateId);
    if (!candidate) return;
    ui.activeSection = "candidates";
    ui.candidates.view = "active";
    ui.candidates.workQueue = "all";
    ui.candidates.selectedId = candidate.id;
    ui.candidates.editDraft = candidateDraftFromRecord(candidate);
    render();
    focusCandidateSidePanel();
    return;
  }

  if (action === "clear-pipeline-filter") {
    ui.pipelineFilter = "all";
    ui.pipelineRecruiterFilter = "all";
    ui.pipelineJobFilter = "all";
    renderSection();
    return;
  }

  if (action === "pipeline-scroll") {
    scrollPipelineBoard(actionNode.dataset.direction || "right");
    return;
  }

  if (action === "toggle-user-status") {
    void toggleUserAccessStatus(actionNode.dataset.userId || "");
    return;
  }

  if (action === "delete-user") {
    void archiveUserAccount(actionNode.dataset.userId || "");
    return;
  }

  if (action === "open-user-editor") {
    openUserEditor(actionNode.dataset.userId || "");
    return;
  }

  if (action === "close-user-editor") {
    closeUserEditor();
    return;
  }

  if (action === "save-user-profile") {
    void saveUserProfileEdits();
    return;
  }

  if (action === "reset-user-password") {
    void resetManagedUserPassword();
    return;
  }

  if (action === "save-ta-targets") {
    saveTaTargetRow(actionNode.dataset.userId || "");
    return;
  }

  if (action === "save-placement-finance") {
    savePlacementFinanceRow(actionNode.dataset.candidateId || "");
    return;
  }

  if (action === "open-bulk-picker") {
    openBulkPicker("all");
    return;
  }

  if (action === "open-bulk-cv-picker") {
    openBulkPicker("cv");
    return;
  }

  if (action === "open-bulk-csv-picker") {
    openBulkPicker("csv");
    return;
  }

  if (action === "open-bulk-spreadsheet-picker") {
    document.getElementById("bulkUploadSpreadsheetInput")?.click();
    return;
  }

  if (action === "confirm-bulk-import") {
    const files = [...(ui.bulkUpload.pendingImportFiles || [])];
    ui.bulkUpload.preview = null;
    ui.bulkUpload.pendingImportFiles = [];
    void handleBulkUploadFiles(files);
    return;
  }

  if (action === "cancel-bulk-import") {
    ui.bulkUpload.preview = null;
    ui.bulkUpload.pendingImportFiles = [];
    renderSection();
    return;
  }

  if (action === "download-bulk-template") {
    downloadBulkTemplate();
    return;
  }

  if (action === "merge-duplicate") {
    const primaryId = actionNode.dataset.primaryId;
    const duplicateId = actionNode.dataset.duplicateId;
    if (!primaryId || !duplicateId) return;
    void mergeDuplicateCandidate(primaryId, duplicateId);
    return;
  }

  if (action === "ignore-duplicate") {
    const duplicateId = actionNode.dataset.duplicateId;
    if (!duplicateId) return;
    void ignoreDuplicateCandidate(duplicateId);
    return;
  }

  if (action === "run-my-llm") {
    void submitMyLlmPrompt();
    return;
  }

  if (action === "run-ai-match-mini") {
    void submitAiMatchMiniForm();
    return;
  }

  if (action === "myllm-feedback") {
    const helpfulValue = String(actionNode.dataset.helpful || "").toLowerCase();
    const helpful = helpfulValue === "true";
    void submitMyLlmFeedback(helpful);
    return;
  }

  if (action === "open-candidate-profile") {
    const candidateId = actionNode.dataset.candidateId;
    if (!candidateId) return;
    openCandidateProfileDialog(candidateId);
    return;
  }

  if (action === "candidate-select") {
    const candidateId = String(actionNode.dataset.candidateId || "");
    const selected = new Set(ui.candidates.selectedIds || []);
    actionNode.checked ? selected.add(candidateId) : selected.delete(candidateId);
    ui.candidates.selectedIds = [...selected];
    renderSection();
    return;
  }

  if (action === "candidate-select-page") {
    const view = ui.candidates.view === "deleted" ? "deleted" : "active";
    const page = getCandidateWorkspacePage(view);
    const selected = new Set(ui.candidates.selectedIds || []);
    page.rows.forEach((candidate) => actionNode.checked ? selected.add(candidate.id) : selected.delete(candidate.id));
    ui.candidates.selectedIds = [...selected];
    renderSection();
    return;
  }

  if (action === "candidate-quality-filter") {
    ui.candidates.qualityFilter = String(actionNode.dataset.filter || "all");
    ui.candidates.page = 1;
    ui.candidates.selectedId = "";
    ui.candidates.editDraft = null;
    renderSection();
    return;
  }

  if (action === "toggle-candidate-grid-edit") {
    ui.candidates.inlineEdit = !ui.candidates.inlineEdit;
    renderSection();
    return;
  }

  if (action === "undo-candidate-grid-edit") {
    void undoLastCandidateGridEdit();
    return;
  }

  if (action === "clear-candidate-selection") {
    ui.candidates.selectedIds = [];
    renderSection();
    return;
  }

  if (action === "apply-candidate-bulk") {
    void applyCandidateBulkUpdate();
    return;
  }

  if (action === "export-selected-candidates") {
    exportSelectedCandidatesCsv();
    return;
  }

  if (action === "save-candidate-view") {
    const name = window.prompt("Name this candidate view:", "My working view");
    if (!name?.trim()) return;
    const savedView = currentCandidateViewSnapshot(name);
    ui.candidates.savedViews = [savedView, ...ui.candidates.savedViews].slice(0, 20);
    localStorage.setItem(CANDIDATE_VIEWS_KEY, JSON.stringify(ui.candidates.savedViews));
    renderSection();
    return;
  }

  if (action === "share-candidate-view") {
    const sharedView = currentCandidateViewSnapshot("Shared candidate view");
    const url = new URL(window.location.href);
    url.hash = `candidate-view=${encodeCandidateView(sharedView)}`;
    void copyTextToClipboard(url.toString(), "Shareable candidate view link copied.");
    return;
  }

  if (action === "add-candidate-note") {
    void addCandidateCollaborationNote();
    return;
  }

  if (action === "email-candidate") {
    openCandidateEmailTemplate();
    return;
  }

  if (action === "download-followup-calendar") {
    downloadCandidateFollowUpCalendar();
    return;
  }

  if (action === "open-candidate-sidepanel") {
    const candidateId = actionNode.dataset.candidateId;
    const candidate = findCandidateByIdAnywhere(candidateId);
    if (!candidate) return;
    ui.candidates.selectedId = candidate.id;
    ui.candidates.editDraft = candidateDraftFromRecord(candidate);
    renderSection();
    focusCandidateSidePanel();
    return;
  }

  if (action === "open-candidate-from-pool") {
    const candidateId = actionNode.dataset.candidateId;
    const candidate = findCandidateByIdAnywhere(candidateId);
    if (!candidate) return;
    ui.activeSection = "candidates";
    ui.candidates.view = isCandidateDeleted(candidate) ? "deleted" : "active";
    ui.candidates.selectedId = candidate.id;
    ui.candidates.editDraft = candidateDraftFromRecord(candidate);
    ui.candidates.page = 1;
    ui.candidates.inFlightQueryKey = "";
    ui.candidates.lastQueryKey = "";
    render();
    focusCandidateSidePanel();
    return;
  }

  if (action === "edit-candidate") {
    const candidateId = actionNode.dataset.candidateId;
    const candidate = findCandidateByIdAnywhere(candidateId);
    if (!candidate) return;
    ui.candidates.selectedId = candidate.id;
    ui.candidates.editDraft = candidateDraftFromRecord(candidate);
    renderSection();
    focusCandidateSidePanel();
    return;
  }

  if (action === "delete-candidate") {
    const candidateId = actionNode.dataset.candidateId;
    if (!candidateId) return;
    void deleteCandidateRecord(candidateId);
    return;
  }

  if (action === "restore-candidate") {
    const candidateId = actionNode.dataset.candidateId;
    if (!candidateId) return;
    void restoreCandidateRecord(candidateId);
    return;
  }

  if (action === "candidates-view") {
    const nextView = String(actionNode.dataset.view || "active").toLowerCase();
    ui.candidates.view = nextView === "deleted" ? "deleted" : "active";
    ui.candidates.selectedId = "";
    ui.candidates.editDraft = null;
    ui.candidates.page = 1;
    ui.candidates.inFlightQueryKey = "";
    ui.candidates.lastQueryKey = "";
    renderSection();
    return;
  }

  if (action === "candidates-page-prev") {
    if (ui.candidates.page <= 1) return;
    ui.candidates.page -= 1;
    ui.candidates.selectedId = "";
    ui.candidates.editDraft = null;
    ui.candidates.inFlightQueryKey = "";
    ui.candidates.lastQueryKey = "";
    renderSection();
    return;
  }

  if (action === "candidates-page-next") {
    if (ui.candidates.page >= getCandidateMaxPageForCurrentView()) return;
    ui.candidates.page += 1;
    ui.candidates.selectedId = "";
    ui.candidates.editDraft = null;
    ui.candidates.inFlightQueryKey = "";
    ui.candidates.lastQueryKey = "";
    renderSection();
    return;
  }

  if (action === "close-candidate-sidepanel") {
    closeCandidateSidePanel();
    return;
  }

  if (action === "reset-candidate-profile") {
    const candidate = findCandidateByIdAnywhere(ui.candidates.selectedId);
    if (!candidate) return;
    ui.candidates.editDraft = candidateDraftFromRecord(candidate);
    renderSection();
    return;
  }

  if (action === "save-candidate-profile") {
    void saveCandidateProfileDraft();
    return;
  }

  if (action === "download-candidate-json") {
    exportSelectedCandidateProfile();
    return;
  }

  if (action === "preview-candidate-profile") {
    openSelectedCandidateProfilePreview();
    return;
  }

  if (action === "apply-resume-extraction") {
    applySelectedResumeExtractionToDraft();
    return;
  }

  if (action === "preview-candidate-resume") {
    void previewSelectedCandidateResume();
    return;
  }

  if (action === "copy-linkedin-url") {
    copySelectedCandidateLinkedIn();
    return;
  }

  if (action === "copy-resume-link") {
    copySelectedCandidateResumeLink();
    return;
  }

  if (action === "download-candidate-resume") {
    void downloadSelectedCandidateResume();
    return;
  }

  if (action === "reparse-candidate-ai") {
    void reparseCandidateProfileWithAI();
    return;
  }

  if (action === "reset-candidate-pool-filters") {
    ui.candidatePool.skill = "all";
    ui.candidatePool.role = "all";
    ui.candidatePool.source = "all";
    ui.candidatePool.location = "all";
    ui.candidatePool.expMin = "";
    ui.candidatePool.expMax = "";
    renderSection();
    return;
  }

  if (action === "create-job") {
    ui.jobs.mode = "create";
    ui.jobs.draft = createJobDraft();
    renderSection();
    return;
  }

  if (action === "back-to-jobs" || action === "cancel-job-edit") {
    ui.jobs.mode = "list";
    ui.jobs.draft = createJobDraft();
    renderSection();
    return;
  }

  if (action === "autofill-job-from-jd") {
    ui.jobs.draft = autofillJobFromJd(ui.jobs.draft);
    renderSection();
    return;
  }

  if (action === "create-client-inline") {
    const role = normalizeUserRole(getCurrentUser()?.role);
    if (!canCurrentUserAccessFounderWorkspace() && role !== "TA Manager") {
      alert("Only founders and TA Managers can create clients.");
      return;
    }
    const name = prompt("Client name");
    if (!name || !name.trim()) return;
    const cleanName = name.trim();
    const created = {
      id: uid("cli"),
      name: cleanName,
      industry: "General",
      owner: "Admin User",
      createdAt: todayISO()
    };
    state.clients.push(created);
    ui.jobs.draft.clientId = created.id;
    recordActivity("client", `Client created: ${cleanName}`);
    saveAndRender();
    return;
  }

  if (action === "save-job-draft") {
    void submitJobDraft("DRAFT");
    return;
  }

  if (action === "create-job-publish") {
    void submitJobDraft("ACTIVE");
    return;
  }

  if (action === "edit-job") {
    const jobId = actionNode.dataset.jobId;
    const job = findById(state.jobs, jobId);
    if (!job) return;
    ui.jobs.draft = createJobDraft(job);
    ui.jobs.mode = "create";
    renderSection();
    return;
  }

  if (action === "duplicate-job") {
    void duplicateJobViaApi(actionNode.dataset.jobId || "");
    return;
  }

  if (action === "archive-job") {
    void archiveJobViaApi(actionNode.dataset.jobId || "");
    return;
  }

  if (action === "delete-job-permanently") {
    void permanentlyDeleteJobViaApi(actionNode.dataset.jobId || "");
    return;
  }

  if (action === "build-job-candidate-pool") {
    void createCandidatePoolFromJob(actionNode.dataset.jobId || "");
    return;
  }

  if (action === "build-insight-candidate-pool") {
    void createCandidatePoolFromInsight(actionNode.dataset.insightKey || "");
    return;
  }

  if (action === "refresh-job-insights") {
    invalidateJobInsights();
    void loadJobInsights();
    return;
  }

  if (action === "view-job-audit") {
    void loadJobAudit(actionNode.dataset.jobId || "");
    return;
  }

  if (action === "close-job-audit") {
    ui.jobs.auditJobId = "";
    ui.jobs.auditEntries = [];
    renderSection();
    return;
  }

  if (action === "add-job-location") {
    addJobLocationFromInput();
    return;
  }

  if (action === "remove-job-location") {
    const location = actionNode.dataset.location || "";
    ui.jobs.draft.locations = (ui.jobs.draft.locations || []).filter((item) => String(item).toLowerCase() !== location.toLowerCase());
    renderSection();
    return;
  }

  if (action === "add-job-timezone") {
    addJobTimeZoneFromInput();
    return;
  }

  if (action === "remove-job-timezone") {
    const timeZone = actionNode.dataset.timeZone || "";
    ui.jobs.draft.supportedTimeZones = (ui.jobs.draft.supportedTimeZones || []).filter((item) => String(item) !== timeZone);
    renderSection();
    return;
  }

  if (action === "add-job-skill") {
    const skillType = actionNode.dataset.skillType;
    if (!skillType) return;
    addJobSkillFromInput(skillType);
    return;
  }

  if (action === "remove-job-skill") {
    const skillType = actionNode.dataset.skillType;
    const skill = actionNode.dataset.skill;
    if (!skillType || !skill) return;
    removeJobSkill(skillType, skill);
    renderSection();
  }
}

function onSectionChange(event) {
  if (event.target.matches("#bulkUploadSpreadsheetInput")) {
    void previewBulkImport(event.target.files);
    event.target.value = "";
    return;
  }

  if (
    event.target.matches("#bulkUploadInput") ||
    event.target.matches("#bulkUploadCvInput") ||
    event.target.matches("#bulkUploadCsvInput")
  ) {
    handleBulkUploadFiles(event.target.files);
    event.target.value = "";
    return;
  }

  if (event.target.matches("[data-action='pipeline-filter']")) {
    ui.pipelineFilter = event.target.value;
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='pipeline-recruiter-filter']")) {
    ui.pipelineRecruiterFilter = event.target.value || "all";
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='pipeline-job-filter']")) {
    ui.pipelineJobFilter = event.target.value || "all";
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='candidate-pool-skill']")) {
    ui.candidatePool.skill = event.target.value || "all";
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='candidate-pool-role']")) {
    ui.candidatePool.role = event.target.value || "all";
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='candidate-pool-source']")) {
    ui.candidatePool.source = event.target.value || "all";
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='candidate-pool-location']")) {
    ui.candidatePool.location = event.target.value || "all";
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='candidates-sort-by']")) {
    ui.candidates.sortBy = normalizeCandidateSortBy(event.target.value);
    ui.candidates.page = 1;
    ui.candidates.selectedId = "";
    ui.candidates.editDraft = null;
    ui.candidates.inFlightQueryKey = "";
    ui.candidates.lastQueryKey = "";
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='candidates-sort-dir']")) {
    ui.candidates.sortDir = normalizeCandidateSortDir(event.target.value);
    ui.candidates.page = 1;
    ui.candidates.selectedId = "";
    ui.candidates.editDraft = null;
    ui.candidates.inFlightQueryKey = "";
    ui.candidates.lastQueryKey = "";
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='candidates-page-size']")) {
    ui.candidates.limit = normalizeCandidatePageSize(event.target.value);
    ui.candidates.page = 1;
    ui.candidates.selectedId = "";
    ui.candidates.editDraft = null;
    ui.candidates.inFlightQueryKey = "";
    ui.candidates.lastQueryKey = "";
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='candidates-work-queue']")) {
    ui.candidates.workQueue = event.target.value || "all";
    ui.candidates.page = 1;
    ui.candidates.selectedId = "";
    ui.candidates.editDraft = null;
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='candidate-saved-view']")) {
    const savedView = ui.candidates.savedViews.find((item) => item.id === event.target.value);
    if (savedView) applyCandidateView(savedView);
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='candidate-bulk-field']")) {
    ui.candidates.bulkField = event.target.value || "jobId";
    ui.candidates.bulkValue = "";
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='candidate-bulk-value']")) {
    ui.candidates.bulkValue = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='candidate-quick-field']")) {
    const candidateId = event.target.dataset.candidateId;
    const field = event.target.dataset.field;
    if (candidateId && field) void quickUpdateCandidate(candidateId, field, event.target.value);
    return;
  }

  if (event.target.matches("[data-action='move-stage']")) {
    const candidateId = event.target.dataset.candidateId;
    const nextStage = event.target.value;
    const candidate = findCandidateByIdAnywhere(candidateId);
    if (candidate) event.target.value = candidate.stage;
    openStageMovementDialog(candidateId, nextStage);
    return;
  }

  if (event.target.matches("[data-action='candidate-profile-field']")) {
    if (!ui.candidates.editDraft) return;
    const field = event.target.dataset.field;
    if (!field) return;
    ui.candidates.editDraft[field] = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='candidate-resume-file']")) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void uploadSelectedCandidateResume(file);
    return;
  }

  if (event.target.matches("[data-action='user-profile-field']")) {
    if (!ui.users.editDraft) return;
    const field = event.target.dataset.field;
    if (!field) return;
    ui.users.editDraft[field] = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='user-reset-password']")) {
    ui.users.resetPassword = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='jobs-status-filter']")) {
    ui.jobs.statusFilter = event.target.value;
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='jobs-client-filter']")) {
    ui.jobs.clientFilter = event.target.value;
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='job-status-change']")) {
    const jobId = event.target.dataset.jobId || "";
    const status = event.target.value;
    void changeJobStatusViaApi(jobId, status);
    return;
  }

  if (event.target.matches("[data-action='job-client']")) {
    ui.jobs.draft.clientId = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-primary-timezone']")) {
    ui.jobs.draft.primaryTimeZone = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-supported-timezone-entry']")) {
    ui.jobs.draft.timeZoneEntry = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-remote-scope']")) {
    ui.jobs.draft.remoteScope = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-priority']")) {
    ui.jobs.draft.priority = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-work-mode']")) {
    ui.jobs.draft.workMode = event.target.value;
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='job-type']")) {
    ui.jobs.draft.jobType = normalizeJobType(event.target.value);
    ui.jobs.draft.billingRateType = normalizeBillingRateType(ui.jobs.draft.billingRateType);
    return;
  }

  if (event.target.matches("[data-action='job-billing-rate-type']")) {
    ui.jobs.draft.billingRateType = normalizeBillingRateType(event.target.value);
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='job-currency']")) {
    ui.jobs.draft.currency = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-ctc-not-disclosed']")) {
    ui.jobs.draft.ctcNotDisclosed = event.target.checked;
    if (event.target.checked) {
      ui.jobs.draft.ctcMin = "";
      ui.jobs.draft.ctcMax = "";
    }
    renderSection();
  }
}

function onSectionInput(event) {
  if (event.target.matches("[data-action='candidate-note-draft']")) {
    ui.candidates.noteDraft = event.target.value;
    return;
  }

  if (event.target.matches("#aiMatchJdInput")) {
    ui.aiMatch.jdText = event.target.value;
    return;
  }

  if (event.target.matches("#aiMatchKeywordsInput")) {
    ui.aiMatch.keywordText = event.target.value;
    return;
  }

  if (event.target.matches("#myLlmPrompt")) {
    ui.aiMatch.prompt = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='candidate-pool-exp-min']")) {
    ui.candidatePool.expMin = event.target.value;
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='candidate-pool-exp-max']")) {
    ui.candidatePool.expMax = event.target.value;
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='jobs-search']")) {
    ui.jobs.search = event.target.value;
    renderSection();
    return;
  }

  if (event.target.matches("[data-action='job-jd-text']")) {
    ui.jobs.draft.jdText = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-title']")) {
    ui.jobs.draft.title = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-location-entry']")) {
    ui.jobs.draft.locationEntry = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-country']")) {
    ui.jobs.draft.country = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-state']")) {
    ui.jobs.draft.state = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-city']")) {
    ui.jobs.draft.city = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-working-hours']")) {
    ui.jobs.draft.workingHours = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-timezone-overlap']")) {
    ui.jobs.draft.minTimeZoneOverlap = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-openings']")) {
    ui.jobs.draft.openings = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-exp-min']")) {
    ui.jobs.draft.expMin = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-exp-max']")) {
    ui.jobs.draft.expMax = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-ctc-min']")) {
    ui.jobs.draft.ctcMin = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-ctc-max']")) {
    ui.jobs.draft.ctcMax = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-rate-min']")) {
    ui.jobs.draft.rateMin = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='job-rate-max']")) {
    ui.jobs.draft.rateMax = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='candidate-profile-field']")) {
    if (!ui.candidates.editDraft) return;
    const field = event.target.dataset.field;
    if (!field) return;
    ui.candidates.editDraft[field] = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='user-profile-field']")) {
    if (!ui.users.editDraft) return;
    const field = event.target.dataset.field;
    if (!field) return;
    ui.users.editDraft[field] = event.target.value;
    return;
  }

  if (event.target.matches("[data-action='user-reset-password']")) {
    ui.users.resetPassword = event.target.value;
    return;
  }
}

function onSectionKeydown(event) {
  if (event.key === "Escape" && ui.activeSection === "candidates" && ui.candidates.selectedId) {
    event.preventDefault();
    closeCandidateSidePanel();
    return;
  }

  if (event.target.matches(".pipeline-board") && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
    event.preventDefault();
    scrollPipelineBoard(event.key === "ArrowLeft" ? "left" : "right");
    return;
  }

  if (event.target.matches("[data-dropzone='bulk-upload']")) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openBulkPicker("all");
    return;
  }

  if (event.target.matches("#aiMatchJdInput") || event.target.matches("#aiMatchKeywordsInput")) {
    if (!(event.key === "Enter" && (event.metaKey || event.ctrlKey))) return;
    event.preventDefault();
    void submitAiMatchMiniForm();
    return;
  }

  if (event.target.matches("#myLlmPrompt")) {
    if (!(event.key === "Enter" && (event.metaKey || event.ctrlKey))) return;
    event.preventDefault();
    void submitMyLlmPrompt();
    return;
  }

  if (event.target.matches("[data-action='open-candidate-sidepanel']")) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    const candidateId = event.target.dataset.candidateId;
    const candidate = findCandidateByIdAnywhere(candidateId);
    if (!candidate) return;
    ui.candidates.selectedId = candidate.id;
    ui.candidates.editDraft = candidateDraftFromRecord(candidate);
    renderSection();
    focusCandidateSidePanel();
    return;
  }

  if (event.target.matches("[data-action='job-location-entry']") && event.key === "Enter") {
    event.preventDefault();
    addJobLocationFromInput();
    return;
  }

  if (!event.target.matches("[data-action='job-skill-input']")) return;
  if (event.key !== "Enter") return;
  event.preventDefault();
  const skillType = event.target.dataset.skillType;
  if (!skillType) return;
  addJobSkillFromInput(skillType);
}

function scrollPipelineBoard(direction) {
  const board = el.sectionContainer?.querySelector(".pipeline-board");
  if (!board) return;
  const step = Math.max(280, Math.round(board.clientWidth * 0.78));
  board.scrollBy({ left: direction === "left" ? -step : step, behavior: "smooth" });
  board.focus({ preventScroll: true });
}

function onSectionWheel(event) {
  const board = event.target.closest(".pipeline-board");
  if (!board || board.scrollWidth <= board.clientWidth) return;

  const horizontalIntent = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
  const overScrollableColumn = Boolean(event.target.closest(".pipeline-col"));
  if (!horizontalIntent && overScrollableColumn) return;

  const delta = horizontalIntent && event.deltaX ? event.deltaX : event.deltaY;
  if (!delta) return;
  event.preventDefault();
  board.scrollLeft += delta;
}

function onSectionPointerDown(event) {
  if (event.button !== 0) return;
  const board = event.target.closest(".pipeline-board");
  if (!board || board.scrollWidth <= board.clientWidth) return;
  if (event.target.closest("button, a, input, select, textarea, .pipeline-item")) return;

  pipelineDragState = {
    board,
    pointerId: event.pointerId,
    startX: event.clientX,
    startScrollLeft: board.scrollLeft
  };
  board.setPointerCapture?.(event.pointerId);
  board.classList.add("is-dragging");
}

function onSectionPointerMove(event) {
  if (!pipelineDragState || pipelineDragState.pointerId !== event.pointerId) return;
  const distance = event.clientX - pipelineDragState.startX;
  if (Math.abs(distance) > 3) event.preventDefault();
  pipelineDragState.board.scrollLeft = pipelineDragState.startScrollLeft - distance;
}

function endPipelinePointerScroll(event) {
  if (!pipelineDragState || pipelineDragState.pointerId !== event.pointerId) return;
  pipelineDragState.board.releasePointerCapture?.(event.pointerId);
  pipelineDragState.board.classList.remove("is-dragging");
  pipelineDragState = null;
}

function onSectionDragOver(event) {
  const dropzone = event.target.closest("[data-dropzone='bulk-upload']");
  if (!dropzone) return;
  event.preventDefault();
  dropzone.classList.add("is-dragover");
}

function onSectionDragLeave(event) {
  const dropzone = event.target.closest("[data-dropzone='bulk-upload']");
  if (!dropzone) return;

  const relatedTarget = event.relatedTarget;
  if (relatedTarget && dropzone.contains(relatedTarget)) return;
  dropzone.classList.remove("is-dragover");
}

function onSectionDrop(event) {
  const dropzone = event.target.closest("[data-dropzone='bulk-upload']");
  if (!dropzone) return;
  event.preventDefault();
  dropzone.classList.remove("is-dragover");
  handleBulkUploadFiles(event.dataTransfer?.files);
}

function render(options = {}) {
  const scrollSnapshot = options.preserveScroll ? captureWorkspaceScrollState() : null;
  enforceActiveSectionAccess();
  renderNav();
  renderToolbar();
  renderSection();
  renderNotificationCenter();
  renderApiStatus();
  renderCurrentUserCard();
  renderLoginState();
  el.usageCandidates.textContent = String(getVisibleCandidateCount());
  if (scrollSnapshot) {
    window.requestAnimationFrame(() => restoreWorkspaceScrollState(scrollSnapshot));
  }
}

function captureWorkspaceScrollState() {
  const selectors = [".table-wrap", ".candidate-side-panel", ".pipeline-board", ".pipeline-col", "[data-scroll-preserve]"];
  const nested = selectors.flatMap((selector) =>
    Array.from(document.querySelectorAll(selector)).map((node, index) => ({
      selector,
      index,
      top: node.scrollTop,
      left: node.scrollLeft
    }))
  );

  return { windowX: window.scrollX, windowY: window.scrollY, nested };
}

function restoreWorkspaceScrollState(snapshot) {
  if (!snapshot) return;
  window.scrollTo({ left: snapshot.windowX, top: snapshot.windowY, behavior: "instant" });
  snapshot.nested.forEach((position) => {
    const node = document.querySelectorAll(position.selector)?.[position.index];
    if (!node) return;
    node.scrollLeft = position.left;
    node.scrollTop = position.top;
  });
}

function renderNotificationCenter() {
  if (!el.notificationCenter) return;
  if (!isAuthenticated()) {
    el.notificationCenter.innerHTML = "";
    return;
  }

  const notifications = getPendingFounderReviewNotifications();
  const canRate = canCurrentUserSubmitFounderReview();
  const isOpen = Boolean(ui.notifications.open);

  el.notificationCenter.classList.toggle("is-open", isOpen);
  el.notificationCenter.innerHTML = `
    <button
      class="notification-bell ${notifications.length ? "has-alerts" : ""}"
      type="button"
      data-notification-action="toggle"
      aria-label="${notifications.length ? `${notifications.length} candidate ratings pending` : "No candidate ratings pending"}"
      aria-expanded="${isOpen ? "true" : "false"}"
    >
      <span aria-hidden="true">🔔</span>
      ${notifications.length ? `<strong>${notifications.length > 99 ? "99+" : notifications.length}</strong>` : ""}
    </button>
    ${
      isOpen
        ? `<section class="notification-panel" role="dialog" aria-label="Founder candidate rating actions">
            <header class="notification-panel-head">
              <div>
                <p class="jobs-eyebrow">Action centre</p>
                <h2>Candidate ratings</h2>
              </div>
              <button class="ghost-icon" type="button" data-notification-action="close" aria-label="Close notifications">×</button>
            </header>
            <p class="notification-summary">${notifications.length} candidate${notifications.length === 1 ? " requires" : "s require"} CEO/MD review.</p>
            <div class="notification-list" data-scroll-preserve>
              ${
                notifications.length
                  ? notifications.map((item) => renderFounderReviewNotification(item, canRate)).join("")
                  : `<div class="notification-empty"><strong>All caught up</strong><span>No submitted candidate is waiting for a founder rating.</span></div>`
              }
            </div>
          </section>`
        : ""
    }
  `;
}

function renderFounderReviewNotification(item, canRate) {
  const draft = ui.notifications.drafts[item.review.id] || { rating: "", notes: "" };
  const job = findById(state.jobs, item.candidate.jobId);
  const isSubmitting = ui.notifications.submittingReviewId === item.review.id;

  return `
    <article class="notification-card">
      <div class="notification-card-head">
        <div>
          <strong>${escapeHtml(item.candidate.name || "Candidate")}</strong>
          <span>${escapeHtml(job?.title || item.candidate.currentRole || "Unassigned role")}</span>
        </div>
        <span class="notification-stage">${escapeHtml(item.review.stage)}</span>
      </div>
      <p>Moved by ${escapeHtml(item.review.requestedBy?.name || item.candidate.recruiter || "Recruiter")} · ${escapeHtml(formatShortDate(item.review.requestedAt))}</p>
      <button class="notification-link" type="button" data-notification-action="open-candidate" data-candidate-id="${escapeHtml(item.candidate.id)}">View candidate profile</button>
      ${
        canRate
          ? `<div class="notification-rating-grid">
              <label>
                <span>CEO/MD rating *</span>
                <select data-notification-field="rating" data-review-id="${escapeHtml(item.review.id)}">
                  <option value="">Select 1–10</option>
                  ${Array.from({ length: 10 }, (_, index) => index + 1)
                    .map((rating) => `<option value="${rating}" ${String(draft.rating) === String(rating) ? "selected" : ""}>${rating}/10</option>`)
                    .join("")}
                </select>
              </label>
              <label>
                <span>Review note</span>
                <textarea rows="2" maxlength="500" data-notification-field="notes" data-review-id="${escapeHtml(item.review.id)}" placeholder="Strengths, risks, or next action">${escapeHtml(draft.notes || "")}</textarea>
              </label>
              <button class="tool-btn primary" type="button" data-notification-action="submit-rating" data-review-id="${escapeHtml(item.review.id)}" data-candidate-id="${escapeHtml(item.candidate.id)}" ${isSubmitting ? "disabled" : ""}>
                ${isSubmitting ? "Saving…" : "Submit rating"}
              </button>
            </div>`
          : `<p class="notification-awaiting">CEO or Managing Director rating is pending.</p>`
      }
    </article>
  `;
}

function getPendingFounderReviewNotifications() {
  return state.candidates
    .filter((candidate) => !isCandidateDeleted(candidate))
    .flatMap((candidate) =>
      getCandidateFounderReviewRequests(candidate)
        .filter((review) => review.status === "PENDING")
        .map((review) => ({ candidate, review }))
    )
    .sort((left, right) => right.review.requestedAt.localeCompare(left.review.requestedAt));
}

function getCandidateFounderReviewRequests(candidate) {
  const parsedData = candidate?.parsedData && typeof candidate.parsedData === "object" && !Array.isArray(candidate.parsedData)
    ? candidate.parsedData
    : {};
  return (Array.isArray(parsedData.founderReviewRequests) ? parsedData.founderReviewRequests : [])
    .filter((item) => item && typeof item === "object" && item.id)
    .map((item) => ({
      ...item,
      id: String(item.id),
      candidateId: String(item.candidateId || candidate.id),
      stage: String(item.stage || candidate.stage || "Submitted"),
      status: String(item.status || "PENDING").toUpperCase() === "COMPLETED" ? "COMPLETED" : "PENDING",
      requestedAt: String(item.requestedAt || candidate.updatedAt || candidate.createdAt || ""),
      requestedBy: item.requestedBy && typeof item.requestedBy === "object" ? item.requestedBy : {}
    }));
}

function canCurrentUserSubmitFounderReview() {
  const role = normalizeUserRole(getCurrentUser()?.role);
  return role === "CEO" || role === "Managing Director";
}

function onNotificationInput(event) {
  const field = event.target.dataset.notificationField;
  const reviewId = String(event.target.dataset.reviewId || "");
  if (!field || !reviewId) return;
  const current = ui.notifications.drafts[reviewId] || { rating: "", notes: "" };
  ui.notifications.drafts[reviewId] = { ...current, [field]: event.target.value };
}

function onNotificationClick(event) {
  const actionNode = event.target.closest("[data-notification-action]");
  if (!actionNode) return;
  const action = actionNode.dataset.notificationAction;

  if (action === "toggle") {
    ui.notifications.open = !ui.notifications.open;
    renderNotificationCenter();
    return;
  }
  if (action === "close") {
    ui.notifications.open = false;
    renderNotificationCenter();
    return;
  }
  if (action === "open-candidate") {
    openCandidateFromNotification(actionNode.dataset.candidateId);
    return;
  }
  if (action === "submit-rating") {
    void submitFounderReviewRating(actionNode.dataset.candidateId, actionNode.dataset.reviewId);
  }
}

function openCandidateFromNotification(candidateId) {
  const candidate = findCandidateByIdAnywhere(candidateId);
  if (!candidate) return;
  ui.activeSection = "candidates";
  ui.candidates.view = isCandidateDeleted(candidate) ? "deleted" : "active";
  ui.candidates.selectedId = candidate.id;
  ui.candidates.editDraft = candidateDraftFromRecord(candidate);
  ui.notifications.open = false;
  render();
  focusCandidateSidePanel();
}

async function submitFounderReviewRating(candidateId, reviewId) {
  if (!canCurrentUserSubmitFounderReview()) {
    alert("Only the CEO or Managing Director can submit candidate ratings.");
    return;
  }
  const draft = ui.notifications.drafts[reviewId] || {};
  const rating = Number(draft.rating);
  if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
    alert("Select a candidate rating between 1 and 10.");
    return;
  }

  ui.notifications.submittingReviewId = reviewId;
  renderNotificationCenter();
  try {
    const response = await fetch(buildApiUrl(API_ROUTES.founderReview(candidateId)), {
      method: "POST",
      headers: getAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ reviewId, rating, notes: String(draft.notes || "").trim() })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success || !payload?.candidate) {
      throw new Error(payload?.error?.message || "Candidate rating could not be saved.");
    }

    const updated = mapApiCandidateToLocal(payload.candidate);
    upsertCandidateInState(updated);
    delete ui.notifications.drafts[reviewId];
    recordActivity("candidate", `Founder rating completed for ${updated.name}: ${rating}/10`, {
      action: "candidate.founder-rating",
      candidateId: updated.id,
      reviewId,
      rating
    });
    saveAndRender();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Candidate rating could not be saved.");
  } finally {
    ui.notifications.submittingReviewId = "";
    renderNotificationCenter();
  }
}

function renderCurrentUserCard() {
  const currentUser = getCurrentUser();
  if (!el.currentUserName || !el.currentUserEmail) return;
  el.currentUserName.textContent = currentUser ? `${currentUser.name} (${currentUser.role})` : "No active user";
  el.currentUserEmail.textContent = currentUser ? currentUser.email : "CEO / Managing Director required";
}

function renderNav() {
  const allowedSections = getAllowedSectionsForCurrentUser();
  el.navButtons.forEach((button) => {
    const section = String(button.dataset.section || "");
    const isAllowed = allowedSections.has(section);
    button.classList.toggle("is-hidden-by-role", !isAllowed);
    button.classList.toggle("is-active", isAllowed && section === ui.activeSection);
  });
}

function enforceActiveSectionAccess() {
  const allowedSections = getAllowedSectionsForCurrentUser();
  if (!allowedSections.has(ui.activeSection)) {
    ui.activeSection = "dashboard";
  }
}

function getAllowedSectionsForCurrentUser() {
  if (!isAuthenticated()) {
    return new Set(["dashboard"]);
  }

  const founderSections = new Set([
    "dashboard",
    "candidates",
    "candidate-pool",
    "clients",
    "jobs",
    "ai-match",
    "pipeline",
    "interviews",
    "bulk-upload",
    "users",
    "team-dashboard",
    "diagnostics",
    "revenue",
    "recruiter-performance",
    "leaderboard",
    "activity-log"
  ]);
  const recruiterSections = new Set([
    "dashboard",
    "candidates",
    "candidate-pool",
    "jobs",
    "ai-match",
    "pipeline",
    "interviews",
    "bulk-upload",
    "recruiter-performance"
  ]);
  const managerSections = new Set([
    ...recruiterSections,
    "clients",
    "team-dashboard",
    "leaderboard",
    "activity-log"
  ]);
  const viewerSections = new Set([
    "dashboard",
    "candidates",
    "candidate-pool",
    "jobs",
    "pipeline",
    "interviews",
    "recruiter-performance"
  ]);

  const role = normalizeUserRole(getCurrentUser()?.role);
  if (canCurrentUserAccessFounderWorkspace()) return founderSections;
  if (READ_ONLY_ROLES.has(role)) return viewerSections;
  if (role === "TA Manager") return managerSections;
  return recruiterSections;
}

function renderToolbar() {
  const config = SECTION_CONFIG[ui.activeSection];
  el.pageTitle.textContent = config.title;
  el.searchInput.placeholder = canCurrentUserAccessFounderWorkspace()
    ? "Search candidates, jobs, clients"
    : "Search my candidates and assigned jobs";

  if (ui.activeSection === "jobs") {
    const canCreateJob = canCurrentUserWriteRecords();
    el.newRecordBtn.hidden = !canCreateJob;
    el.newRecordBtn.disabled = !canCreateJob;
    el.newRecordBtn.textContent = "Create Job";
    return;
  }

  const schema = FORM_SCHEMAS[config.entity || ""];
  const addable = Boolean(schema) && canCurrentUserWriteRecords() && (config.entity !== "users" || canCurrentUserManageUsers());

  el.newRecordBtn.hidden = !addable;
  el.newRecordBtn.disabled = !addable;
  el.newRecordBtn.textContent = addable ? `Add ${singularLabel(config.title)}` : "Create";
}

function renderSection() {
  if (!isAuthenticated()) {
    el.sectionContainer.innerHTML = renderAuthGuardSection();
    return;
  }

  const section = ui.activeSection;

  if (section === "dashboard") {
    el.sectionContainer.innerHTML = renderDashboardSection();
    return;
  }

  if (section === "candidates") {
    if (ui.api.connected) {
      void ensureCandidatesPageLoaded();
    }
    el.sectionContainer.innerHTML = renderCandidatesSection();
    return;
  }

  if (section === "candidate-pool") {
    el.sectionContainer.innerHTML = renderCandidatePoolSection();
    return;
  }

  if (section === "clients") {
    el.sectionContainer.innerHTML = renderClientsSection();
    return;
  }

  if (section === "jobs") {
    el.sectionContainer.innerHTML = renderJobsSection();
    return;
  }

  if (section === "ai-match") {
    el.sectionContainer.innerHTML = renderAiMatchSection();
    return;
  }

  if (section === "pipeline") {
    el.sectionContainer.innerHTML = renderPipelineSection();
    return;
  }

  if (section === "interviews") {
    el.sectionContainer.innerHTML = renderInterviewsSection();
    return;
  }

  if (section === "bulk-upload") {
    if (ui.api.connected) {
      void refreshPendingDuplicatesFromBackend();
    }
    el.sectionContainer.innerHTML = renderBulkUploadSection();
    return;
  }

  if (section === "users") {
    el.sectionContainer.innerHTML = renderUsersSection();
    return;
  }

  if (section === "team-dashboard") {
    el.sectionContainer.innerHTML = renderTeamDashboardSection();
    return;
  }

  if (section === "diagnostics") {
    void loadDiagnostics();
    el.sectionContainer.innerHTML = renderDiagnosticsSection();
    return;
  }

  if (section === "revenue") {
    el.sectionContainer.innerHTML = renderRevenueSection();
    return;
  }

  if (section === "recruiter-performance") {
    el.sectionContainer.innerHTML = renderRecruiterPerformanceSection();
    return;
  }

  if (section === "leaderboard") {
    el.sectionContainer.innerHTML = renderLeaderboardSection();
    return;
  }

  el.sectionContainer.innerHTML = renderActivityLogSection();
}

function renderAuthGuardSection() {
  return `
    <section class="panel auth-guard-panel container-fluid">
      <div class="row align-items-center g-4">
        <div class="col-12 col-lg-7">
          <p class="eyebrow">Secure workspace</p>
          <h2>Login required to view Agodly ATS data</h2>
          <p class="panel-subtitle">
            Candidate records, revenue, uploads, and team dashboards stay hidden until your session is verified by the backend.
          </p>
        </div>
        <div class="col-12 col-lg-5">
          <div class="auth-guard-card">
            <strong>Protected access</strong>
            <span>CEO / Managing Director: full workspace</span>
            <span>Recruiter: assigned candidates and jobs</span>
            <span>All API data calls require a valid token</span>
          </div>
        </div>
      </div>
    </section>
  `;
}

function goToSection(section) {
  const target = String(section || "dashboard");
  if (!getAllowedSectionsForCurrentUser().has(target)) {
    alert("Your role does not have access to this section.");
    return;
  }
  ui.activeSection = target;
  render();
}

const CANDIDATE_SORT_FIELDS = {
  createdAt: "Created (Newest)",
  updatedAt: "Updated (Newest)",
  name: "Name (A-Z)",
  experienceYears: "Experience",
  currentRole: "Current Role",
  location: "Location",
  stage: "Stage",
  source: "Source",
  recruiter: "Recruiter",
  email: "Email"
};

function normalizeCandidateSortBy(value) {
  const key = String(value || "").trim();
  return Object.prototype.hasOwnProperty.call(CANDIDATE_SORT_FIELDS, key) ? key : "createdAt";
}

function normalizeCandidateSortDir(value) {
  return String(value || "").trim().toLowerCase() === "asc" ? "asc" : "desc";
}

function normalizeCandidatePageSize(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 25;
  return Math.min(Math.floor(parsed), 100);
}

function buildCandidatesQueryKey() {
  const status = ui.candidates.view === "deleted" ? "DELETED" : "ACTIVE";
  const search = String(ui.search || "").trim().toLowerCase();
  const sortBy = normalizeCandidateSortBy(ui.candidates.sortBy);
  const sortDir = normalizeCandidateSortDir(ui.candidates.sortDir);
  const page = Math.max(1, Number(ui.candidates.page || 1));
  const limit = normalizeCandidatePageSize(ui.candidates.limit);
  return [status, search, page, limit, sortBy, sortDir].join("|");
}

function getComparableCandidateSortValue(candidate, sortBy) {
  if (sortBy === "experienceYears") {
    return Number(candidate.experienceYears || 0);
  }

  if (sortBy === "createdAt" || sortBy === "updatedAt") {
    const timestamp = new Date(candidate[sortBy]).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  const value = candidate[sortBy];
  if (typeof value === "number") return value;
  return String(value || "").toLowerCase();
}

function compareCandidatesForSort(a, b, sortBy, sortDir) {
  const left = getComparableCandidateSortValue(a, sortBy);
  const right = getComparableCandidateSortValue(b, sortBy);

  let result = 0;
  if (typeof left === "number" && typeof right === "number") {
    result = left - right;
  } else {
    result = String(left).localeCompare(String(right));
  }

  return sortDir === "asc" ? result : -result;
}

function upsertCandidateInState(candidate) {
  if (!candidate || !candidate.id) return;
  const index = state.candidates.findIndex((item) => String(item.id) === String(candidate.id));
  if (index >= 0) {
    state.candidates[index] = { ...state.candidates[index], ...candidate };
  } else {
    state.candidates.push(candidate);
  }
}

function findCandidateByIdAnywhere(candidateId) {
  const id = String(candidateId || "").trim();
  if (!id) return null;
  return findById(ui.candidates.pageRows || [], id) || findById(state.candidates, id) || null;
}

function getLocalCandidatesPage(view) {
  const sortBy = normalizeCandidateSortBy(ui.candidates.sortBy);
  const sortDir = normalizeCandidateSortDir(ui.candidates.sortDir);
  const limit = normalizeCandidatePageSize(ui.candidates.limit);

  const rows = filteredCandidates({ mode: view });
  const sorted = [...rows].sort((a, b) => compareCandidatesForSort(a, b, sortBy, sortDir));
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(Math.max(1, Number(ui.candidates.page || 1)), totalPages);
  const start = (safePage - 1) * limit;
  const pageRows = sorted.slice(start, start + limit);

  if (safePage !== ui.candidates.page) {
    ui.candidates.page = safePage;
  }
  if (limit !== ui.candidates.limit) {
    ui.candidates.limit = limit;
  }

  return {
    rows: pageRows,
    page: safePage,
    limit,
    total,
    totalPages
  };
}

function getCandidateQualityIssues(candidate) {
  const tracking = normalizeCandidateTracking(candidate);
  const issues = [];
  if (!String(candidate.email || "").trim() && !String(candidate.phone || "").trim()) issues.push("missing-contact");
  if (!String(candidate.recruiter || "").trim() || normalizePersonKey(candidate.recruiter) === "unassigned") issues.push("missing-recruiter");
  if (!String(candidate.jobId || "").trim()) issues.push("missing-job");
  if (!String(candidate.currentRole || "").trim()) issues.push("missing-role");
  if (!tracking.nextStepDate && !PIPELINE_INACTIVE_STAGES.has(candidate.stage)) issues.push("missing-follow-up");
  const updatedAt = new Date(candidate.updatedAt || candidate.createdAt || 0).getTime();
  if (updatedAt && Date.now() - updatedAt > 14 * 86400000 && !PIPELINE_INACTIVE_STAGES.has(candidate.stage)) issues.push("stale");
  return issues;
}

function getCandidateWorkQueue(candidate) {
  if (PIPELINE_INACTIVE_STAGES.has(candidate.stage)) return "inactive";
  const value = normalizeCandidateTracking(candidate).nextStepDate;
  if (!value) return "unscheduled";
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (value < todayKey) return "overdue";
  if (value === todayKey) return "today";
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekKey = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, "0")}-${String(nextWeek.getDate()).padStart(2, "0")}`;
  return value <= nextWeekKey ? "upcoming" : "later";
}

function getCandidateWorkspacePage(view) {
  const sortBy = normalizeCandidateSortBy(ui.candidates.sortBy);
  const sortDir = normalizeCandidateSortDir(ui.candidates.sortDir);
  const limit = normalizeCandidatePageSize(ui.candidates.limit);
  const quality = String(ui.candidates.qualityFilter || "all");
  const queue = String(ui.candidates.workQueue || "all");
  const selected = new Set(ui.candidates.selectedIds || []);
  let rows = filteredCandidates({ mode: view });
  if (quality !== "all") rows = rows.filter((candidate) => getCandidateQualityIssues(candidate).includes(quality));
  if (queue !== "all") rows = rows.filter((candidate) => getCandidateWorkQueue(candidate) === queue);
  const sorted = [...rows].sort((a, b) => compareCandidatesForSort(a, b, sortBy, sortDir));
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(Math.max(1, Number(ui.candidates.page || 1)), totalPages);
  const pageRows = sorted.slice((page - 1) * limit, page * limit);
  ui.candidates.selectedIds = [...selected].filter((id) => rows.some((candidate) => candidate.id === id));
  ui.candidates.page = page;
  return { rows: pageRows, total, totalPages, page, limit };
}

function loadCandidateViews() {
  try {
    const value = JSON.parse(localStorage.getItem(CANDIDATE_VIEWS_KEY) || "[]");
    return Array.isArray(value) ? value.filter((item) => item && item.id && item.name).slice(0, 20) : [];
  } catch {
    return [];
  }
}

function currentCandidateViewSnapshot(name = "") {
  return {
    id: uid("view"),
    name: String(name || "Candidate view").trim().slice(0, 60),
    search: ui.search,
    view: ui.candidates.view,
    sortBy: ui.candidates.sortBy,
    sortDir: ui.candidates.sortDir,
    limit: ui.candidates.limit,
    qualityFilter: ui.candidates.qualityFilter,
    workQueue: ui.candidates.workQueue
  };
}

function applyCandidateView(view) {
  if (!view || typeof view !== "object") return;
  ui.search = String(view.search || "").toLowerCase();
  if (el.searchInput) el.searchInput.value = ui.search;
  ui.candidates.view = view.view === "deleted" ? "deleted" : "active";
  ui.candidates.sortBy = normalizeCandidateSortBy(view.sortBy);
  ui.candidates.sortDir = normalizeCandidateSortDir(view.sortDir);
  ui.candidates.limit = normalizeCandidatePageSize(view.limit);
  ui.candidates.qualityFilter = String(view.qualityFilter || "all");
  ui.candidates.workQueue = String(view.workQueue || "all");
  ui.candidates.page = 1;
  ui.candidates.selectedId = "";
  ui.candidates.editDraft = null;
  ui.candidates.lastQueryKey = "";
}

function applySharedCandidateViewFromUrl() {
  const raw = new URLSearchParams(String(window.location.hash || "").replace(/^#/, "")).get("candidate-view");
  if (!raw) return;
  try {
    const json = decodeURIComponent(escape(window.atob(raw.replace(/-/g, "+").replace(/_/g, "/"))));
    applyCandidateView(JSON.parse(json));
  } catch {
    // Ignore malformed or expired shared-view links.
  }
}

function encodeCandidateView(view) {
  return window.btoa(unescape(encodeURIComponent(JSON.stringify(view)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function candidateQualityLabel(key) {
  return ({
    "missing-contact": "Missing contact",
    "missing-recruiter": "No recruiter",
    "missing-job": "No job",
    "missing-role": "No role",
    "missing-follow-up": "No follow-up",
    stale: "Stale 14+ days"
  })[key] || key;
}

function getCandidateMaxPageForCurrentView() {
  if (ui.api.connected) {
    return Math.max(1, Number(ui.candidates.totalPages || 1));
  }
  const view = ui.candidates.view === "deleted" ? "deleted" : "active";
  return getLocalCandidatesPage(view).totalPages;
}

async function ensureCandidatesPageLoaded(options = {}) {
  if (!ui.api.connected) return;

  const force = Boolean(options.force);
  const status = ui.candidates.view === "deleted" ? "DELETED" : "ACTIVE";
  const q = String(ui.search || "").trim();
  const page = Math.max(1, Number(ui.candidates.page || 1));
  const limit = normalizeCandidatePageSize(ui.candidates.limit);
  const sortBy = normalizeCandidateSortBy(ui.candidates.sortBy);
  const sortDir = normalizeCandidateSortDir(ui.candidates.sortDir);
  const queryKey = buildCandidatesQueryKey();

  if (!force && (ui.candidates.lastQueryKey === queryKey || ui.candidates.inFlightQueryKey === queryKey)) {
    return;
  }

  ui.candidates.sortBy = sortBy;
  ui.candidates.sortDir = sortDir;
  ui.candidates.limit = limit;
  ui.candidates.inFlightQueryKey = queryKey;
  ui.candidates.isLoading = true;

  if (ui.activeSection === "candidates") {
    renderSection();
  }

  try {
    const params = new URLSearchParams();
    params.set("status", status);
    params.set("q", q);
    params.set("page", String(page));
    params.set("limit", String(limit));
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);

    const response = await fetch(`${buildApiUrl(API_ROUTES.listCandidates)}?${params.toString()}`, {
      method: "GET",
      headers: getAuthHeaders({ Accept: "application/json" })
    });
    const payload = await response.json().catch(() => ({}));

    if (response.status === 401 || response.status === 403) {
      ui.candidates.pageRows = [];
      ui.candidates.total = 0;
      ui.candidates.totalPages = 1;
      ui.candidates.activeCount = 0;
      ui.candidates.deletedCount = 0;
      ui.candidates.lastQueryKey = queryKey;
      ui.bootstrapError = payload?.error?.message || "You do not have permission to view these candidates.";
      return;
    }

    if (!response.ok || !payload?.success || !payload?.data) {
      throw new Error(payload?.error?.message || "Could not load candidates list");
    }

    const data = payload.data;
    const rows = Array.isArray(data.rows) ? data.rows.map((item) => mapApiCandidateToLocal(item)) : [];
    rows.forEach((candidate) => upsertCandidateInState(candidate));

    ui.candidates.pageRows = rows;
    ui.candidates.page = Math.max(1, Number(data.page || page));
    ui.candidates.limit = Math.max(1, Number(data.limit || limit));
    ui.candidates.total = Math.max(0, Number(data.total || 0));
    ui.candidates.totalPages = Math.max(1, Number(data.totalPages || 1));
    ui.candidates.activeCount = Math.max(0, Number(data.statusCounts?.active || 0));
    ui.candidates.deletedCount = Math.max(0, Number(data.statusCounts?.deleted || 0));
    ui.candidates.lastQueryKey = queryKey;
  } catch (_error) {
    ui.api.connected = false;
    ui.api.message = "Backend disconnected";
    renderApiStatus();
    ui.candidates.lastQueryKey = queryKey;
  } finally {
    if (ui.candidates.inFlightQueryKey === queryKey) {
      ui.candidates.inFlightQueryKey = "";
      ui.candidates.isLoading = false;
    }

    if (ui.activeSection === "candidates") {
      renderSection();
    }
  }
}

function renderDashboardSection() {
  if (ui.bootstrapError) {
    return renderDashboardLoadError(ui.bootstrapError);
  }

  const candidates = filteredCandidates();
  const jobs = filteredJobs();
  const placements = filteredPlacements();
  const currentUser = getCurrentUser();
  const isFounder = canCurrentUserAccessFounderWorkspace();

  const totalCandidates = candidates.length;
  const totalJobs = jobs.length;
  const submittedThisMonth = candidates.filter((item) => candidateHasReachedStage(item, "Submitted") && isCurrentMonth(item.createdAt)).length;
  const joinedThisMonth = placements.filter((item) => isCurrentMonth(item.date)).length;
  const totalRevenue = placements.reduce((acc, item) => acc + Number(item.revenue || 0), 0);
  const totalMargin = placements.reduce((acc, item) => acc + calculatePlacementMargin(item), 0);
  const closureTracker = getClosureTrackerMetrics(candidates);

  const funnel = PIPELINE_STAGES.map((stage) => ({
    stage,
    count: candidates.filter((item) => item.stage === stage).length
  }));

  const avgDaysToHire = calculateAvgDaysToHire();
  const onboarded = candidates.filter((item) => item.stage === "Onboarded").length;
  const identified = Math.max(candidates.filter((item) => item.stage === "Identified").length, 1);
  const conversion = Math.round((onboarded / identified) * 100);
  const activePipeline = candidates.filter((item) => !PIPELINE_INACTIVE_STAGES.has(item.stage)).length;

  const sourceStats = aggregateBySource(candidates);
  const commandCenter = getOperationalCommandCenter(candidates, jobs);

  return `
    <section class="panel command-hero">
      <div>
        <p class="panel-kicker">${isFounder ? "Founder Command Center" : "Recruiter Workbench"}</p>
        <h2 class="panel-title">${isFounder ? "Company-wide operating view" : "Today’s recruitment execution"}</h2>
        <p class="panel-subtitle">${
          isFounder
            ? "CEO and Managing Director see full finance, operations, users, team performance, and recruitment delivery."
            : `Showing assigned candidates and active hiring work${currentUser ? ` for ${escapeHtml(currentUser.name)}` : ""}.`
        }</p>
      </div>
      <div class="quick-action-grid">
        ${
          isFounder
            ? `
              ${quickActionButton("Team", "Team dashboard", "team-dashboard")}
              ${quickActionButton("Finance", "Revenue view", "revenue")}
              ${quickActionButton("Users", "Access control", "users")}
              ${quickActionButton("Ops", "Activity log", "activity-log")}
            `
            : `
              ${quickActionButton("Candidates", "My candidate list", "candidates")}
              ${quickActionButton("Upload", "Bulk upload CVs", "bulk-upload")}
              ${quickActionButton("AI Match", "Match against JD", "ai-match")}
              ${quickActionButton("Pipeline", "Move stages", "pipeline")}
            `
        }
      </div>
    </section>

    <section class="panel">
      <div class="metrics-grid">
        ${metricCard("Total Candidates", totalCandidates)}
        ${metricCard("Total Jobs", totalJobs)}
        ${metricCard("Submitted This Month", submittedThisMonth)}
        ${metricCard("Joined This Month", joinedThisMonth)}
        ${metricCard("Total Revenue", formatCurrency(totalRevenue))}
        ${metricCard("Total Margin", formatCurrency(totalMargin))}
      </div>
    </section>

    ${renderRecruiterDailyWorkspace(candidates)}
    ${renderClosureTrackerPanel(closureTracker)}
    ${isFounder ? renderTargetAchievementTracker() : renderRecruiterDashboardPerformance()}
    ${renderOnboardedRevenueTracker()}

    <section class="panel">
      <h2 class="panel-title">${isFounder ? "Operations Alerts" : "My Daily Queue"}</h2>
      <p class="panel-subtitle">${isFounder ? "Items requiring founder/operator attention" : "Work that needs recruiter action now"}</p>
      <div class="ops-grid">
        ${commandCenter.map((item) => operationsCard(item)).join("")}
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Recruitment Funnel</h2>
      <p class="panel-subtitle">Click a stage to jump into pipeline view</p>
      <div class="funnel-grid">
        ${funnel
          .map(
            (item) => `
          <button class="funnel-step" data-action="open-pipeline-stage" data-stage="${item.stage}" type="button">
            <strong>${item.count}</strong>
            <p>${item.stage}</p>
          </button>
        `
          )
          .join("")}
      </div>
    </section>

    <section class="panel">
      <div class="insight-grid">
        <article class="insight-card"><p>Avg Time to Hire</p><strong>${avgDaysToHire} days</strong></article>
        <article class="insight-card"><p>Overall Conversion</p><strong>${Number.isFinite(conversion) ? conversion : 0}%</strong></article>
        <article class="insight-card"><p>Active Pipeline</p><strong>${activePipeline}</strong></article>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Source Effectiveness</h2>
      <p class="panel-subtitle">Conversion by sourcing channel</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Candidates</th>
              <th>Onboarded</th>
              <th>Conversion</th>
            </tr>
          </thead>
          <tbody>
            ${sourceStats
              .map((item) => {
                const conv = item.count ? Math.round((item.onboarded / item.count) * 100) : 0;
                return `<tr><td>${escapeHtml(item.source)}</td><td>${item.count}</td><td>${item.onboarded}</td><td>${conv}%</td></tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderRecruiterDailyWorkspace(candidates) {
  const active = candidates.filter((candidate) => !PIPELINE_INACTIVE_STAGES.has(candidate.stage));
  const counts = ["overdue", "today", "upcoming", "unscheduled"].reduce((acc, key) => {
    acc[key] = active.filter((candidate) => getCandidateWorkQueue(candidate) === key).length;
    return acc;
  }, {});
  const priorities = active
    .filter((candidate) => ["overdue", "today", "upcoming"].includes(getCandidateWorkQueue(candidate)))
    .sort((a, b) => String(normalizeCandidateTracking(a).nextStepDate).localeCompare(String(normalizeCandidateTracking(b).nextStepDate)))
    .slice(0, 8);
  return `
    <section class="panel daily-workspace-panel">
      <div class="candidate-list-head"><div><p class="panel-kicker">Daily workspace</p><h2 class="panel-title">Follow-ups that move hiring forward</h2><p class="panel-subtitle">Open a focused queue instead of maintaining a separate tracker.</p></div></div>
      <div class="daily-queue-grid">
        ${[["overdue", "Overdue", counts.overdue], ["today", "Due today", counts.today], ["upcoming", "Next 7 days", counts.upcoming], ["unscheduled", "No follow-up", counts.unscheduled]].map(([key, label, count]) => `<button class="daily-queue-card" type="button" data-action="open-candidate-work-queue" data-queue="${key}"><strong>${count}</strong><span>${label}</span></button>`).join("")}
      </div>
      <div class="table-wrap"><table><thead><tr><th>Candidate</th><th>Role / Job</th><th>Recruiter</th><th>Next step</th><th>Due</th></tr></thead><tbody>${priorities.length ? priorities.map((candidate) => { const tracking = normalizeCandidateTracking(candidate); const job = findById(state.jobs, candidate.jobId); return `<tr><td><button class="link-button" type="button" data-action="open-daily-candidate" data-candidate-id="${escapeHtml(candidate.id)}">${escapeHtml(candidate.name)}</button></td><td>${escapeHtml(job?.title || candidate.currentRole || "Unassigned")}</td><td>${escapeHtml(candidate.recruiter || "Unassigned")}</td><td>${escapeHtml(tracking.nextStep || "Follow up")}</td><td>${escapeHtml(tracking.nextStepDate || "Not set")}</td></tr>`; }).join("") : `<tr><td colspan="5" class="empty">No dated follow-ups yet. Add them from the candidate grid.</td></tr>`}</tbody></table></div>
    </section>`;
}

function renderDashboardLoadError(message) {
  return `
    <section class="panel auth-guard-panel container-fluid">
      <div class="row align-items-center g-4">
        <div class="col-lg-8">
          <p class="panel-kicker">Database Error</p>
          <h2 class="panel-title">Unable to load dashboard data</h2>
          <p class="panel-subtitle">${escapeHtml(message || "The dashboard could not read from the backend database.")}</p>
          <p class="panel-subtitle">This is not a valid zero-count state. Verify the production database and retry.</p>
        </div>
        <div class="col-lg-4 d-flex justify-content-lg-end gap-2">
          <button class="tool-btn primary" data-action="retry-bootstrap" type="button">Retry</button>
          <button class="tool-btn" data-action="go-section" data-section="diagnostics" type="button">Diagnostics</button>
        </div>
      </div>
    </section>
  `;
}

function renderAccessDeniedPanel(message) {
  return `
    <section class="panel auth-guard-panel container-fluid">
      <div class="row align-items-center g-4">
        <div class="col-lg-8">
          <p class="panel-kicker">Access Restricted</p>
          <h2 class="panel-title">You do not have access to this section</h2>
          <p class="panel-subtitle">${escapeHtml(message || "Contact CEO or Managing Director for access.")}</p>
        </div>
      </div>
    </section>
  `;
}

async function loadDiagnostics() {
  if (ui.diagnostics.isLoading) return;

  ui.diagnostics.isLoading = true;
  ui.diagnostics.error = "";

  try {
    const response = await fetch(buildApiUrl(API_ROUTES.diagnostics), {
      method: "GET",
      headers: getAuthHeaders({ Accept: "application/json" })
    });
    const payload = await response.json().catch(() => ({}));
    if (!payload || typeof payload !== "object") {
      throw new Error(`Diagnostics failed with HTTP ${response.status}`);
    }
    ui.diagnostics.data = payload;
    ui.diagnostics.lastLoadedAt = new Date().toISOString();
    if (!response.ok && !payload.checks) {
      throw new Error(payload?.error?.message || `Diagnostics failed with HTTP ${response.status}`);
    }
  } catch (error) {
    ui.diagnostics.error = error instanceof Error ? error.message : "Unable to load diagnostics";
  } finally {
    ui.diagnostics.isLoading = false;
    if (ui.activeSection === "diagnostics") renderSection();
  }
}

function renderDiagnosticsSection() {
  if (!canCurrentUserAccessFounderWorkspace()) {
    return renderAccessDeniedPanel("Diagnostics are restricted to CEO, Managing Director, and Admin users.");
  }

  const data = ui.diagnostics.data;
  const checks = data?.checks || {};
  const diagnostics = data?.diagnostics || {};
  const ai = diagnostics.ai || {};
  const database = checks.database || {};
  const runtimeStorage = checks.runtimeStorage || {};
  const configuration = checks.configuration || {};
  const counts = diagnostics.counts || {};

  return `
    <section class="panel command-hero">
      <div>
        <p class="panel-kicker">Admin Diagnostics</p>
        <h2 class="panel-title">Production health and data source checks</h2>
        <p class="panel-subtitle">Use this page to verify API, database, storage durability, table reads, and deployment safety before trusting dashboard counts.</p>
      </div>
      <div class="quick-action-grid">
        ${diagnosticTile("API Status", data ? (data.success ? "Ready" : "Degraded") : ui.diagnostics.isLoading ? "Loading" : "Unknown")}
        ${diagnosticTile("Database", database.ok ? `${database.provider || "unknown"}` : "Not readable")}
        ${diagnosticTile("Durable Storage", database.durable ? "Yes" : "No")}
        ${diagnosticTile("Environment", database.environment || "unknown")}
      </div>
    </section>

    ${ui.diagnostics.error ? `<section class="panel"><p class="empty-text">${escapeHtml(ui.diagnostics.error)}</p></section>` : ""}

    <section class="panel">
      <div class="section-head">
        <div>
          <h2 class="panel-title">Database Read Status</h2>
          <p class="panel-subtitle">Counts are read from the durable RuntimeState records used by the live ATS.</p>
        </div>
        <button class="tool-btn primary" data-action="reload-diagnostics" type="button">Refresh Diagnostics</button>
      </div>
      <div class="metrics-grid">
        ${metricCard("Candidates", counts.candidates ?? "Error")}
        ${metricCard("Jobs", counts.jobs ?? "Error")}
        ${metricCard("Clients", counts.clients ?? "Error")}
        ${metricCard("Activities", counts.activities ?? "Error")}
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Configuration Findings</h2>
      <div class="table-wrap">
        <table>
          <tbody>
            <tr><td>Database Provider</td><td>${escapeHtml(database.provider || "unknown")}</td></tr>
            <tr><td>Database Durable</td><td>${database.durable ? "Yes" : "No"}</td></tr>
            <tr><td>Runtime Storage</td><td>${escapeHtml(runtimeStorage.path || "-")} (${runtimeStorage.durable ? "durable" : "not durable"})</td></tr>
            <tr><td>Migration Version</td><td>${escapeHtml(diagnostics.migrationVersion || "not_available")}</td></tr>
            <tr><td>Latest Record Created</td><td>${escapeHtml(diagnostics.latestRecordCreated || "-")}</td></tr>
            <tr><td>Latest Successful Write</td><td>${escapeHtml(diagnostics.latestSuccessfulWrite || "-")}</td></tr>
            <tr><td>Last Backup Status</td><td>${escapeHtml(diagnostics.lastBackupStatus || "not_configured")}</td></tr>
            <tr><td>AI Provider</td><td>${escapeHtml(ai.provider || "unknown")}</td></tr>
            <tr><td>AI Model</td><td>${escapeHtml(ai.model || "-")}</td></tr>
            <tr><td>AI Status</td><td>${escapeHtml(ai.status || "unknown")}</td></tr>
            <tr><td>AI Error Category</td><td>${escapeHtml(ai.errorCategory || "-")}</td></tr>
            <tr><td>AI Fallback</td><td>${escapeHtml(ai.fallbackStatus || "ready")}</td></tr>
            <tr><td>AI Last Success</td><td>${escapeHtml(ai.lastSuccessfulRequestAt || "-")}</td></tr>
            <tr><td>Application Version</td><td>${escapeHtml(diagnostics.applicationVersion || "-")}</td></tr>
          </tbody>
        </table>
      </div>
      ${Array.isArray(configuration.issues) && configuration.issues.length ? `<div class="profile-summary"><strong>Issues:</strong> ${configuration.issues.map(escapeHtml).join(" | ")}</div>` : ""}
    </section>
  `;
}

function diagnosticTile(label, value) {
  return `<article class="quick-action-card"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(String(value))}</span></article>`;
}

function renderTargetAchievementTracker() {
  const rows = getRecruiterPerformanceRows();
  const totalCandidateTarget = rows.reduce((acc, item) => acc + Number(item.monthlyTarget || 0), 0);
  const totalCandidates = rows.reduce((acc, item) => acc + item.candidates, 0);
  const totalRevenueTarget = rows.reduce((acc, item) => acc + Number(item.revenueTarget || 0), 0);
  const totalRevenue = rows.reduce((acc, item) => acc + item.revenue, 0);
  const totalMargin = rows.reduce((acc, item) => acc + item.margin, 0);

  return `
    <section class="panel">
      <div class="section-heading-row">
        <div>
          <h2 class="panel-title">TA Target vs Achievement</h2>
          <p class="panel-subtitle">Manual candidate and revenue targets with live achievement from assigned candidates and onboarded revenue.</p>
        </div>
        <div class="tracker-summary">
          <span>${totalCandidates}/${totalCandidateTarget || "-"} candidates</span>
          <span>${formatCurrency(totalRevenue)} / ${formatCurrency(totalRevenueTarget)}</span>
          <span>Margin ${formatCurrency(totalMargin)}</span>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>TA</th>
              <th>Candidate Target</th>
              <th>Achievement</th>
              <th>Onboarded</th>
              <th>Revenue Target</th>
              <th>Revenue Generated</th>
              <th>Margin</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map((row) => {
                      const editable = canCurrentUserManageTaRow(row);
                      return `
                        <tr>
                          <td>
                            <strong>${escapeHtml(row.name)}</strong><br />
                            <span class="muted-cell">${escapeHtml(row.team)}</span>
                          </td>
                          <td>
                            <input
                              class="tracker-input"
                              type="number"
                              min="0"
                              data-tracker-field="monthlyTarget"
                              data-user-id="${escapeHtml(row.userId)}"
                              value="${Number(row.monthlyTarget || 0)}"
                              ${editable && row.userId ? "" : "disabled"}
                            />
                          </td>
                          <td>
                            <div class="target-cell">
                              <span>${row.candidates}/${row.monthlyTarget || "-"}</span>
                              ${progressBar(row.targetAttainment)}
                            </div>
                          </td>
                          <td>${row.joined}</td>
                          <td>
                            <input
                              class="tracker-input"
                              type="number"
                              min="0"
                              data-tracker-field="revenueTarget"
                              data-user-id="${escapeHtml(row.userId)}"
                              value="${Number(row.revenueTarget || 0)}"
                              ${editable && row.userId ? "" : "disabled"}
                            />
                          </td>
                          <td>
                            <div class="target-cell">
                              <span>${formatCurrency(row.revenue)}</span>
                              ${progressBar(row.revenueAttainment)}
                            </div>
                          </td>
                          <td>
                            <strong>${formatCurrency(row.margin)}</strong><br />
                            <span class="muted-cell">${formatPercent(row.marginPercent)} margin</span>
                          </td>
                          <td>
                            <button class="tool-btn" type="button" data-action="save-ta-targets" data-user-id="${escapeHtml(row.userId)}" ${
                              editable && row.userId ? "" : "disabled"
                            }>
                              Save Target
                            </button>
                          </td>
                        </tr>
                      `;
                    })
                    .join("")
                : `<tr><td colspan="8" class="empty">No TA performance data available.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderRecruiterDashboardPerformance() {
  const currentUser = getCurrentUser();
  const ranked = rankRecruiterPerformanceRows(
    getRecruiterPerformanceRows({ includeAll: true, currentMonthOnly: true, ignoreSearch: true })
  );
  const currentUserKeys = new Set(
    [currentUser?.name, currentUser?.email]
      .map(normalizePersonKey)
      .filter(Boolean)
  );
  const currentIndex = ranked.findIndex(
    (row) =>
      (currentUser?.id && row.userId === currentUser.id) ||
      currentUserKeys.has(normalizePersonKey(row.name))
  );

  if (currentIndex < 0) {
    return `
      <section class="panel">
        <h2 class="panel-title">My Target &amp; Leaderboard</h2>
        <p class="panel-subtitle">Your recruiter profile is active, but no performance row is available yet. Ask a founder or TA Manager to confirm your target setup.</p>
      </section>
    `;
  }

  const row = ranked[currentIndex];
  const rank = currentIndex + 1;
  const candidateRemaining = Math.max(Number(row.monthlyTarget || 0) - row.candidates, 0);
  const revenueRemaining = Math.max(Number(row.revenueTarget || 0) - row.revenue, 0);
  let nearbyStart = Math.max(0, currentIndex - 1);
  let nearbyEnd = Math.min(ranked.length, nearbyStart + 3);
  nearbyStart = Math.max(0, nearbyEnd - 3);
  nearbyEnd = Math.min(ranked.length, nearbyStart + 3);
  const nearbyRows = ranked.slice(nearbyStart, nearbyEnd);

  return `
    <section class="panel recruiter-progress-panel">
      <div class="section-heading-row">
        <div>
          <p class="panel-kicker">My Monthly Performance</p>
          <h2 class="panel-title">Target progress &amp; leaderboard standing</h2>
          <p class="panel-subtitle">Live progress for ${escapeHtml(row.name)} in the current calendar month.</p>
        </div>
        <div class="tracker-summary">
          <span>Rank #${rank} of ${ranked.length}</span>
          <span>Score ${row.score}</span>
          <span>${formatPercent(row.targetAttainment)} candidate target</span>
        </div>
      </div>

      <div class="metrics-grid">
        ${metricCard("Candidate Target", row.monthlyTarget || "Not set")}
        ${metricCard("Candidates Added", row.candidates)}
        ${metricCard("Submitted", row.submitted)}
        ${metricCard("Joined", row.joined)}
        ${metricCard("Revenue Target", formatCurrency(row.revenueTarget))}
        ${metricCard("Leaderboard Rank", `#${rank} / ${ranked.length}`)}
      </div>

      <div class="graph-grid recruiter-progress-grid">
        <article class="chart-card">
          <div class="chart-card-head">
            <h3>Candidate target</h3>
            <p>${row.candidates} achieved · ${candidateRemaining} remaining</p>
          </div>
          <div class="target-cell recruiter-target-progress">
            <strong>${row.candidates} / ${row.monthlyTarget || "-"}</strong>
            ${progressBar(row.targetAttainment)}
            <span class="muted-cell">${formatPercent(row.targetAttainment)} complete</span>
          </div>
        </article>
        <article class="chart-card">
          <div class="chart-card-head">
            <h3>Revenue target</h3>
            <p>${formatCurrency(row.revenue)} achieved · ${formatCurrency(revenueRemaining)} remaining</p>
          </div>
          <div class="target-cell recruiter-target-progress">
            <strong>${formatCurrency(row.revenue)} / ${formatCurrency(row.revenueTarget)}</strong>
            ${progressBar(row.revenueAttainment)}
            <span class="muted-cell">${formatPercent(row.revenueAttainment)} complete</span>
          </div>
        </article>
      </div>

      <div class="table-wrap recruiter-nearby-standings">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Recruiter</th>
              <th>Target Progress</th>
              <th>Submitted</th>
              <th>Joined</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            ${nearbyRows
              .map((item) => {
                const itemIndex = ranked.indexOf(item);
                const isCurrent = itemIndex === currentIndex;
                return `
                  <tr class="${isCurrent ? "leaderboard-self" : ""}">
                    <td><span class="rank-pill">${itemIndex + 1}</span></td>
                    <td><strong>${escapeHtml(item.name)}</strong>${isCurrent ? '<br /><span class="muted-cell">You</span>' : ""}</td>
                    <td>
                      <div class="target-cell">
                        <span>${item.candidates}/${item.monthlyTarget || "-"} · ${formatPercent(item.targetAttainment)}</span>
                        ${progressBar(item.targetAttainment)}
                      </div>
                    </td>
                    <td>${item.submitted}</td>
                    <td>${item.joined}</td>
                    <td><strong>${item.score}</strong></td>
                  </tr>
                `;
              })
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderOnboardedRevenueTracker() {
  const rows = getOnboardedRevenueRows();
  const totalRevenue = rows.reduce((acc, item) => acc + item.revenue, 0);
  const totalCost = rows.reduce((acc, item) => acc + item.cost, 0);
  const totalMargin = totalRevenue - totalCost;

  return `
    <section class="panel">
      <div class="section-heading-row">
        <div>
          <h2 class="panel-title">Onboarded Revenue & Margin</h2>
          <p class="panel-subtitle">Update revenue and delivery cost for onboarded candidates. Margin is calculated automatically.</p>
        </div>
        <div class="tracker-summary">
          <span>Revenue ${formatCurrency(totalRevenue)}</span>
          <span>Cost ${formatCurrency(totalCost)}</span>
          <span>Margin ${formatCurrency(totalMargin)}</span>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>TA</th>
              <th>Job</th>
              <th>Joined Date</th>
              <th>Revenue</th>
              <th>Cost</th>
              <th>Margin</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${
              rows.length
                ? rows
                    .map((row) => {
                      const editable = canCurrentUserManageTaName(row.recruiter);
                      return `
                        <tr>
                          <td><strong>${escapeHtml(row.candidateName)}</strong></td>
                          <td>${escapeHtml(row.recruiter)}</td>
                          <td>${escapeHtml(row.jobTitle)}</td>
                          <td>${escapeHtml(row.date)}</td>
                          <td>
                            <input
                              class="tracker-input"
                              type="number"
                              min="0"
                              data-finance-field="revenue"
                              data-candidate-id="${escapeHtml(row.candidateId)}"
                              value="${Number(row.revenue || 0)}"
                              ${editable ? "" : "disabled"}
                            />
                          </td>
                          <td>
                            <input
                              class="tracker-input"
                              type="number"
                              min="0"
                              data-finance-field="cost"
                              data-candidate-id="${escapeHtml(row.candidateId)}"
                              value="${Number(row.cost || 0)}"
                              ${editable ? "" : "disabled"}
                            />
                          </td>
                          <td>
                            <strong>${formatCurrency(row.margin)}</strong><br />
                            <span class="muted-cell">${formatPercent(row.marginPercent)} margin</span>
                          </td>
                          <td>
                            <button class="tool-btn" type="button" data-action="save-placement-finance" data-candidate-id="${escapeHtml(row.candidateId)}" ${
                              editable ? "" : "disabled"
                            }>
                              Save Finance
                            </button>
                          </td>
                        </tr>
                      `;
                    })
                    .join("")
                : `<tr><td colspan="8" class="empty">No onboarded candidates yet. Move candidates to Onboarded to track revenue and margin.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderClosureTrackerPanel(metrics) {
  const rows = metrics.byType;
  const stageRows = metrics.stageSteps;
  const ratingRows = metrics.ratingRows;

  return `
    <section class="panel">
      <div class="section-heading-row">
        <div>
          <h2 class="panel-title">Closure Tracker</h2>
          <p class="panel-subtitle">MTD/YTD closure count split by FTE and recurring Contractual hires, with screened, rejected, submitted and manager rating coverage.</p>
        </div>
        <div class="tracker-summary">
          <span>YTD Closures ${metrics.ytdClosures}</span>
          <span>MTD Closures ${metrics.mtdClosures}</span>
          <span>Avg Rating ${formatRating(metrics.avgOverallRating)}/10</span>
        </div>
      </div>

      <div class="metrics-grid">
        ${metricCard("MTD Screened", metrics.mtdScreened)}
        ${metricCard("MTD Submitted", metrics.mtdSubmitted)}
        ${metricCard("MTD Rejected", metrics.mtdRejected)}
        ${metricCard("YTD Screened", metrics.ytdScreened)}
        ${metricCard("YTD Submitted", metrics.ytdSubmitted)}
      </div>

      <div class="graph-grid tracker-graph-grid">
        ${horizontalChart("YTD Closure Type", "Full time vs recurring contractual closures", rows.map((row) => ({
          label: row.type,
          value: row.ytd,
          meta: `${row.mtd} MTD`
        })))}
        ${horizontalChart("Candidate Steps", "Current candidate movement across further hiring steps", stageRows)}
        ${horizontalChart("Manager Rating", "Technical, communication and overall averages", ratingRows, formatRating, 10)}
      </div>

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Closure Type</th>
              <th>MTD</th>
              <th>YTD</th>
              <th>Revenue</th>
              <th>Margin</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr>
                    <td><strong>${escapeHtml(row.type)}</strong></td>
                    <td>${row.mtd}</td>
                    <td>${row.ytd}</td>
                    <td>${formatCurrency(row.revenue)}</td>
                    <td>${formatCurrency(row.margin)}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderCandidatesSection() {
  const view = ui.candidates.view === "deleted" ? "deleted" : "active";
  const localPage = getLocalCandidatesPage(view);
  const workspaceFilterActive = ui.candidates.qualityFilter !== "all" || ui.candidates.workQueue !== "all";
  const workspacePage = workspaceFilterActive ? getCandidateWorkspacePage(view) : null;
  const rows = workspacePage?.rows || (ui.api.connected ? ui.candidates.pageRows || [] : localPage.rows);
  const total = workspacePage?.total ?? (ui.api.connected ? Number(ui.candidates.total || 0) : localPage.total);
  const totalPages = workspacePage?.totalPages ?? (ui.api.connected ? Math.max(1, Number(ui.candidates.totalPages || 1)) : localPage.totalPages);
  const currentPage = workspacePage?.page ?? (ui.api.connected ? Math.max(1, Number(ui.candidates.page || 1)) : localPage.page);
  const limit = workspacePage?.limit ?? (ui.api.connected ? Math.max(1, Number(ui.candidates.limit || 25)) : localPage.limit);
  const sortBy = normalizeCandidateSortBy(ui.candidates.sortBy);
  const sortDir = normalizeCandidateSortDir(ui.candidates.sortDir);
  const hasRows = rows.length > 0;
  const pageStart = total ? (currentPage - 1) * limit + 1 : 0;
  const pageEnd = total ? pageStart + rows.length - 1 : 0;

  const activeCount = ui.api.connected
    ? Number(ui.candidates.activeCount || 0)
    : filteredCandidates({ mode: "active", ignoreSearch: true }).length;
  const deletedCount = ui.api.connected
    ? Number(ui.candidates.deletedCount || 0)
    : filteredCandidates({ mode: "deleted", ignoreSearch: true }).length;
  const selectedCandidate = findCandidateByIdAnywhere(ui.candidates.selectedId);
  if (selectedCandidate && (!ui.candidates.editDraft || ui.candidates.editDraft.id !== selectedCandidate.id)) {
    ui.candidates.editDraft = candidateDraftFromRecord(selectedCandidate);
  }
  if (!selectedCandidate || (view === "active" && isCandidateDeleted(selectedCandidate)) || (view === "deleted" && !isCandidateDeleted(selectedCandidate))) {
    ui.candidates.selectedId = "";
    ui.candidates.editDraft = null;
  }
  const hasSelectedCandidate = Boolean(ui.candidates.selectedId && ui.candidates.editDraft);
  const activeCandidates = filteredCandidates({ mode: "active", ignoreSearch: true });
  const qualityCounts = activeCandidates.reduce((acc, candidate) => {
    getCandidateQualityIssues(candidate).forEach((issue) => { acc[issue] = Number(acc[issue] || 0) + 1; });
    return acc;
  }, {});
  const selectedIds = new Set(ui.candidates.selectedIds || []);
  const allPageSelected = rows.length > 0 && rows.every((candidate) => selectedIds.has(candidate.id));

  return `
    <section class="candidates-layout ${hasSelectedCandidate ? "has-profile" : "is-list-only"}">
      <article class="panel candidate-list-panel">
        <div class="candidate-list-head">
          <div>
            <h2 class="panel-title">Candidates</h2>
            <p class="panel-subtitle">Browse the full list, then select a candidate to view or edit their profile.</p>
          </div>
          <span class="candidate-open-hint">Select any row to open profile →</span>
        </div>
        <div class="table-actions candidate-controls">
          <button class="tool-btn ${view === "active" ? "primary" : ""}" type="button" data-action="candidates-view" data-view="active">
            Active (${activeCount})
          </button>
          <button class="tool-btn ${view === "deleted" ? "primary" : ""}" type="button" data-action="candidates-view" data-view="deleted">
            Deleted (${deletedCount})
          </button>
          <label class="dialog-field">
            <span>Sort By</span>
            <select data-action="candidates-sort-by">
              ${Object.entries(CANDIDATE_SORT_FIELDS)
                .map(([value, label]) => `<option value="${value}" ${sortBy === value ? "selected" : ""}>${escapeHtml(label)}</option>`)
                .join("")}
            </select>
          </label>
          <label class="dialog-field">
            <span>Direction</span>
            <select data-action="candidates-sort-dir">
              <option value="desc" ${sortDir === "desc" ? "selected" : ""}>Desc</option>
              <option value="asc" ${sortDir === "asc" ? "selected" : ""}>Asc</option>
            </select>
          </label>
          <label class="dialog-field">
            <span>Page Size</span>
            <select data-action="candidates-page-size">
              ${[10, 25, 50, 100].map((size) => `<option value="${size}" ${limit === size ? "selected" : ""}>${size}</option>`).join("")}
            </select>
          </label>
          <label class="dialog-field">
            <span>Daily Queue</span>
            <select data-action="candidates-work-queue">
              ${[["all", "All"], ["overdue", "Overdue"], ["today", "Due today"], ["upcoming", "Next 7 days"], ["unscheduled", "No follow-up"]].map(([value, label]) => `<option value="${value}" ${ui.candidates.workQueue === value ? "selected" : ""}>${label}</option>`).join("")}
            </select>
          </label>
          <label class="dialog-field">
            <span>Saved View</span>
            <select data-action="candidate-saved-view">
              <option value="">Select a view</option>
              ${ui.candidates.savedViews.map((savedView) => `<option value="${escapeHtml(savedView.id)}">${escapeHtml(savedView.name)}</option>`).join("")}
            </select>
          </label>
          <button class="tool-btn" type="button" data-action="save-candidate-view">Save view</button>
          <button class="tool-btn" type="button" data-action="share-candidate-view">Share view</button>
          <button class="tool-btn ${ui.candidates.inlineEdit ? "primary" : ""}" type="button" data-action="toggle-candidate-grid-edit">${ui.candidates.inlineEdit ? "Finish grid editing" : "Edit in grid"}</button>
          <button class="tool-btn" type="button" data-action="undo-candidate-grid-edit" ${(ui.candidates.undoStack || []).length ? "" : "disabled"}>Undo last edit</button>
        </div>
        <div class="candidate-quality-strip" aria-label="Data quality filters">
          <button class="quality-chip ${ui.candidates.qualityFilter === "all" ? "is-active" : ""}" type="button" data-action="candidate-quality-filter" data-filter="all">All records</button>
          ${["missing-contact", "missing-recruiter", "missing-job", "missing-role", "missing-follow-up", "stale"].map((key) => `<button class="quality-chip ${ui.candidates.qualityFilter === key ? "is-active" : ""}" type="button" data-action="candidate-quality-filter" data-filter="${key}">${candidateQualityLabel(key)} <strong>${Number(qualityCounts[key] || 0)}</strong></button>`).join("")}
        </div>
        ${selectedIds.size ? renderCandidateBulkToolbar(selectedIds.size) : ""}
        <div class="table-actions candidate-results-bar" aria-live="polite">
          <span class="panel-subtitle">${
            ui.candidates.isLoading
              ? "Loading candidates..."
              : total
                ? `Showing ${pageStart}-${pageEnd} of ${total}`
                : "No candidates found for current filters."
          }</span>
        </div>
        <div class="table-wrap candidate-table-wrap">
          <table class="candidate-table">
            <thead>
              <tr>
                <th><input type="checkbox" data-action="candidate-select-page" aria-label="Select this page" ${allPageSelected ? "checked" : ""} /></th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Current Role</th>
                <th>Total Exp</th>
                <th>Closure</th>
                <th>Tracking</th>
                <th>Rating</th>
                <th>Location</th>
                <th>Skills</th>
                <th>Stage</th>
                <th>Source</th>
                <th>Recruiter</th>
                <th>Follow-up</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${
                hasRows
                  ? rows.map((candidate) => renderCandidateRow(candidate, candidate.id === ui.candidates.selectedId)).join("")
                  : `<tr><td colspan="16" class="empty">${
                      ui.candidates.isLoading
                        ? "Loading candidates..."
                        : view === "deleted"
                          ? "No deleted candidates found."
                          : "No candidates match current filters."
                    }</td></tr>`
              }
            </tbody>
          </table>
        </div>
        <div class="table-actions candidate-pagination">
          <button
            class="tool-btn"
            type="button"
            data-action="candidates-page-prev"
            ${currentPage <= 1 || ui.candidates.isLoading ? "disabled" : ""}
          >
            Prev
          </button>
          <span class="panel-subtitle">Page ${currentPage} of ${totalPages}</span>
          <button
            class="tool-btn"
            type="button"
            data-action="candidates-page-next"
            ${currentPage >= totalPages || ui.candidates.isLoading ? "disabled" : ""}
          >
            Next
          </button>
        </div>
      </article>

      ${hasSelectedCandidate ? renderCandidateSidePanel() : ""}
    </section>
  `;
}

function renderCandidatePoolSection() {
  const allCandidates = filteredCandidates({ ignoreSearch: true });
  const visibleCandidates = filterCandidatePoolCandidates(allCandidates);
  const sourceStats = aggregateBySource(visibleCandidates, { ignoreGlobalSearch: true });
  const skillCounts = aggregateSkills(visibleCandidates);
  const withSkills = visibleCandidates.filter((item) => Array.isArray(item.skills) && item.skills.length > 0).length;
  const withExperience = visibleCandidates.filter((item) => item.experienceYears != null).length;

  const skillOptions = aggregateSkills(allCandidates).map((item) => item.skill).slice(0, 200);
  const roleOptions = uniqueStringsLocal(
    allCandidates.map((item) => getCandidateCurrentRole(item)).filter((item) => String(item || "").trim().length > 0)
  ).sort((a, b) => a.localeCompare(b));
  const sourceOptions = uniqueStringsLocal(
    allCandidates.map((item) => String(item.source || "").trim()).filter((item) => item.length > 0)
  ).sort((a, b) => a.localeCompare(b));
  const locationOptions = uniqueStringsLocal(
    allCandidates.map((item) => String(item.location || "").trim()).filter((item) => item.length > 0)
  ).sort((a, b) => a.localeCompare(b));

  return `
    <section class="panel">
      <h2 class="panel-title">Candidate Pool</h2>
      <p class="panel-subtitle">All uploaded candidates auto-listed. Filter by skills, experience, role, source, and location.</p>
      <div class="metrics-grid">
        ${metricCard("Visible Candidates", visibleCandidates.length)}
        ${metricCard("With Skills", withSkills)}
        ${metricCard("With Experience", withExperience)}
        ${metricCard("Total in Period", allCandidates.length)}
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Pool Filters</h2>
      <div class="job-form-grid">
        <label class="dialog-field">
          <span>Skill</span>
          <select data-action="candidate-pool-skill">
            <option value="all" ${ui.candidatePool.skill === "all" ? "selected" : ""}>All skills</option>
            ${skillOptions.map((skill) => `<option value="${escapeHtml(skill)}" ${ui.candidatePool.skill === skill ? "selected" : ""}>${escapeHtml(skill)}</option>`).join("")}
          </select>
        </label>

        <label class="dialog-field">
          <span>Current Role</span>
          <select data-action="candidate-pool-role">
            <option value="all" ${ui.candidatePool.role === "all" ? "selected" : ""}>All roles</option>
            ${roleOptions.map((role) => `<option value="${escapeHtml(role)}" ${ui.candidatePool.role === role ? "selected" : ""}>${escapeHtml(role)}</option>`).join("")}
          </select>
        </label>

        <label class="dialog-field">
          <span>Source</span>
          <select data-action="candidate-pool-source">
            <option value="all" ${ui.candidatePool.source === "all" ? "selected" : ""}>All sources</option>
            ${sourceOptions.map((source) => `<option value="${escapeHtml(source)}" ${ui.candidatePool.source === source ? "selected" : ""}>${escapeHtml(source)}</option>`).join("")}
          </select>
        </label>

        <label class="dialog-field">
          <span>Location</span>
          <select data-action="candidate-pool-location">
            <option value="all" ${ui.candidatePool.location === "all" ? "selected" : ""}>All locations</option>
            ${locationOptions.map((location) => `<option value="${escapeHtml(location)}" ${ui.candidatePool.location === location ? "selected" : ""}>${escapeHtml(location)}</option>`).join("")}
          </select>
        </label>

        <label class="dialog-field">
          <span>Min Experience (Years)</span>
          <input
            data-action="candidate-pool-exp-min"
            type="number"
            min="0"
            step="0.1"
            placeholder="e.g. 3"
            value="${escapeHtml(String(ui.candidatePool.expMin || ""))}"
          />
        </label>

        <label class="dialog-field">
          <span>Max Experience (Years)</span>
          <input
            data-action="candidate-pool-exp-max"
            type="number"
            min="0"
            step="0.1"
            placeholder="e.g. 10"
            value="${escapeHtml(String(ui.candidatePool.expMax || ""))}"
          />
        </label>
      </div>
      <div class="table-actions">
        <button class="tool-btn" type="button" data-action="reset-candidate-pool-filters">Clear Filters</button>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Distribution</h2>
      <div class="metrics-grid">
        ${sourceStats.slice(0, 5).map((item) => metricCard(item.source, item.count)).join("")}
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Top Skills</h2>
      <div class="skill-cloud">
        ${skillCounts.length
          ? skillCounts
              .slice(0, 24)
              .map((item) => `<span class="skill-pill">${escapeHtml(item.skill)} (${item.count})</span>`)
              .join("")
          : `<p class="empty">No skills available.</p>`}
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Candidate List</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Current Role</th>
              <th>Experience</th>
              <th>Skills</th>
              <th>Current Company</th>
              <th>Location</th>
              <th>Source</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              visibleCandidates.length
                ? visibleCandidates
                    .map((candidate) => {
                      const skillsText = candidate.skills.length ? candidate.skills.join(", ") : "-";
                      const experienceText = candidate.experienceYears == null ? "-" : `${candidate.experienceYears} yrs`;
                      return `
                        <tr>
                          <td>${escapeHtml(candidate.name)}</td>
                          <td>${escapeHtml(getCandidateCurrentRole(candidate) || "-")}</td>
                          <td>${escapeHtml(experienceText)}</td>
                          <td>${escapeHtml(skillsText)}</td>
                          <td>${escapeHtml(candidate.currentCompany || "-")}</td>
                          <td>${escapeHtml(candidate.location || "-")}</td>
                          <td>${escapeHtml(candidate.source || "-")}</td>
                          <td>
                            <button class="tool-btn" type="button" data-action="open-candidate-from-pool" data-candidate-id="${escapeHtml(
                              candidate.id
                            )}">
                              Open Profile
                            </button>
                          </td>
                        </tr>
                      `;
                    })
                    .join("")
                : `<tr><td colspan="8" class="empty">No candidates matched current pool filters.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderClientsSection() {
  const clients = filteredClients();

  return `
    <section class="panel">
      <h2 class="panel-title">Clients</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Client</th>
              <th>Industry</th>
              <th>Owner</th>
              <th>Open Jobs</th>
            </tr>
          </thead>
          <tbody>
            ${clients.length
              ? clients
                  .map((client) => {
                    const openJobs = state.jobs.filter((job) => job.clientId === client.id && isJobStatusActive(job.status)).length;
                    return `<tr><td>${escapeHtml(client.name)}</td><td>${escapeHtml(client.industry)}</td><td>${escapeHtml(client.owner)}</td><td>${openJobs}</td></tr>`;
                  })
                  .join("")
              : `<tr><td colspan="4" class="empty">No clients match current filters.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderJobsSection() {
  if (ui.jobs.mode === "create") {
    return renderCreateJobSection();
  }

  return renderJobsListSection();
}

function renderJobsListSection() {
  const jobs = filteredJobs({ includeJobsFilters: true });
  const canDeletePermanently = canCurrentUserAccessFounderWorkspace();
  if (!ui.jobs.insightsLoading && !Array.isArray(ui.jobs.insights) && !ui.jobs.insightsError) {
    queueMicrotask(() => void loadJobInsights());
  }

  return `
    ${renderHiringDemandInsights()}

    <section class="panel">
      <div class="jobs-header">
        <div>
          <h2 class="panel-title">Jobs</h2>
          <p class="panel-subtitle">Manage your job postings (${state.jobs.length} total)</p>
        </div>
        <button class="tool-btn jobs-create-btn" type="button" data-action="create-job">+ Create Job</button>
      </div>

      <div class="jobs-filters">
        <input
          data-action="jobs-search"
          type="search"
          value="${escapeHtml(ui.jobs.search)}"
          placeholder="Search jobs..."
        />
        <select data-action="jobs-status-filter">
          ${["all", "active", "draft", "paused", "on_hold", "filled", "closed", "cancelled", "archived"]
            .map(
              (value) =>
                `<option value="${value}" ${ui.jobs.statusFilter === value ? "selected" : ""}>${
                  value === "all" ? "All status" : displayJobStatus(value)
                }</option>`
            )
            .join("")}
        </select>
        <select data-action="jobs-client-filter">
          <option value="all">All clients</option>
          ${state.clients
            .map(
              (client) =>
                `<option value="${escapeHtml(client.id)}" ${ui.jobs.clientFilter === client.id ? "selected" : ""}>${escapeHtml(client.name)}</option>`
            )
            .join("")}
        </select>
      </div>
    </section>

    <section class="panel">
      ${
        jobs.length
          ? `
        <div class="table-wrap">
          <table class="jobs-table">
            <thead>
              <tr>
                <th>Role</th>
                <th>Client</th>
                <th>Arrangement</th>
                <th>Status</th>
                <th>Openings</th>
                <th>Role Type</th>
                <th>Commercials</th>
                <th>Required Skills</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${jobs
                .map((job) => {
                  const client = findById(state.clients, job.clientId);
                  return `
                    <tr>
                      <td>${escapeHtml(job.title)}</td>
                      <td>${escapeHtml(client?.name || "Unassigned")}</td>
                      <td>
                        <strong>${escapeHtml(normalizeWorkModeLabel(job.workMode))}</strong>
                        <span class="jobs-cell-note">${escapeHtml(job.location || job.remoteScope || "-")}</span>
                        <span class="jobs-cell-note">${escapeHtml(job.primaryTimeZone || "No time zone")}</span>
                      </td>
                      <td>
                        <select class="job-status-select" data-action="job-status-change" data-job-id="${escapeHtml(job.id)}" aria-label="Change status for ${escapeHtml(job.title)}">
                          ${JOB_STATUS_OPTIONS.map((status) => `<option value="${status}" ${normalizeJobStatus(job.status) === status ? "selected" : ""}>${displayJobStatus(status)}</option>`).join("")}
                        </select>
                      </td>
                      <td>${Number(job.openings || 0)}</td>
                      <td>${statusBadge(normalizeJobType(job.jobType))}</td>
                      <td>${escapeHtml(formatJobCommercials(job))}</td>
                      <td>${escapeHtml((job.requiredSkills || []).join(", ") || "-")}</td>
                      <td>
                        <details class="job-actions-menu">
                          <summary class="tool-btn" aria-label="Actions for ${escapeHtml(job.title)}">Actions</summary>
                          <div class="job-actions-popover">
                            <button type="button" data-action="edit-job" data-job-id="${escapeHtml(job.id)}">Edit job</button>
                            <button type="button" data-action="view-job-audit" data-job-id="${escapeHtml(job.id)}">View history</button>
                            <button type="button" data-action="duplicate-job" data-job-id="${escapeHtml(job.id)}">Duplicate as draft</button>
                            <button type="button" data-action="build-job-candidate-pool" data-job-id="${escapeHtml(job.id)}">Build candidate pool</button>
                            ${normalizeJobStatus(job.status) !== "ARCHIVED" ? `<button type="button" data-action="archive-job" data-job-id="${escapeHtml(job.id)}">Archive safely</button>` : ""}
                            ${canDeletePermanently ? `<button class="danger" type="button" data-action="delete-job-permanently" data-job-id="${escapeHtml(job.id)}">Delete permanently</button>` : ""}
                          </div>
                        </details>
                      </td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      `
          : `
        <div class="jobs-empty">
          <h3>No jobs found</h3>
          <p class="panel-subtitle">Try adjusting your filters</p>
          <button class="tool-btn jobs-create-btn" type="button" data-action="create-job">Create Job</button>
        </div>
      `
      }
    </section>
    ${renderJobAuditPanel()}
  `;
}

function renderHiringDemandInsights() {
  const insights = Array.isArray(ui.jobs.insights) ? ui.jobs.insights : [];
  return `
    <section class="panel demand-insights-panel">
      <div class="jobs-header">
        <div>
          <p class="jobs-eyebrow">Historical demand</p>
          <h2 class="panel-title">Hiring Demand Insights</h2>
          <p class="panel-subtitle">Recommendations use recorded job frequency and current candidate supply; no demand is invented.</p>
        </div>
        <button class="tool-btn" type="button" data-action="refresh-job-insights" ${ui.jobs.insightsLoading ? "disabled" : ""}>${ui.jobs.insightsLoading ? "Analysing…" : "Refresh"}</button>
      </div>
      ${ui.jobs.insightsError ? `<p class="form-error">${escapeHtml(ui.jobs.insightsError)}</p>` : ""}
      ${ui.jobs.insightsLoading && !insights.length ? `<div class="jobs-insight-empty">Analysing historical requirements…</div>` : ""}
      ${!ui.jobs.insightsLoading && !insights.length && !ui.jobs.insightsError ? `<div class="jobs-insight-empty">Insights will appear after published job history is available.</div>` : ""}
      ${insights.length ? `
        <div class="demand-insights-grid">
          ${insights.slice(0, 6).map((insight) => `
            <article class="demand-insight-card">
              <div class="demand-insight-head">
                <div><h3>${escapeHtml(insight.label)}</h3><p>${Number(insight.jobs12m || 0)} jobs / ${Number(insight.openings12m || 0)} openings in 12 months</p></div>
                <span class="demand-gap ${Number(insight.supplyGap || 0) > 0 ? "has-gap" : ""}">${Number(insight.supplyGap || 0)} gap</span>
              </div>
              <div class="demand-stats">
                <span><strong>${Number(insight.jobs3m || 0)}</strong>3 mo</span>
                <span><strong>${Number(insight.jobs6m || 0)}</strong>6 mo</span>
                <span><strong>${insight.averageFrequencyDays ? `${Number(insight.averageFrequencyDays)}d` : "—"}</strong>frequency</span>
                <span><strong>${Number(insight.availableCandidates || 0)}</strong>available</span>
              </div>
              <p class="demand-recommendation">Recommended pool: ${Number(insight.recommendedPoolSize || 0)} candidates${insight.commonLocations?.length ? ` · ${escapeHtml(insight.commonLocations.join(", "))}` : ""}</p>
              <div class="jobs-chip-wrap">${(insight.skills || []).slice(0, 5).map((skill) => `<span class="skill-pill">${escapeHtml(skill)}</span>`).join("")}</div>
              <button class="tool-btn primary" type="button" data-action="build-insight-candidate-pool" data-insight-key="${escapeHtml(insight.key)}">Build Pool</button>
            </article>
          `).join("")}
        </div>
      ` : ""}
    </section>
  `;
}

function renderJobAuditPanel() {
  if (!ui.jobs.auditJobId) return "";
  const job = findById(state.jobs, ui.jobs.auditJobId);
  return `
    <section class="panel job-audit-panel" aria-live="polite">
      <div class="jobs-header">
        <div><p class="jobs-eyebrow">Immutable activity history</p><h2 class="panel-title">${escapeHtml(job?.title || "Job")} audit trail</h2></div>
        <button class="tool-btn" type="button" data-action="close-job-audit">Close</button>
      </div>
      ${ui.jobs.auditLoading ? `<p class="panel-subtitle">Loading history…</p>` : ""}
      ${!ui.jobs.auditLoading && !ui.jobs.auditEntries.length ? `<p class="panel-subtitle">No audit entries recorded yet.</p>` : ""}
      <ol class="job-audit-list">
        ${ui.jobs.auditEntries.map((entry) => `
          <li><span class="job-audit-dot"></span><div>
            <strong>${escapeHtml(String(entry.action || "Updated").replaceAll("_", " "))}</strong>
            <p>${escapeHtml(entry.actorName || "System")} · ${escapeHtml(formatDate(entry.createdAt))}</p>
            ${entry.fromStatus || entry.toStatus ? `<p>${escapeHtml(displayJobStatus(entry.fromStatus || "DRAFT"))} → ${escapeHtml(displayJobStatus(entry.toStatus || entry.fromStatus))}</p>` : ""}
            ${entry.reason ? `<p class="job-audit-reason">${escapeHtml(entry.reason)}</p>` : ""}
          </div></li>
        `).join("")}
      </ol>
    </section>
  `;
}

function renderCreateJobSection() {
  const draft = ui.jobs.draft;
  const selectedLocations = Array.isArray(draft.locations) ? draft.locations : [];
  const jobType = normalizeJobType(draft.jobType);
  const role = normalizeUserRole(getCurrentUser()?.role);
  const canCreateClient = canCurrentUserAccessFounderWorkspace() || role === "TA Manager";

  return `
    <section class="panel">
      <div class="jobs-create-header">
        <button class="tool-btn" type="button" data-action="back-to-jobs">&larr;</button>
        <div>
          <h2 class="panel-title">${draft.id ? "Edit Job" : "Create Job"}</h2>
          <p class="panel-subtitle">Start with the essentials. Publishing validates the full requirement; drafts can remain incomplete.</p>
        </div>
      </div>
    </section>

    <details class="panel jobs-jd-assist" ${draft.jdText ? "open" : ""}>
      <summary><span><strong>Paste Job Description</strong><small>Optional · auto-fill title, experience, skills, locations and work mode</small></span></summary>
      <div class="jobs-subhead">
        <div>
          <h3 class="jobs-block-title">Job Description</h3>
          <p class="panel-subtitle">Paste the full JD to enable AI-powered candidate matching and auto-fill</p>
        </div>
        <button class="tool-btn" type="button" data-action="autofill-job-from-jd">Auto-Fill from JD</button>
      </div>
      <textarea
        class="job-jd-textarea"
        data-action="job-jd-text"
        rows="10"
        placeholder="Paste your job description here..."
      >${escapeHtml(draft.jdText || "")}</textarea>
      <p class="panel-subtitle">Paste a JD and click "Auto-Fill from JD" to extract title, skills, experience, and details.</p>
    </details>

    <section class="panel jobs-essential-panel">
      <p class="jobs-eyebrow">Quick create</p>
      <h3 class="jobs-block-title">Essential information</h3>
      <div class="job-form-grid">
        <label class="dialog-field">
          <span>Job Title *</span>
          <input data-action="job-title" type="text" value="${escapeHtml(draft.title || "")}" placeholder="e.g. Senior React Developer" />
        </label>

        <div class="dialog-field">
          <div class="jobs-inline-head">
            <span>Client</span>
            ${canCreateClient ? '<button class="jobs-link-btn" type="button" data-action="create-client-inline">Create New Client</button>' : ""}
          </div>
          <select data-action="job-client">
            <option value="">None</option>
            ${state.clients
              .map(
                (client) =>
                  `<option value="${escapeHtml(client.id)}" ${draft.clientId === client.id ? "selected" : ""}>${escapeHtml(client.name)}</option>`
              )
              .join("")}
          </select>
        </div>

        <label class="dialog-field">
          <span>Work Mode</span>
          <select data-action="job-work-mode">
            ${["Onsite", "Hybrid", "Remote"].map((mode) => `<option value="${mode}" ${draft.workMode === mode ? "selected" : ""}>${mode}</option>`).join("")}
          </select>
        </label>

        <label class="dialog-field">
          <span>Priority</span>
          <select data-action="job-priority">
            ${JOB_PRIORITY_OPTIONS.map((priority) => `<option value="${priority}" ${draft.priority === priority ? "selected" : ""}>${toTitleCase(priority.toLowerCase())}</option>`).join("")}
          </select>
        </label>

        <label class="dialog-field">
          <span>Role Type</span>
          <select data-action="job-type">
            ${JOB_TYPE_OPTIONS.map(
              (type) => `<option value="${type}" ${jobType === type ? "selected" : ""}>${type}</option>`
            ).join("")}
          </select>
        </label>

        <label class="dialog-field">
          <span>Openings</span>
          <input data-action="job-openings" min="1" step="1" type="number" value="${escapeHtml(String(draft.openings || 1))}" />
        </label>
      </div>
    </section>

    <section class="panel">
      <h3 class="jobs-block-title">Location &amp; time-zone coverage</h3>
      <div class="job-form-grid">
        ${draft.workMode === "Remote" ? `
          <label class="dialog-field">
            <span>Remote coverage</span>
            <select data-action="job-remote-scope">
              ${["City", "State", "India", "Selected countries", "Region", "Worldwide"].map((scope) => `<option value="${scope}" ${draft.remoteScope === scope ? "selected" : ""}>${scope}</option>`).join("")}
            </select>
          </label>
        ` : ""}
        <label class="dialog-field"><span>Country</span><input data-action="job-country" value="${escapeHtml(draft.country || "")}" placeholder="India" /></label>
        <label class="dialog-field"><span>State / region</span><input data-action="job-state" value="${escapeHtml(draft.state || "")}" placeholder="Karnataka" /></label>
        <label class="dialog-field"><span>Primary city</span><input data-action="job-city" value="${escapeHtml(draft.city || "")}" placeholder="Bengaluru" list="jobCityOptions" /></label>
        <div class="dialog-field job-wide">
          <span>Permitted cities / locations ${draft.workMode !== "Remote" ? "*" : ""}</span>
          <div class="jobs-skill-input">
            <input id="jobLocationEntry" data-action="job-location-entry" value="${escapeHtml(draft.locationEntry || "")}" placeholder="Add Bengaluru, Hyderabad, Pune…" list="jobCityOptions" />
            <button class="tool-btn" type="button" data-action="add-job-location">Add</button>
          </div>
          <datalist id="jobCityOptions">${INDIA_CITY_OPTIONS.map((city) => `<option value="${escapeHtml(city)}"></option>`).join("")}</datalist>
          <div class="jobs-chip-wrap">${selectedLocations.length ? selectedLocations.map((location) => `<span class="skill-pill">${escapeHtml(location)}<button class="jobs-chip-remove" type="button" data-action="remove-job-location" data-location="${escapeHtml(location)}" aria-label="Remove ${escapeHtml(location)}">×</button></span>`).join("") : `<span class="panel-subtitle">No locations added.</span>`}</div>
        </div>
        <label class="dialog-field">
          <span>Primary time zone *</span>
          <select data-action="job-primary-timezone">
            ${uniqueStringsLocal([draft.primaryTimeZone, ...JOB_TIME_ZONE_OPTIONS]).map((timeZone) => `<option value="${escapeHtml(timeZone)}" ${draft.primaryTimeZone === timeZone ? "selected" : ""}>${escapeHtml(timeZone)}</option>`).join("")}
          </select>
        </label>
        <div class="dialog-field">
          <span>Additional time zones</span>
          <div class="jobs-skill-input">
            <select id="jobSupportedTimeZoneEntry" data-action="job-supported-timezone-entry">${JOB_TIME_ZONE_OPTIONS.map((timeZone) => `<option value="${escapeHtml(timeZone)}">${escapeHtml(timeZone)}</option>`).join("")}</select>
            <button class="tool-btn" type="button" data-action="add-job-timezone">Add</button>
          </div>
          <div class="jobs-chip-wrap">${(draft.supportedTimeZones || []).map((timeZone) => `<span class="skill-pill">${escapeHtml(timeZone)}<button class="jobs-chip-remove" type="button" data-action="remove-job-timezone" data-time-zone="${escapeHtml(timeZone)}" aria-label="Remove ${escapeHtml(timeZone)}">×</button></span>`).join("")}</div>
        </div>
        <label class="dialog-field"><span>Required working hours</span><input data-action="job-working-hours" value="${escapeHtml(draft.workingHours || "")}" placeholder="09:00–18:00 IST" /></label>
        <label class="dialog-field"><span>Minimum overlap (hours)</span><input data-action="job-timezone-overlap" type="number" min="0" max="24" value="${escapeHtml(String(draft.minTimeZoneOverlap || ""))}" placeholder="4" /></label>
      </div>
    </section>

    <section class="panel">
      <h3 class="jobs-block-title">Requirements</h3>
      <div class="job-form-grid">
        <div class="dialog-field">
          <span>Experience (Years)</span>
          <div class="jobs-range">
            <input data-action="job-exp-min" type="number" min="0" step="0.5" placeholder="Min" value="${escapeHtml(String(draft.expMin || ""))}" />
            <span>to</span>
            <input data-action="job-exp-max" type="number" min="0" step="0.5" placeholder="Max" value="${escapeHtml(String(draft.expMax || ""))}" />
          </div>
        </div>

        <div class="dialog-field job-wide">
          <span>Required Skills</span>
          <div class="jobs-skill-input">
            <input
              id="jobRequiredSkillInput"
              data-action="job-skill-input"
              data-skill-type="requiredSkills"
              type="text"
              placeholder="Add a skill and press Enter"
            />
            <button class="tool-btn" type="button" data-action="add-job-skill" data-skill-type="requiredSkills">+</button>
          </div>
          <div class="jobs-chip-wrap">
            ${renderJobSkillChips(draft.requiredSkills, "requiredSkills")}
          </div>
        </div>

      </div>
    </section>

    <details class="panel jobs-advanced-panel">
      <summary><span><strong>Advanced options</strong><small>Commercials and preferred skills</small></span></summary>
      <div class="job-form-grid jobs-advanced-content">
        <label class="dialog-field">
          <span>Currency</span>
          <select data-action="job-currency">
            <option value="INR" ${draft.currency === "INR" ? "selected" : ""}>INR (₹)</option>
            <option value="USD" ${draft.currency === "USD" ? "selected" : ""}>USD ($)</option>
          </select>
        </label>
        ${renderJobCommercialFields(draft)}
        <div class="dialog-field job-wide">
          <span>Preferred Skills (Nice to have)</span>
          <div class="jobs-skill-input">
            <input id="jobPreferredSkillInput" data-action="job-skill-input" data-skill-type="preferredSkills" type="text" placeholder="Add a skill and press Enter" />
            <button class="tool-btn" type="button" data-action="add-job-skill" data-skill-type="preferredSkills">+</button>
          </div>
          <div class="jobs-chip-wrap">${renderJobSkillChips(draft.preferredSkills, "preferredSkills")}</div>
        </div>
      </div>
    </details>

    <section class="jobs-footer-actions">
      <button class="tool-btn" type="button" data-action="cancel-job-edit">Cancel</button>
      <div class="jobs-footer-right">
        ${draft.id ? "" : `<button class="tool-btn" type="button" data-action="save-job-draft" ${ui.jobs.isSaving ? "disabled" : ""}>${ui.jobs.isSaving ? "Saving…" : "Save as Draft"}</button>`}
        <button class="tool-btn jobs-publish-btn" type="button" data-action="create-job-publish" ${ui.jobs.isSaving ? "disabled" : ""}>${ui.jobs.isSaving ? "Saving…" : draft.id ? "Save Changes" : "Create & Publish"}</button>
      </div>
    </section>
  `;
}

function renderAiMatchSection() {
  const prompt = String(ui.aiMatch.prompt || "");
  const jdText = String(ui.aiMatch.jdText || "");
  const keywordText = String(ui.aiMatch.keywordText || "");
  const response = ui.aiMatch.lastResponse;
  const results = Array.isArray(response?.results) ? response.results : [];
  const history = Array.isArray(ui.aiMatch.chatHistory) ? ui.aiMatch.chatHistory.slice(-20) : [];

  return `
    <section class="panel">
      <h2 class="panel-title">MY LLM</h2>
      <p class="panel-subtitle">
        Recruitment Copilot with tool access across ATS data. Just paste the JD below and run AI Match.
      </p>
      <div class="ai-match-controls ai-match-mini-form">
        <label class="dialog-field">
          <span class="panel-subtitle">Job Description</span>
          <textarea id="aiMatchJdInput" rows="8" placeholder="Paste full job description here...">${escapeHtml(jdText)}</textarea>
        </label>
        <label class="dialog-field">
          <span class="panel-subtitle">Keywords (Optional)</span>
          <input id="aiMatchKeywordsInput" type="text" value="${escapeHtml(keywordText)}" placeholder="e.g. node.js, react, aws" />
        </label>
      </div>
      <div class="candidate-panel-actions">
        <button class="tool-btn primary" type="button" data-action="run-ai-match-mini" ${ui.aiMatch.isLoading ? "disabled" : ""}>
          ${ui.aiMatch.isLoading ? "Matching..." : "Run AI Match from JD"}
        </button>
      </div>
      <p class="panel-subtitle">Tip: Paste JD and click run. Keywords are optional.</p>
    </section>

    <section class="panel">
      <h2 class="panel-title">Advanced Prompt (Optional)</h2>
      <p class="panel-subtitle">Use free-form prompt only for custom instructions.</p>
      <div class="ai-match-controls">
        <label class="dialog-field">
          <span class="panel-subtitle">Prompt</span>
          <textarea id="myLlmPrompt" rows="6" placeholder="e.g. Find backend candidates with Node.js, 5+ years, Bangalore">${escapeHtml(
            prompt
          )}</textarea>
        </label>
      </div>
      <div class="candidate-panel-actions">
        <button class="tool-btn primary" type="button" data-action="run-my-llm" ${ui.aiMatch.isLoading ? "disabled" : ""}>
          ${ui.aiMatch.isLoading ? "Thinking..." : "Run MY LLM"}
        </button>
      </div>
      <p class="panel-subtitle">Tip: Press Ctrl/Cmd + Enter to run.</p>
    </section>

    <section class="panel">
      <h2 class="panel-title">Chat</h2>
      <div class="myllm-chat-list">
        ${
          history.length
            ? history.map((item) => renderMyLlmChatMessage(item)).join("")
            : `<p class="empty">No chat history yet.</p>`
        }
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">AI Response</h2>
      <p>${escapeHtml(String(response?.explanation || "No response yet. Enter a prompt above to start."))}</p>
      ${
        response?.toolCalls?.length
          ? `<p class="panel-subtitle">Tools used: ${escapeHtml(response.toolCalls.join(", "))}</p>`
          : ""
      }
      ${
        ui.aiMatch.lastInteractionId
          ? `
            <div class="table-actions">
              <button class="tool-btn" type="button" data-action="myllm-feedback" data-helpful="true">Helpful</button>
              <button class="tool-btn" type="button" data-action="myllm-feedback" data-helpful="false">Needs Improvement</button>
            </div>
          `
          : ""
      }
    </section>

    <section class="panel">
      <h2 class="panel-title">Results</h2>
      <div class="myllm-card-grid">
        ${results.length ? results.map((item) => renderMyLlmResultCard(item)).join("") : `<p class="empty">No results available.</p>`}
      </div>
    </section>
  `;
}

function renderMyLlmChatMessage(item) {
  const role = String(item?.role || "assistant");
  const content = String(item?.content || "");
  const toolCalls = Array.isArray(item?.toolCalls) ? item.toolCalls : [];

  return `
    <article class="myllm-chat-item ${role === "user" ? "is-user" : "is-assistant"}">
      <p class="myllm-chat-role">${role === "user" ? "You" : "MY LLM"}</p>
      <p class="myllm-chat-content">${escapeHtml(content || "-")}</p>
      ${toolCalls.length ? `<p class="panel-subtitle">Tools: ${escapeHtml(toolCalls.join(", "))}</p>` : ""}
    </article>
  `;
}

function renderMyLlmResultCard(item) {
  const result = item && typeof item === "object" ? item : { value: item };
  const candidateId = String(result.id || result.candidateId || "");
  const name = String(result.name || result.candidateName || result.fullName || "");
  const role = String(result.currentRole || result.role || "");
  const company = String(result.currentCompany || result.company || "");
  const location = String(result.location || "");
  const skills = Array.isArray(result.skills) ? result.skills.map((skill) => String(skill)).filter(Boolean) : [];
  const experience =
    result.experienceYears == null || result.experienceYears === ""
      ? ""
      : `${Number(result.experienceYears)} years`;
  const score = result.matchPercentage == null ? "" : `${Math.round(Number(result.matchPercentage))}% match`;
  const message = String(result.message || "");
  const question = String(result.question || "");
  const summary =
    String(result.shortProfileSummary || result.experienceOverview || result.profileSummary || result.explanation || result.value || "").trim();

  return `
    <article class="confidence-card">
      ${name ? `<p><strong>${escapeHtml(name)}</strong></p>` : ""}
      ${role || company ? `<p class="panel-subtitle">${escapeHtml([role, company].filter(Boolean).join(" @ "))}</p>` : ""}
      ${location ? `<p class="panel-subtitle">Location: ${escapeHtml(location)}</p>` : ""}
      ${experience ? `<p class="panel-subtitle">Experience: ${escapeHtml(experience)}</p>` : ""}
      ${score ? `<p class="panel-subtitle">${escapeHtml(score)}</p>` : ""}
      ${skills.length ? `<p class="confidence-row">Skills: ${escapeHtml(skills.join(", "))}</p>` : ""}
      ${question ? `<p class="confidence-row">${escapeHtml(question)}</p>` : ""}
      ${message ? `<p class="confidence-note">${escapeHtml(message)}</p>` : ""}
      ${summary ? `<p class="confidence-note">${escapeHtml(summary)}</p>` : ""}
      ${
        candidateId
          ? `<div class="table-actions"><button class="tool-btn" type="button" data-action="open-candidate-profile" data-candidate-id="${escapeHtml(
              candidateId
            )}">Open Full Profile</button></div>`
          : ""
      }
    </article>
  `;
}

function buildAiMatchMiniPrompt() {
  const jdText = String(ui.aiMatch.jdText || "").trim();
  const keywordText = String(ui.aiMatch.keywordText || "").trim();
  if (!jdText) return "";

  return keywordText
    ? `Match candidates to this job description.\n\nJob Description:\n${jdText}\n\nKeywords:\n${keywordText}`
    : `Match candidates to this job description.\n\nJob Description:\n${jdText}`;
}

async function submitAiMatchMiniForm() {
  if (ui.aiMatch.isLoading) return;
  const prompt = buildAiMatchMiniPrompt();
  if (!prompt) {
    alert("Please paste a job description first.");
    return;
  }

  const jobDescription = String(ui.aiMatch.jdText || "").trim();
  const keywords = String(ui.aiMatch.keywordText || "").trim();

  ui.aiMatch.isLoading = true;
  renderSection();

  try {
    if (!ui.api.connected) {
      throw new Error("Backend unavailable");
    }

    const response = await fetch(buildApiUrl(API_ROUTES.aiMatchScore), {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        jobDescription,
        keywords: keywords || undefined,
        topK: 15
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error?.message || "AI Match scoring failed");
    }

    const explanation = String(payload.explanation || "AI Match scoring completed.");
    const results = Array.isArray(payload.results) ? payload.results : [];
    const timestamp = new Date().toISOString();

    ui.aiMatch.lastResponse = {
      explanation,
      results,
      toolCalls: ["matchCandidatesToJob"]
    };
    ui.aiMatch.currentMatches = hydrateAiMatchPlacements(results);
    ui.aiMatch.lastInteractionId = "";
    ui.aiMatch.chatHistory = [
      ...(Array.isArray(ui.aiMatch.chatHistory) ? ui.aiMatch.chatHistory : []),
      {
        role: "user",
        content: prompt,
        createdAt: timestamp
      },
      {
        role: "assistant",
        content: explanation,
        toolCalls: ["matchCandidatesToJob"],
        interactionId: "",
        createdAt: timestamp
      }
    ].slice(-40);
  } catch (_error) {
    ui.aiMatch.isLoading = false;
    renderSection();
    await submitMyLlmPrompt(prompt);
    return;
  }

  ui.aiMatch.isLoading = false;
  renderSection();
}

async function submitMyLlmPrompt(explicitPrompt) {
  const promptSource = explicitPrompt !== undefined ? explicitPrompt : ui.aiMatch.prompt;
  const prompt = String(promptSource || "").trim();
  if (!prompt || ui.aiMatch.isLoading) return;

  ui.aiMatch.chatHistory = [
    ...(Array.isArray(ui.aiMatch.chatHistory) ? ui.aiMatch.chatHistory : []),
    {
      role: "user",
      content: prompt,
      createdAt: new Date().toISOString()
    }
  ].slice(-40);
  if (explicitPrompt === undefined) {
    ui.aiMatch.prompt = "";
  }
  ui.aiMatch.isLoading = true;
  renderSection();

  try {
    if (!ui.api.connected) {
      throw new Error("Backend unavailable");
    }

    const response = await fetch(buildApiUrl(API_ROUTES.aiChat), {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        prompt,
        conversationId: ui.aiMatch.conversationId || undefined
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error?.message || "MY LLM request failed");
    }

    ui.aiMatch.lastResponse = {
      explanation: String(payload.explanation || "Completed"),
      results: Array.isArray(payload.results) ? payload.results : [],
      toolCalls: Array.isArray(payload.toolCalls) ? payload.toolCalls.map((item) => String(item)) : []
    };
    ui.aiMatch.currentMatches = hydrateAiMatchPlacements(ui.aiMatch.lastResponse.results);
    ui.aiMatch.lastInteractionId = String(payload.interactionId || "");
    ui.aiMatch.conversationId = String(payload.conversationId || ui.aiMatch.conversationId || "");
    ui.aiMatch.chatHistory = [
      ...(Array.isArray(ui.aiMatch.chatHistory) ? ui.aiMatch.chatHistory : []),
      {
        role: "assistant",
        content: String(payload.explanation || "Completed"),
        toolCalls: Array.isArray(payload.toolCalls) ? payload.toolCalls.map((item) => String(item)) : [],
        interactionId: String(payload.interactionId || ""),
        createdAt: new Date().toISOString()
      }
    ].slice(-40);
  } catch (_error) {
    ui.aiMatch.lastResponse = await runLocalMyLlmFallback(prompt);
    ui.aiMatch.currentMatches = hydrateAiMatchPlacements(ui.aiMatch.lastResponse.results);
    ui.aiMatch.lastInteractionId = "";
    ui.aiMatch.chatHistory = [
      ...(Array.isArray(ui.aiMatch.chatHistory) ? ui.aiMatch.chatHistory : []),
      {
        role: "assistant",
        content: String(ui.aiMatch.lastResponse?.explanation || "Local fallback response"),
        toolCalls: Array.isArray(ui.aiMatch.lastResponse?.toolCalls) ? ui.aiMatch.lastResponse.toolCalls : [],
        interactionId: "",
        createdAt: new Date().toISOString()
      }
    ].slice(-40);
  } finally {
    ui.aiMatch.isLoading = false;
    renderSection();
  }
}

async function submitMyLlmFeedback(helpful) {
  const interactionId = String(ui.aiMatch.lastInteractionId || "");
  if (!interactionId) return;

  let correction = "";
  if (!helpful) {
    const text = prompt("What should MY LLM improve for this answer?");
    correction = String(text || "").trim();
  }

  if (!ui.api.connected) return;

  try {
    await fetch(buildApiUrl(API_ROUTES.aiFeedback), {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        interactionId,
        helpful: Boolean(helpful),
        correction: correction || undefined
      })
    });
  } catch (_error) {
    // Silent feedback failure to avoid interrupting recruiter flow.
  }
}

async function runLocalMyLlmFallback(prompt) {
  const lower = String(prompt || "").toLowerCase();
  const hasJobSignal = /\b(job|jd|job description|requirement|requirements)\b/i.test(prompt);
  const hasSkillBlock = /\b(?:skills?|keywords?)\s*[:=-]/i.test(prompt);

  if ((lower.includes("match") && lower.includes("job")) || (hasJobSignal && hasSkillBlock)) {
    const analysis = analyzeJdInput(prompt, "");
    const matches = buildAiMatches(analysis).slice(0, 10);
    return {
      explanation: matches.length
        ? `Local fallback: ranked ${matches.length} candidates by JD signal matching.`
        : "Local fallback: no candidates matched the provided job context.",
      results: matches.map((item) => ({
        id: item.candidate.id,
        name: item.candidate.name,
        currentRole: getCandidateCurrentRole(item.candidate),
        location: item.candidate.location || "",
        experienceYears: item.candidate.experienceYears,
        skills: item.matchedSkills,
        matchPercentage: item.score,
        shortProfileSummary: item.explanation
      })),
      toolCalls: ["localMatchCandidatesToJob"]
    };
  }

  const searchIntent = parseLocalCandidateSearchIntent(prompt);
  const filtered = filteredCandidates()
    .filter((candidate) => {
      const candidateSkills = (candidate.skills || []).map((skill) => String(skill).toLowerCase());
      const candidateRole = String(getCandidateCurrentRole(candidate) || "").toLowerCase();
      const candidateLocation = String(candidate.location || "").toLowerCase();
      const candidateCompany = String(candidate.currentCompany || "").toLowerCase();
      const expYears = Number(candidate.experienceYears || 0);
      const haystack = `${candidate.name} ${candidate.email} ${candidate.phone} ${candidateRole} ${candidateLocation} ${candidateCompany} ${
        candidate.profileSummary || ""
      } ${candidateSkills.join(" ")}`.toLowerCase();

      if (searchIntent.skills.length) {
        const matchedSkillCount = searchIntent.skills.filter((skill) =>
          candidateSkills.some((candidateSkill) => candidateSkill.includes(skill) || skill.includes(candidateSkill))
        ).length;
        if (searchIntent.requireAllSkills ? matchedSkillCount < searchIntent.skills.length : matchedSkillCount === 0) return false;
      }
      if (searchIntent.role && !candidateRole.includes(searchIntent.role)) return false;
      if (searchIntent.location && !candidateLocation.includes(searchIntent.location)) return false;
      if (searchIntent.company && !candidateCompany.includes(searchIntent.company)) return false;
      if (searchIntent.minExperience != null && expYears < searchIntent.minExperience) return false;
      if (searchIntent.queryTerms.length) {
        const queryHits = searchIntent.queryTerms.filter((term) => haystack.includes(term)).length;
        if (queryHits === 0) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aSkills = (a.skills || []).map((skill) => String(skill).toLowerCase());
      const bSkills = (b.skills || []).map((skill) => String(skill).toLowerCase());
      const aHits = searchIntent.skills.filter((skill) =>
        aSkills.some((candidateSkill) => candidateSkill.includes(skill) || skill.includes(candidateSkill))
      ).length;
      const bHits = searchIntent.skills.filter((skill) =>
        bSkills.some((candidateSkill) => candidateSkill.includes(skill) || skill.includes(candidateSkill))
      ).length;
      if (bHits !== aHits) return bHits - aHits;
      return Number(b.experienceYears || 0) - Number(a.experienceYears || 0);
    })
    .slice(0, 12);

  return {
    explanation: filtered.length
      ? `Local fallback: found ${filtered.length} candidate(s) from current ATS data.`
      : "Local fallback: no candidates found for this request.",
    results: filtered.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      currentRole: getCandidateCurrentRole(candidate),
      currentCompany: candidate.currentCompany,
      location: candidate.location,
      experienceYears: candidate.experienceYears,
      skills: candidate.skills,
      shortProfileSummary: candidate.profileSummary || candidate.source
    })),
    toolCalls: ["localSearchCandidates"]
  };
}

function parseLocalCandidateSearchIntent(prompt) {
  const text = String(prompt || "");
  const lower = text.toLowerCase();
  const keywordBlock = text.match(/\b(?:keywords?|skills?)\s*[:=-]\s*([^\n]+)/i);
  const explicitKeywords = keywordBlock
    ? keywordBlock[1]
        .split(/[|,;/]+/g)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length >= 2)
    : [];
  const freeformSkillBlock = text.match(/\bwith\s+([A-Za-z0-9+.#/\-&,\s]{3,120})/i);
  const freeformSkills = freeformSkillBlock
    ? freeformSkillBlock[1]
        .split(/[|,;/]+|\band\b/gi)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length >= 2 && item.length <= 40)
        .filter((item) => !/^\d/.test(item))
        .filter((item) => !/\b(year|years|yr|yrs|experience|exp|location|city|based)\b/.test(item))
        .filter((item) => !LOCAL_QUERY_STOP_WORDS.has(item))
    : [];
  const skills = uniqueStringsLocal([...extractCatalogSkills(text), ...freeformSkills]).map((item) => item.toLowerCase());
  const role = (ROLE_HINTS.find((item) => lower.includes(item.toLowerCase())) || "").toLowerCase();
  const location =
    INDIA_CITY_OPTIONS.find((city) => lower.includes(city.toLowerCase())) ||
    (lower.includes("remote") ? "remote" : "");
  const companyMatch = text.match(/\b(?:from|at|company)\s+([A-Za-z0-9&.\- ]{2,50})/i);
  const expMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years|year|yrs|yr)/i);
  const queryTerms = uniqueStringsLocal([
    ...text
      .toLowerCase()
      .replace(/[^a-z0-9+.#/\s-]/g, " ")
      .split(/\s+/g)
      .map((item) => item.trim())
      .filter((item) => item.length >= 3 && !LOCAL_QUERY_STOP_WORDS.has(item)),
    ...explicitKeywords
  ])
    .map((item) => item.toLowerCase())
    .slice(0, 10);

  return {
    skills: uniqueStringsLocal(skills),
    role,
    location: location.toLowerCase(),
    company: companyMatch ? companyMatch[1].trim().toLowerCase() : "",
    minExperience: expMatch ? Number(expMatch[1]) : null,
    requireAllSkills: /\b(all|must have|mandatory)\b/i.test(text),
    queryTerms
  };
}

function hydrateAiMatchPlacements(results) {
  const rows = Array.isArray(results) ? results : [];

  return rows
    .map((item) => {
      const result = item && typeof item === "object" ? item : {};
      const candidateId = String(result.id || result.candidateId || "").trim();
      if (!candidateId) return null;

      const existing = findById(state.candidates, candidateId);
      const candidate = existing
        ? existing
        : {
            id: candidateId,
            name: String(result.name || result.candidateName || result.fullName || "Unknown Candidate"),
            email: String(result.email || ""),
            phone: String(result.phone || ""),
            currentRole: String(result.currentRole || ""),
            currentCompany: String(result.currentCompany || ""),
            location: String(result.location || ""),
            education: String(result.education || ""),
            profileSummary: String(result.shortProfileSummary || result.profileSummary || ""),
            source: "AI Match",
            skills: Array.isArray(result.skills) ? result.skills.map(String) : [],
            keywords: [],
            experienceYears: parseNullableNumber(result.experienceYears),
            stage: "Identified",
            jobId: "",
            recruiter: "AI",
            createdAt: todayISO(),
            status: "ACTIVE",
            deletedAt: null
          };

      const score = Math.max(0, Math.min(100, Number(result.matchPercentage || 0)));
      const matchedTerms = Array.isArray(result.matchedTerms) ? result.matchedTerms.map(String) : [];
      const missingMustHaves = Array.isArray(result.missingMustHaves) ? result.missingMustHaves.map(String) : [];
      const matchedSkills = Array.isArray(result.matchedSkills)
        ? result.matchedSkills.map(String)
        : Array.isArray(result.skills)
          ? result.skills.map(String)
          : [];
      const confidenceLabel = String(result.confidenceLabel || (score >= 80 ? "High" : score >= 55 ? "Medium" : "Low"));
      const experienceGapYears = Number(result.experienceGapYears || 0);

      return {
        candidate,
        candidateId: candidate.id,
        score,
        confidenceLabel,
        matchedTerms,
        matchedSkills,
        matchedMustHaves: matchedSkills,
        missingMustHaves,
        experienceGapYears,
        explanation: String(result.confidenceExplanation || result.shortProfileSummary || result.profileSummary || ""),
        bestJobTitle: String(result.bestJobTitle || "General Fit"),
        scoreBreakdown:
          result.scoreBreakdown && typeof result.scoreBreakdown === "object"
            ? result.scoreBreakdown
            : {
                weights: { terms: 0.65, skills: 0.25, experience: 0.1 },
                normalized: { terms: 0, skills: 0, experience: 0 },
                weightedPoints: { terms: 0, skills: 0, experience: 0 }
              }
      };
    })
    .filter(Boolean);
}

function renderPipelineSection() {
  const visibleCandidates = filteredCandidates();
  const recruiterOptions = getPipelineRecruiterOptions(visibleCandidates);
  const jobOptions = getPipelineJobOptions(visibleCandidates);
  const candidates = visibleCandidates
    .filter((item) => (ui.pipelineFilter === "all" ? true : item.stage === ui.pipelineFilter))
    .filter((item) => (ui.pipelineRecruiterFilter === "all" ? true : getPipelineRecruiterKey(item) === ui.pipelineRecruiterFilter))
    .filter((item) => (ui.pipelineJobFilter === "all" ? true : getPipelineJobFilterValue(item) === ui.pipelineJobFilter))
    .sort(comparePipelineCandidates);
  const visibleStages = PIPELINE_STAGES;
  const canWrite = canCurrentUserWriteRecords();

  const board = visibleStages
    .map((stage) => {
      const stageCandidates = candidates.filter((item) => item.stage === stage);
      return `
        <section class="pipeline-col">
          <h3>${stage} (${stageCandidates.length})</h3>
          ${stageCandidates.length
            ? stageCandidates
                .map((item) => {
                  const job = findById(state.jobs, item.jobId);
                  const role = job?.title || getCandidateCurrentRole(item) || "Unassigned role";
                  const skills = Array.isArray(item.skills) ? item.skills.slice(0, 3) : [];
                  return `
                  <article class="pipeline-item">
                    <p><strong>${escapeHtml(item.name)}</strong></p>
                    <p class="meta">${escapeHtml(role)}</p>
                    <p class="meta">${item.experienceYears == null ? "Experience not set" : `${escapeHtml(String(item.experienceYears))} yrs`} · ${escapeHtml(item.location || "Location not set")}</p>
                    ${
                      skills.length
                        ? `<div class="pipeline-skill-row">${skills.map((skill) => `<span>${escapeHtml(skill)}</span>`).join("")}</div>`
                        : ""
                    }
                    <p class="meta">Recruiter: ${escapeHtml(getPipelineRecruiterName(item))}</p>
                    <select data-action="move-stage" data-candidate-id="${item.id}" ${canWrite ? "" : "disabled"}>
                      ${PIPELINE_STAGES.map((option) => `<option value="${option}" ${option === item.stage ? "selected" : ""}>${option}</option>`).join("")}
                    </select>
                  </article>
                `;
                })
                .join("")
            : `<p class="empty">No candidates</p>`}
        </section>
      `;
    })
    .join("");

  return `
    <section class="panel">
      <h2 class="panel-title">Pipeline Board</h2>
      <div class="pipeline-toolbar">
        <label class="pipeline-filter-field">
          <span>Stage</span>
          <select data-action="pipeline-filter" aria-label="Filter pipeline by stage">
          <option value="all" ${ui.pipelineFilter === "all" ? "selected" : ""}>All stages</option>
          ${PIPELINE_STAGES.map((stage) => `<option value="${stage}" ${ui.pipelineFilter === stage ? "selected" : ""}>${stage}</option>`).join("")}
          </select>
        </label>
        <label class="pipeline-filter-field">
          <span>Recruiter</span>
          <select data-action="pipeline-recruiter-filter" aria-label="Filter pipeline by recruiter">
            <option value="all" ${ui.pipelineRecruiterFilter === "all" ? "selected" : ""}>All recruiters</option>
            ${recruiterOptions
              .map(
                (option) =>
                  `<option value="${escapeHtml(option.value)}" ${ui.pipelineRecruiterFilter === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`
              )
              .join("")}
          </select>
        </label>
        <label class="pipeline-filter-field">
          <span>Job role</span>
          <select data-action="pipeline-job-filter" aria-label="Filter pipeline by job role">
            <option value="all" ${ui.pipelineJobFilter === "all" ? "selected" : ""}>All job roles</option>
            ${jobOptions
              .map(
                (option) =>
                  `<option value="${escapeHtml(option.value)}" ${ui.pipelineJobFilter === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`
              )
              .join("")}
          </select>
        </label>
        <button class="tool-btn" type="button" data-action="clear-pipeline-filter">Clear filters</button>
        <span class="pipeline-filter-count" aria-live="polite">Showing ${candidates.length} of ${visibleCandidates.length} candidates</span>
        <div class="pipeline-scroll-controls" aria-label="Pipeline horizontal navigation">
          <button class="tool-btn" type="button" data-action="pipeline-scroll" data-direction="left" aria-label="Scroll pipeline left">← Left</button>
          <span>Drag, swipe, Shift + wheel, or use arrow keys</span>
          <button class="tool-btn" type="button" data-action="pipeline-scroll" data-direction="right" aria-label="Scroll pipeline right">Right →</button>
        </div>
      </div>
      <div class="pipeline-board" tabindex="0" role="region" aria-label="Pipeline stages. Scroll horizontally to view all stages.">${board}</div>
    </section>
  `;
}

function getPipelineRecruiterName(candidate) {
  return String(candidate?.recruiter || "").trim() || "Unassigned";
}

function getPipelineRecruiterKey(candidate) {
  return normalizePersonKey(getPipelineRecruiterName(candidate)) || "__unassigned__";
}

function getPipelineRecruiterOptions(candidates) {
  const options = new Map();
  candidates.forEach((candidate) => {
    const value = getPipelineRecruiterKey(candidate);
    if (!options.has(value)) options.set(value, getPipelineRecruiterName(candidate));
  });
  return [...options.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
}

function getPipelineJobFilterValue(candidate) {
  return String(candidate?.jobId || "").trim() || "__unassigned__";
}

function getPipelineJobRole(candidate) {
  const jobId = getPipelineJobFilterValue(candidate);
  if (jobId === "__unassigned__") return "Unassigned";
  return findById(state.jobs, jobId)?.title || jobId;
}

function getPipelineJobOptions(candidates) {
  const options = new Map();
  candidates.forEach((candidate) => {
    const value = getPipelineJobFilterValue(candidate);
    if (!options.has(value)) options.set(value, getPipelineJobRole(candidate));
  });
  return [...options.entries()]
    .map(([value, label]) => ({ value, label }))
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
}

function comparePipelineCandidates(left, right) {
  return (
    getPipelineRecruiterName(left).localeCompare(getPipelineRecruiterName(right), undefined, { sensitivity: "base" }) ||
    getPipelineJobRole(left).localeCompare(getPipelineJobRole(right), undefined, { sensitivity: "base" }) ||
    String(left?.name || "").localeCompare(String(right?.name || ""), undefined, { sensitivity: "base" })
  );
}

function renderInterviewsSection() {
  const interviews = filteredInterviews();

  return `
    <section class="panel">
      <h2 class="panel-title">Interviews</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Job</th>
              <th>Round</th>
              <th>Scheduled</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${interviews.length
              ? interviews
                  .map((item) => {
                    const candidate = findById(state.candidates, item.candidateId);
                    const job = findById(state.jobs, item.jobId);
                    return `
                      <tr>
                        <td>${escapeHtml(candidate?.name || item.candidateId)}</td>
                        <td>${escapeHtml(job?.title || item.jobId)}</td>
                        <td>${escapeHtml(item.round)}</td>
                        <td>${escapeHtml(item.scheduledAt)}</td>
                        <td>${statusBadge(item.status)}</td>
                      </tr>
                    `;
                  })
                  .join("")
              : `<tr><td colspan="5" class="empty">No interviews found.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderBulkUploadSection() {
  const summary = state.bulkUpload;
  const results = Array.isArray(summary?.results) ? summary.results : [];
  const duplicates = Array.isArray(summary?.duplicates) ? summary.duplicates : [];
  const blockedDuplicates = Array.isArray(summary?.blockedDuplicates) ? summary.blockedDuplicates : [];
  const notes = Array.isArray(summary?.candidateNotes) ? summary.candidateNotes : [];

  return `
    <section class="panel">
      <h2 class="panel-title">Bulk Upload</h2>
      <p class="panel-subtitle">Preview Excel/CSV data before it is saved, or upload CV files for automatic extraction.</p>
      <div class="bulk-toolbar">
        <button class="tool-btn primary" type="button" data-action="open-bulk-spreadsheet-picker">Import Excel / CSV</button>
        <button class="tool-btn primary" type="button" data-action="open-bulk-cv-picker">Upload CV Files</button>
        <button class="tool-btn" type="button" data-action="open-bulk-csv-picker">Upload CSV</button>
        <button class="tool-btn" type="button" data-action="download-bulk-template">Download CSV Template</button>
        <button class="tool-btn" type="button" data-action="open-bulk-picker">Upload Mixed Files</button>
      </div>
      <p class="panel-subtitle">
        Parser mode: ${ui.api.connected ? "Backend Deep Parsing" : "Local Fallback Parser"}
        ${ui.bulkUpload.isProcessing || ui.bulkUpload.isPreviewing ? "<span class='bulk-processing-chip'>Processing upload...</span>" : ""}
      </p>
      <p class="panel-subtitle">AI-grade CV extraction is available when backend is connected and OPENAI key is configured.</p>
      <p class="panel-subtitle">${summary.lastRunAt ? `Last run: ${escapeHtml(formatDate(summary.lastRunAt))}` : "No uploads yet"}</p>
      <input id="bulkUploadInput" type="file" accept=".csv,.xlsx,.pdf,.doc,.docx" multiple hidden />
      <input id="bulkUploadCvInput" type="file" accept=".pdf,.doc,.docx" multiple hidden />
      <input id="bulkUploadCsvInput" type="file" accept=".csv" multiple hidden />
      <input id="bulkUploadSpreadsheetInput" type="file" accept=".csv,.xlsx" multiple hidden />
    </section>

    ${renderBulkImportPreview()}

    <section class="panel bulk-upload-layout">
      <div
        class="bulk-dropzone"
        data-dropzone="bulk-upload"
        data-action="open-bulk-picker"
        role="button"
        tabindex="0"
        aria-label="Drop CV, Excel, and CSV files here or click to upload"
      >
        <div class="bulk-drop-icon">+</div>
        <p class="bulk-drop-title">Drop files here or click to upload</p>
        <p class="bulk-drop-sub">Supported: PDF, DOC, DOCX, CSV, XLSX up to 10MB</p>
      </div>

      <aside class="bulk-side">
        <section class="panel compact">
          <h3 class="panel-subtitle">Upload Stats</h3>
          <div class="bulk-stats-grid">
            ${metricCard("Total Files", summary.totalFiles || 0)}
            ${metricCard("Pending", summary.pending || 0)}
            ${metricCard("Completed", summary.completed || 0)}
            ${metricCard("Failed", summary.failed || 0)}
            ${metricCard("Blocked Duplicates", Number(summary.blockedCount || 0))}
          </div>
        </section>

        <section class="panel compact">
          <h3 class="panel-subtitle">Tips</h3>
          <ul class="bulk-tips">
            <li>Max file size 10MB</li>
            <li>Supported PDF, DOC, DOCX, CSV, XLSX</li>
            <li>Avoid encrypted PDFs</li>
            <li>Clear text resumes work best</li>
          </ul>
        </section>
      </aside>
    </section>

    <section class="panel">
      <h2 class="panel-title">Recent Upload Results</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Type</th>
              <th>Status</th>
              <th>Candidates Added</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            ${
              results.length
                ? results
                    .slice(0, 30)
                    .map(
                      (item) =>
                        `<tr><td>${escapeHtml(item.fileName)}</td><td>${escapeHtml(item.kind)}</td><td>${statusBadge(item.status)}</td><td>${Number(item.added || 0)}</td><td>${escapeHtml(item.message || "-")}</td></tr>`
                    )
                    .join("")
                : `<tr><td colspan="5" class="empty">No upload activity yet.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Blocked Duplicate Uploads</h2>
      <p class="panel-subtitle">These candidates were not saved because their email address or phone number already exists in the database.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            ${
              blockedDuplicates.length
                ? blockedDuplicates
                    .slice(0, 40)
                    .map(
                      (candidate) =>
                        `<tr><td>${escapeHtml(candidate.name || "Unknown")}</td><td>${escapeHtml(candidate.email || "-")}</td><td>${escapeHtml(candidate.phone || "-")}</td><td>${escapeHtml(candidate.reason || "Blocked duplicate")}</td></tr>`
                    )
                    .join("")
                : `<tr><td colspan="4" class="empty">No duplicate uploads were blocked in recent runs.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Extracted Candidate Notes</h2>
      <p class="panel-subtitle">Auto-captured from uploaded CV and CSV files.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Contact</th>
              <th>Current Role</th>
              <th>Experience</th>
              <th>Skills</th>
              <th>Summary</th>
            </tr>
          </thead>
          <tbody>
            ${
              notes.length
                ? notes
                    .slice(0, 40)
                    .map(
                      (candidate) =>
                        `<tr>
                          <td>${escapeHtml(candidate.name || "Unknown")}</td>
                          <td>${escapeHtml(candidate.email || "-")}<br />${escapeHtml(candidate.phone || "-")}</td>
                          <td>${escapeHtml(getCandidateCurrentRole(candidate) || "-")}</td>
                          <td>${candidate.experienceYears == null ? "-" : `${candidate.experienceYears} yrs`}</td>
                          <td>${escapeHtml((candidate.skills || []).join(", ") || "-")}</td>
                          <td>${escapeHtml(candidate.profileSummary || candidate.source || "-")}</td>
                        </tr>`
                    )
                    .join("")
                : `<tr><td colspan="6" class="empty">No extracted candidate notes yet.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Duplicate Review</h2>
      <p class="panel-subtitle">Detected by email or phone across historical uploads.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Pending Candidate</th>
              <th>Detected Match</th>
              <th>Reason</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${
              duplicates.length
                ? duplicates
                    .map((group) => {
                      const pending = group.duplicateCandidate || {};
                      const matches = Array.isArray(group.matchedCandidates) ? group.matchedCandidates : [];

                      return matches
                        .map((match) => {
                          return `
                            <tr>
                              <td>
                                ${escapeHtml(pending.name || "Unknown")}<br />
                                <span class="panel-subtitle">${escapeHtml(pending.email || pending.phone || "No contact")}</span>
                              </td>
                              <td>
                                ${escapeHtml(match.name || "Unknown")}<br />
                                <span class="panel-subtitle">${escapeHtml(match.email || match.phone || "No contact")}</span>
                              </td>
                              <td>${escapeHtml(group.reason || "Potential duplicate")}</td>
                              <td>
                                <div class="table-actions">
                                  <button
                                    class="tool-btn"
                                    type="button"
                                    data-action="merge-duplicate"
                                    data-primary-id="${escapeHtml(match.id || "")}"
                                    data-duplicate-id="${escapeHtml(pending.id || "")}"
                                  >
                                    Merge
                                  </button>
                                  <button
                                    class="tool-btn"
                                    type="button"
                                    data-action="ignore-duplicate"
                                    data-duplicate-id="${escapeHtml(pending.id || "")}"
                                  >
                                    Ignore
                                  </button>
                                </div>
                              </td>
                            </tr>
                          `;
                        })
                        .join("");
                    })
                    .join("")
                : `<tr><td colspan="4" class="empty">No duplicate candidates pending review.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderBulkImportPreview() {
  const preview = ui.bulkUpload.preview;
  if (!preview) return "";
  const candidates = Array.isArray(preview.previewCandidates) ? preview.previewCandidates : [];
  const duplicates = Array.isArray(preview.blockedDuplicates) ? preview.blockedDuplicates : [];
  const summary = preview.summary || {};
  return `
    <section class="panel import-preview-panel">
      <div class="candidate-list-head">
        <div><p class="panel-kicker">Safe import preview</p><h2 class="panel-title">Review before saving</h2><p class="panel-subtitle">Recognized columns are mapped to ATS fields. Nothing below has been written to the database yet.</p></div>
        <div class="table-actions"><button class="tool-btn" type="button" data-action="cancel-bulk-import">Cancel</button><button class="tool-btn primary" type="button" data-action="confirm-bulk-import" ${candidates.length ? "" : "disabled"}>Import ${candidates.length} candidate(s)</button></div>
      </div>
      <div class="metrics-grid">
        ${metricCard("Files checked", Number(summary.totalFiles || 0))}
        ${metricCard("Ready to add", candidates.length)}
        ${metricCard("Duplicates blocked", Number(summary.duplicateCandidates || duplicates.length))}
        ${metricCard("Errors", Number(summary.failed || 0))}
      </div>
      <div class="table-wrap">
        <table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Experience</th><th>Location</th><th>Skills</th></tr></thead>
        <tbody>${candidates.length ? candidates.slice(0, 50).map((candidate) => `<tr><td>${escapeHtml(candidate.name || "-")}</td><td>${escapeHtml(candidate.email || "-")}</td><td>${escapeHtml(candidate.phone || "-")}</td><td>${escapeHtml(candidate.currentRole || "-")}</td><td>${candidate.experienceYears ?? "-"}</td><td>${escapeHtml(candidate.location || "-")}</td><td>${escapeHtml((candidate.skills || []).join(", ") || "-")}</td></tr>`).join("") : `<tr><td colspan="7" class="empty">No new rows are ready to import.</td></tr>`}</tbody></table>
      </div>
      ${duplicates.length ? `<details><summary>${duplicates.length} duplicate row(s) will stay unchanged</summary><ul class="bulk-tips">${duplicates.slice(0, 20).map((item) => `<li>${escapeHtml(item.name || "Unknown")}: ${escapeHtml(item.reason || "Existing email or phone")}</li>`).join("")}</ul></details>` : ""}
    </section>`;
}

function renderUsersSection() {
  const users = filteredUsers();
  const activeUsers = users.filter((item) => normalizeUserStatus(item.status) === "Active").length;
  const inactiveUsers = users.filter((item) => normalizeUserStatus(item.status) === "Inactive").length;
  const archivedUsers = users.filter((item) => normalizeUserStatus(item.status) === "Archived").length;
  const recruiters = users.filter((item) => item.role === "Recruiter").length;
  const admins = users.filter((item) => USER_CREATOR_ROLES.has(item.role)).length;
  const canManageUsers = canCurrentUserManageUsers();
  const currentUser = getCurrentUser();
  const selectedUser = findById(state.users, ui.users.selectedId);

  return `
    <section class="panel">
      <div class="metrics-grid">
        ${metricCard("Total Users", users.length)}
        ${metricCard("Active Users", activeUsers)}
        ${metricCard("Inactive", inactiveUsers)}
        ${metricCard("Archived", archivedUsers)}
        ${metricCard("Recruiters", recruiters)}
        ${metricCard("Founder Access", admins)}
      </div>
    </section>

    <section class="panel">
      <div class="section-head-row">
        <div>
          <h2 class="panel-title">Team Users</h2>
          <p class="panel-subtitle">${
            canManageUsers
              ? "Create accounts, edit access, reset passwords, and archive users without losing audit history."
              : "Only CEO and Managing Director can create users or change user access."
          }</p>
        </div>
        <div class="access-chip">Current access: ${escapeHtml(currentUser ? currentUser.role : "None")}</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Contact</th>
              <th>Role</th>
              <th>Team</th>
              <th>Manager</th>
              <th>Candidate Target</th>
              <th>Revenue Target</th>
              <th>Status</th>
              <th>Password</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.length
              ? users
                  .map((user) => {
                    const isSelected = user.id === ui.users.selectedId;
                    const status = normalizeUserStatus(user.status);
                    const phone = String(user.phone || "").trim();
                    const environmentManaged = isEnvironmentManagedUser(user);
                    return `
                      <tr class="${isSelected ? "is-selected-row" : ""}">
                        <td>${escapeHtml(user.name)}</td>
                        <td>${escapeHtml(user.email)}${phone ? `<br />${escapeHtml(phone)}` : ""}</td>
                        <td>${statusBadge(user.role)}</td>
                        <td>${escapeHtml(user.team || "Unassigned")}</td>
                        <td>${escapeHtml(user.manager || "-")}</td>
                        <td>${Number(user.monthlyTarget || 0) || "-"}</td>
                        <td>${formatCurrency(user.revenueTarget || 0)}</td>
                        <td>${statusBadge(status)}</td>
                        <td>${environmentManaged ? "Server managed" : user.passwordConfigured ? `Set<br /><span class="muted-small">${escapeHtml(formatShortDate(user.passwordSetAt || user.updatedAt || ""))}</span>` : "Not set"}</td>
                        <td>${escapeHtml(user.createdAt)}</td>
                        <td>
                          <div class="table-actions">
                            <button class="tool-btn" type="button" data-action="open-user-editor" data-user-id="${user.id}" ${
                              !canManageUsers || environmentManaged ? "disabled" : ""
                            }>
                              Manage
                            </button>
                            <button class="tool-btn" type="button" data-action="toggle-user-status" data-user-id="${user.id}" ${
                              !canManageUsers || environmentManaged || status === "Archived" ? "disabled" : ""
                            }>
                              ${status === "Active" ? "Deactivate" : "Activate"}
                            </button>
                            <button class="tool-btn danger" type="button" data-action="delete-user" data-user-id="${user.id}" ${
                              status === "Archived" || !canManageUsers || environmentManaged ? "disabled" : ""
                            }>
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  })
                  .join("")
              : `<tr><td colspan="11" class="empty">No users found. Click Add User to create a login account.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>

    ${canManageUsers ? renderUserManagementPanel(selectedUser) : ""}
  `;
}

function renderUserManagementPanel(user) {
  if (!user || !ui.users.editDraft) {
    return `
      <section class="panel">
        <h2 class="panel-title">User Management</h2>
        <p class="panel-subtitle">Select Manage on any user row to edit profile, role, targets, status, or reset password.</p>
      </section>
    `;
  }

  const draft = ui.users.editDraft;
  const isFounderUser = FOUNDER_ROLES.has(normalizeUserRole(user.role));
  const status = normalizeUserStatus(user.status);

  return `
    <section class="panel user-management-panel">
      <div class="section-head-row">
        <div>
          <h2 class="panel-title">Manage User</h2>
          <p class="panel-subtitle">Editing ${escapeHtml(user.name)}. Founder accounts are protected so the workspace never loses CEO/MD access.</p>
        </div>
        <button class="tool-btn" type="button" data-action="close-user-editor">Close</button>
      </div>

      <div class="user-management-grid">
        <article class="user-edit-card">
          <h3>Profile & Access</h3>
          <div class="dialog-fields">
            ${userTextField("Full Name", "name", draft.name)}
            ${userTextField("Agodly Email", "email", draft.email, "email")}
            ${userTextField("Phone", "phone", draft.phone)}
            ${userSelectField("Role", "role", draft.role, USER_ROLE_OPTIONS)}
            ${userSelectField("Status", "status", draft.status, ["Active", "Inactive", "Archived"])}
            ${userTextField("Team", "team", draft.team)}
            ${userTextField("Manager", "manager", draft.manager)}
            ${userTextField("Monthly Candidate Target", "monthlyTarget", draft.monthlyTarget, "number")}
            ${userTextField("Monthly Revenue Target (INR)", "revenueTarget", draft.revenueTarget, "number")}
          </div>
          <div class="dialog-actions">
            <button class="tool-btn" type="button" data-action="close-user-editor">Cancel</button>
            <button class="tool-btn primary" type="button" data-action="save-user-profile">Save User</button>
          </div>
        </article>

        <article class="user-edit-card">
          <h3>Password Reset</h3>
          <p class="panel-subtitle">Set a temporary password and ask the user to change it after login.</p>
          <div class="dialog-field">
            <label for="userResetPassword">New Password</label>
            <input
              id="userResetPassword"
              type="password"
              minlength="8"
              autocomplete="new-password"
              placeholder="Minimum 8 characters"
              data-action="user-reset-password"
              value="${escapeHtml(ui.users.resetPassword)}"
            />
          </div>
          <div class="user-security-list">
            <p><strong>Email domain:</strong> ${isAgodlyCompanyEmail(user.email) ? "Valid @agodly.com" : "Needs @agodly.com"}</p>
            <p><strong>Password:</strong> ${isEnvironmentManagedUser(user) ? "Managed through server environment" : user.passwordConfigured ? "Password set" : "Password not set"}</p>
            <p><strong>Access status:</strong> ${escapeHtml(status)}</p>
            <p><strong>Founder protected:</strong> ${isFounderUser ? "Yes" : "No"}</p>
          </div>
          <div class="dialog-actions">
            <button class="tool-btn primary" type="button" data-action="reset-user-password">Reset Password</button>
          </div>
        </article>
      </div>
    </section>
  `;
}

function userTextField(label, field, value, type = "text") {
  return `
    <div class="dialog-field">
      <label for="user_${field}">${escapeHtml(label)}</label>
      <input id="user_${field}" type="${escapeHtml(type)}" data-action="user-profile-field" data-field="${escapeHtml(field)}" value="${escapeHtml(value ?? "")}" />
    </div>
  `;
}

function userSelectField(label, field, value, options) {
  return `
    <div class="dialog-field">
      <label for="user_${field}">${escapeHtml(label)}</label>
      <select id="user_${field}" data-action="user-profile-field" data-field="${escapeHtml(field)}">
        ${options.map((option) => `<option value="${escapeHtml(option)}" ${String(value) === option ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </div>
  `;
}

function renderTeamDashboardSection() {
  const rows = getRecruiterPerformanceRows();
  const teams = getTeamPerformanceRows(rows);
  const activeUsers = state.users.filter((item) => item.status === "Active");
  const founderUsers = activeUsers.filter((item) => FOUNDER_ROLES.has(item.role));
  const totalSubmissions = rows.reduce((acc, item) => acc + item.submitted, 0);
  const totalInterviews = rows.reduce((acc, item) => acc + item.interviews, 0);
  const totalJoined = rows.reduce((acc, item) => acc + item.joined, 0);
  const totalRevenue = rows.reduce((acc, item) => acc + item.revenue, 0);
  const totalMargin = rows.reduce((acc, item) => acc + item.margin, 0);
  const avgConversion = average(rows.map((item) => item.conversion));
  const teamChartRows = teams.map((team) => ({
    label: team.team,
    value: team.candidates,
    meta: `${team.members} member(s), ${team.joined} joined`
  }));
  const revenueChartRows = teams.map((team) => ({
    label: team.team,
    value: team.revenue,
    meta: formatCurrency(team.revenue)
  }));
  const conversionChartRows = teams.map((team) => ({
    label: team.team,
    value: team.conversion,
    meta: formatPercent(team.conversion)
  }));

  return `
    <section class="panel">
      <div class="metrics-grid">
        ${metricCard("Active Users", activeUsers.length)}
        ${metricCard("Recruiting Members", rows.length)}
        ${metricCard("Submissions", totalSubmissions)}
        ${metricCard("Interviews", totalInterviews)}
        ${metricCard("Joined", totalJoined)}
        ${metricCard("Margin", formatCurrency(totalMargin))}
      </div>
    </section>

    <section class="panel founder-panel">
      <div>
        <p class="panel-kicker">Founder Access</p>
        <h2 class="panel-title">CEO and Managing Director have 100% workspace access</h2>
        <p class="panel-subtitle">Founder roles can view and manage recruiting, operations, finance, users, exports, deleted records, and all performance dashboards.</p>
      </div>
      <div class="founder-access-grid">
        ${donutMetric("Founder Users", founderUsers.length, activeUsers.length || 1, "blue")}
        ${donutMetric("Data Scope", 100, 100, "green", "100%")}
        ${donutMetric("Finance + Ops", 100, 100, "yellow", "Full")}
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Team Command Center</h2>
      <p class="panel-subtitle">Graphical view of team workload, conversion quality, and revenue contribution</p>
      <div class="graph-grid">
        ${horizontalChart("Candidate Load", "Candidates owned by each team", teamChartRows)}
        ${horizontalChart("Revenue Impact", "Placement revenue by team", revenueChartRows, formatCurrency)}
        ${horizontalChart("Conversion Quality", `Average recruiter conversion: ${formatPercent(avgConversion)}`, conversionChartRows, formatPercent, 100)}
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Team Performance</h2>
      <p class="panel-subtitle">Team-wise output across candidates, submissions, interviews, joins and revenue</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Team</th>
              <th>Members</th>
              <th>Candidates</th>
              <th>Submitted</th>
              <th>Interviews</th>
              <th>Joined</th>
              <th>Conversion</th>
              <th>Revenue</th>
              <th>Margin</th>
            </tr>
          </thead>
          <tbody>
            ${teams.length
              ? teams
                  .map(
                    (team) => `
                      <tr>
                        <td><strong>${escapeHtml(team.team)}</strong></td>
                        <td>${team.members}</td>
                        <td>${team.candidates}</td>
                        <td>${team.submitted}</td>
                        <td>${team.interviews}</td>
                        <td>${team.joined}</td>
                        <td>${formatPercent(team.conversion)}</td>
                        <td>${formatCurrency(team.revenue)}</td>
                        <td>${formatCurrency(team.margin)}<br /><span class="muted-cell">${formatPercent(team.marginPercent)}</span></td>
                      </tr>
                    `
                  )
                  .join("")
              : `<tr><td colspan="9" class="empty">No team performance data available.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Access Categories</h2>
      <p class="panel-subtitle">Two-category access model for Agodly ATS production control</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Category</th>
              <th>Users</th>
              <th>Allowed Scope</th>
              <th>Key Controls</th>
            </tr>
          </thead>
          <tbody>
            ${getAccessControlRows()
              .map(
                (row) => `
                  <tr>
                    <td>${statusBadge(row.role)}</td>
                    <td>${row.count}</td>
                    <td>${escapeHtml(row.scope)}</td>
                    <td>${escapeHtml(row.controls)}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Tracking Coverage</h2>
      <div class="insight-grid">
        <article class="insight-card"><p>Activity Events</p><strong>${state.activities.length}</strong></article>
        <article class="insight-card"><p>Latest Event</p><strong>${escapeHtml(formatShortDate(state.activities[0]?.timestamp || ""))}</strong></article>
        <article class="insight-card"><p>Revenue Tracked</p><strong>${formatCurrency(totalRevenue)}</strong></article>
      </div>
    </section>
  `;
}

function renderRecruiterPerformanceSection() {
  const rows = getRecruiterPerformanceRows();
  const ranked = rankRecruiterPerformanceRows(rows);
  const top = ranked[0];
  const atRisk = ranked.filter((item) => item.targetAttainment < 50 && item.monthlyTarget > 0).length;
  const avgConversion = average(rows.map((item) => item.conversion));
  const avgTarget = average(rows.filter((item) => item.monthlyTarget > 0).map((item) => item.targetAttainment));
  const topScoreRows = ranked.slice(0, 8).map((item) => ({
    label: item.name,
    value: item.score,
    meta: `${item.joined} joined, ${formatPercent(item.conversion)} conversion`
  }));
  const targetRows = ranked.slice(0, 8).map((item) => ({
    label: item.name,
    value: Math.min(item.targetAttainment, 100),
    meta: `${item.candidates}/${item.monthlyTarget || "-"} target`
  }));
  const stageTotals = [
    { label: "Qualified", value: rows.reduce((acc, item) => acc + item.qualified, 0), meta: "Ready profiles" },
    { label: "Submitted", value: rows.reduce((acc, item) => acc + item.submitted, 0), meta: "Client submissions" },
    { label: "Interviews", value: rows.reduce((acc, item) => acc + item.interviews, 0), meta: "Scheduled rounds" },
    { label: "Offers", value: rows.reduce((acc, item) => acc + item.offers, 0), meta: "Offer stage" },
    { label: "Joined", value: rows.reduce((acc, item) => acc + item.joined, 0), meta: "Onboarded" }
  ];

  return `
    <section class="panel">
      <div class="metrics-grid">
        ${metricCard("Recruiters Tracked", rows.length)}
        ${metricCard("Top Performer", top ? top.name : "-")}
        ${metricCard("At Risk Targets", atRisk)}
        ${metricCard("Total Revenue", formatCurrency(rows.reduce((acc, item) => acc + item.revenue, 0)))}
        ${metricCard("Total Margin", formatCurrency(rows.reduce((acc, item) => acc + item.margin, 0)))}
        ${metricCard("Avg Conversion", formatPercent(avgConversion))}
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Performance Snapshot</h2>
      <p class="panel-subtitle">Graphical recruiter score, target attainment, and funnel movement</p>
      <div class="graph-grid">
        ${horizontalChart("Score Leaderboard", "Weighted by candidates, submissions, interviews, joins and revenue", topScoreRows)}
        ${horizontalChart("Target Attainment", `Average target attainment: ${formatPercent(avgTarget)}`, targetRows, formatPercent, 100)}
        ${horizontalChart("Team Funnel Output", "Total movement across recruiter-owned candidates", stageTotals)}
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Recruiter Performance</h2>
      <p class="panel-subtitle">Output, conversion, pipeline quality and target attainment by recruiter</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Recruiter</th>
              <th>Team</th>
              <th>Candidates</th>
              <th>Qualified</th>
              <th>Submitted</th>
              <th>Interviews</th>
              <th>Offers</th>
              <th>Joined</th>
              <th>Conversion</th>
              <th>Target</th>
              <th>Revenue Target</th>
              <th>Revenue</th>
              <th>Margin</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            ${ranked.length
              ? ranked
                  .map(
                    (item, index) => `
                      <tr>
                        <td><span class="rank-pill">${index + 1}</span></td>
                        <td><strong>${escapeHtml(item.name)}</strong><br /><span class="muted-cell">${escapeHtml(item.role)}</span></td>
                        <td>${escapeHtml(item.team)}</td>
                        <td>${item.candidates}</td>
                        <td>${item.qualified}</td>
                        <td>${item.submitted}</td>
                        <td>${item.interviews}</td>
                        <td>${item.offers}</td>
                        <td>${item.joined}</td>
                        <td>${formatPercent(item.conversion)}</td>
                        <td>
                          <div class="target-cell">
                            <span>${item.candidates}/${item.monthlyTarget || "-"}</span>
                            ${progressBar(item.targetAttainment)}
                          </div>
                        </td>
                        <td>${formatCurrency(item.revenueTarget)}</td>
                        <td>${formatCurrency(item.revenue)}</td>
                        <td>${formatCurrency(item.margin)}<br /><span class="muted-cell">${formatPercent(item.marginPercent)}</span></td>
                        <td><strong>${item.score}</strong></td>
                      </tr>
                    `
                  )
                  .join("")
              : `<tr><td colspan="15" class="empty">No recruiter performance data available.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function rankRecruiterPerformanceRows(rows) {
  return [...rows].sort(
    (a, b) =>
      b.score - a.score ||
      b.joined - a.joined ||
      b.submitted - a.submitted ||
      b.targetAttainment - a.targetAttainment ||
      String(a.name || "").localeCompare(String(b.name || ""))
  );
}

function getRecruiterPerformanceRows(options = {}) {
  const includeAll = Boolean(options.includeAll);
  const currentMonthOnly = Boolean(options.currentMonthOnly);
  const ignoreSearch = Boolean(options.ignoreSearch);
  const recruitingRoles = RECRUITING_ROLES;
  const inPerformancePeriod = (value) => currentMonthOnly ? isCurrentMonth(value) : inSelectedPeriod(value);
  const activeCandidates = state.candidates.filter((item) => !isCandidateDeleted(item) && inPerformancePeriod(item.createdAt));
  const periodInterviews = state.interviews.filter((item) => inPerformancePeriod(item.scheduledAt));
  const periodPlacements = state.placements.filter((item) => inPerformancePeriod(item.date));
  const recruitingUsers = state.users.filter((user) => recruitingRoles.has(user.role));
  const usersByIdentity = new Map();
  const participants = new Map();

  recruitingUsers.forEach((user) => {
    [user.name, user.email].map(normalizePersonKey).filter(Boolean).forEach((key) => usersByIdentity.set(key, user));
  });

  const addParticipant = (identity, userHint = null) => {
    const identityKey = normalizePersonKey(identity);
    if (!identityKey && !userHint) return;
    const user = userHint || usersByIdentity.get(identityKey) || null;
    if (!user && ["bulk upload", "unassigned", "unknown user", "system"].includes(identityKey)) return;
    const canonicalIdentity = user?.id || normalizePersonKey(user?.email) || normalizePersonKey(user?.name) || identityKey;
    const participantKey = `recruiter:${canonicalIdentity}`;
    const participant = participants.get(participantKey) || {
      name: user?.name || String(identity || "Unassigned"),
      user: user || {},
      aliases: new Set()
    };

    [identity, user?.name, user?.email].map(normalizePersonKey).filter(Boolean).forEach((key) => participant.aliases.add(key));
    participants.set(participantKey, participant);
  };

  recruitingUsers.forEach((user) => addParticipant(user.name || user.email, user));
  activeCandidates.forEach((candidate) => addParticipant(candidate.recruiter));
  periodPlacements.forEach((placement) => addParticipant(placement.recruiter));

  return Array.from(participants.values())
    .map((participant) => {
      const user = participant.user || {};
      const name = participant.name;
      const candidates = activeCandidates.filter((candidate) => participant.aliases.has(normalizePersonKey(candidate.recruiter)));
      const candidateIds = new Set(candidates.map((candidate) => candidate.id));
      const interviews = periodInterviews.filter((interview) => candidateIds.has(interview.candidateId));
      const placements = periodPlacements.filter((placement) => participant.aliases.has(normalizePersonKey(placement.recruiter)));
      const joinedCandidateIds = new Set([
        ...candidates.filter((candidate) => candidate.stage === "Onboarded").map((candidate) => candidate.id),
        ...placements.map((placement) => placement.candidateId).filter(Boolean)
      ]);
      const qualified = candidates.filter((candidate) => candidateHasReachedStage(candidate, "Qualified")).length;
      const submitted = candidates.filter((candidate) => candidateHasReachedStage(candidate, "Submitted")).length;
      const offers = candidates.filter((candidate) => ["Offer", "Onboarded"].includes(candidate.stage)).length;
      const joined = joinedCandidateIds.size;
      const dropped = candidates.filter((candidate) => candidate.stage === "Dropped").length;
      const revenue = placements.reduce((acc, placement) => acc + Number(placement.revenue || 0), 0);
      const cost = placements.reduce((acc, placement) => acc + calculatePlacementCost(placement), 0);
      const margin = revenue - cost;
      const monthlyTarget = normalizeMonthlyTarget(user.monthlyTarget, user.role || "Recruiter");
      const revenueTarget = normalizeRevenueTarget(user.revenueTarget);
      const conversion = candidates.length ? Math.round((joined / candidates.length) * 100) : 0;
      const targetAttainment = monthlyTarget ? Math.round((candidates.length / monthlyTarget) * 100) : 0;
      const revenueAttainment = revenueTarget ? Math.round((revenue / revenueTarget) * 100) : 0;
      const marginPercent = revenue ? Math.round((margin / revenue) * 100) : 0;
      const score = Math.max(
        0,
        Math.round(
          candidates.length * 1.2 +
            qualified * 2 +
            submitted * 4 +
            interviews.length * 5 +
            offers * 9 +
            joined * 18 +
            revenue / 25000 -
            Math.max(0, -margin) / 25000 -
            dropped * 3
        )
      );

      return {
        userId: user.id || "",
        name,
        role: user.role || "Recruiter",
        team: user.team || "Unassigned",
        manager: user.manager || "-",
        monthlyTarget,
        revenueTarget,
        candidates: candidates.length,
        qualified,
        submitted,
        interviews: interviews.length,
        offers,
        joined,
        dropped,
        activePipeline: candidates.filter((candidate) => !PIPELINE_INACTIVE_STAGES.has(candidate.stage)).length,
        revenue,
        cost,
        margin,
        marginPercent,
        conversion,
        targetAttainment,
        revenueAttainment,
        score
      };
    })
    .filter((row) => includeAll || canCurrentUserManageTaRow(row))
    .filter((row) => ignoreSearch || matchesSearch(`${row.name} ${row.role} ${row.team} ${row.manager}`));
}

function getTeamPerformanceRows(recruiterRows) {
  const byTeam = new Map();

  recruiterRows.forEach((row) => {
    const teamName = row.team || "Unassigned";
    const current =
      byTeam.get(teamName) || {
        team: teamName,
        members: 0,
        candidates: 0,
        submitted: 0,
        interviews: 0,
        joined: 0,
        revenue: 0,
        cost: 0,
        margin: 0
      };

    current.members += 1;
    current.candidates += row.candidates;
    current.submitted += row.submitted;
    current.interviews += row.interviews;
    current.joined += row.joined;
    current.revenue += row.revenue;
    current.cost += row.cost;
    current.margin += row.margin;
    byTeam.set(teamName, current);
  });

  return Array.from(byTeam.values())
    .map((team) => ({
      ...team,
      conversion: team.candidates ? Math.round((team.joined / team.candidates) * 100) : 0,
      marginPercent: team.revenue ? Math.round((team.margin / team.revenue) * 100) : 0
    }))
    .sort((a, b) => b.revenue - a.revenue || b.joined - a.joined || b.submitted - a.submitted);
}

function getOnboardedRevenueRows() {
  return state.candidates
    .filter((candidate) => !isCandidateDeleted(candidate) && candidate.stage === "Onboarded")
    .filter((candidate) => canCurrentUserAccessCandidate(candidate))
    .map((candidate) => {
      const placement = findPlacementForCandidate(candidate.id);
      const job = findById(state.jobs, placement?.jobId || candidate.jobId);
      const revenue = Number(placement?.revenue || 0);
      const cost = calculatePlacementCost(placement);
      const margin = revenue - cost;

      return {
        candidateId: candidate.id,
        candidateName: candidate.name,
        recruiter: placement?.recruiter || candidate.recruiter || "Unassigned",
        jobId: placement?.jobId || candidate.jobId || "",
        jobTitle: job?.title || candidate.jobId || "Unassigned",
        date: placement?.date || todayISO(),
        revenue,
        cost,
        margin,
        marginPercent: revenue ? Math.round((margin / revenue) * 100) : 0
      };
    })
    .filter((row) => inSelectedPeriod(row.date) && matchesSearch(`${row.candidateName} ${row.recruiter} ${row.jobTitle}`))
    .sort((a, b) => b.date.localeCompare(a.date) || a.candidateName.localeCompare(b.candidateName));
}

function findPlacementForCandidate(candidateId) {
  return state.placements.find((placement) => String(placement.candidateId) === String(candidateId));
}

function calculatePlacementCost(placement) {
  if (!placement) return 0;
  const explicitCost = Number(placement.cost || 0);
  if (Number.isFinite(explicitCost) && explicitCost > 0) return explicitCost;

  const revenue = Number(placement.revenue || 0);
  const explicitMargin = Number(placement.margin);
  if (Number.isFinite(explicitMargin)) return Math.max(0, revenue - explicitMargin);
  return 0;
}

function calculatePlacementMargin(placement) {
  if (!placement) return 0;
  const revenue = Number(placement.revenue || 0);
  const explicitMargin = Number(placement.margin);
  if (Number.isFinite(explicitMargin)) return explicitMargin;
  return revenue - calculatePlacementCost(placement);
}

function canCurrentUserManageTaRow(row) {
  if (canCurrentUserAccessFounderWorkspace()) return true;
  return canCurrentUserManageTaName(row?.name);
}

function canCurrentUserManageTaName(name) {
  const user = getCurrentUser();
  if (!user) return false;
  if (canUserAccessFounderWorkspace(user)) return true;

  const targetKey = normalizePersonKey(name);
  return Boolean(targetKey && (targetKey === normalizePersonKey(user.name) || targetKey === normalizePersonKey(user.email)));
}

function saveTaTargetRow(userId) {
  const user = findById(state.users, userId);
  if (!user) return;

  const row = { userId: user.id, name: user.name };
  if (!canCurrentUserManageTaRow(row)) {
    alert("You can update only your own target. CEO and Managing Director can update all TA targets.");
    return;
  }

  const monthlyTargetInput = findDashboardInput("monthlyTarget", user.id);
  const revenueTargetInput = findDashboardInput("revenueTarget", user.id);
  const monthlyTarget = normalizeMonthlyTarget(monthlyTargetInput?.value, user.role);
  const revenueTarget = normalizeRevenueTarget(revenueTargetInput?.value);

  user.monthlyTarget = monthlyTarget;
  user.revenueTarget = revenueTarget;
  recordActivity("targets", `Target updated for ${user.name}: ${monthlyTarget} candidates, ${formatCurrency(revenueTarget)} revenue`);
  saveAndRender();
}

function savePlacementFinanceRow(candidateId) {
  const candidate = findById(state.candidates, candidateId);
  if (!candidate) return;

  if (!canCurrentUserManageTaName(candidate.recruiter)) {
    alert("You can update only your own onboarded revenue. CEO and Managing Director can update all TA finance rows.");
    return;
  }

  const revenueInput = findFinanceInput("revenue", candidate.id);
  const costInput = findFinanceInput("cost", candidate.id);
  const revenue = normalizeMoneyValue(revenueInput?.value);
  const cost = normalizeMoneyValue(costInput?.value);
  const margin = revenue - cost;
  let placement = findPlacementForCandidate(candidate.id);

  if (!placement) {
    placement = {
      id: uid("plc"),
      candidateId: candidate.id,
      jobId: candidate.jobId || "",
      recruiter: candidate.recruiter || getCurrentUser()?.name || "Unassigned",
      revenue: 0,
      cost: 0,
      margin: 0,
      date: todayISO()
    };
    state.placements.push(placement);
  }

  placement.jobId = placement.jobId || candidate.jobId || "";
  placement.recruiter = candidate.recruiter || placement.recruiter || "Unassigned";
  placement.revenue = revenue;
  placement.cost = cost;
  placement.margin = margin;
  placement.date = placement.date || todayISO();
  candidate.stage = "Onboarded";

  recordActivity("revenue", `Revenue updated for ${candidate.name}: ${formatCurrency(revenue)}, margin ${formatCurrency(margin)}`);
  saveAndRender();
}

function findDashboardInput(field, userId) {
  return Array.from(el.sectionContainer.querySelectorAll("[data-tracker-field]")).find(
    (input) => input.dataset.trackerField === field && input.dataset.userId === userId
  );
}

function findFinanceInput(field, candidateId) {
  return Array.from(el.sectionContainer.querySelectorAll("[data-finance-field]")).find(
    (input) => input.dataset.financeField === field && input.dataset.candidateId === candidateId
  );
}

function normalizeMoneyValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function getClosureTrackerMetrics(candidates) {
  const visibleCandidates = Array.isArray(candidates) ? candidates.filter((candidate) => !isCandidateDeleted(candidate)) : [];
  const closureRows = CLOSURE_TYPE_OPTIONS.map((type) => {
    const rows = visibleCandidates.filter((candidate) => candidate.stage === "Onboarded" && normalizeClosureType(candidate.closureType) === type);
    const ytdRows = rows.filter((candidate) => isCurrentYear(getCandidateClosureDate(candidate)));
    const mtdRows = rows.filter((candidate) => isCurrentMonth(getCandidateClosureDate(candidate)));

    return {
      type,
      ytd: ytdRows.length,
      mtd: mtdRows.length,
      revenue: ytdRows.reduce((acc, candidate) => acc + Number(findPlacementForCandidate(candidate.id)?.revenue || 0), 0),
      margin: ytdRows.reduce((acc, candidate) => acc + calculatePlacementMargin(findPlacementForCandidate(candidate.id)), 0)
    };
  });

  const screenedYtd = visibleCandidates.filter((candidate) => isCurrentYear(getCandidateTrackingDate(candidate, "screened"))).length;
  const submittedYtd = visibleCandidates.filter((candidate) => isCurrentYear(getCandidateTrackingDate(candidate, "submitted"))).length;
  const rejectedYtd = visibleCandidates.filter((candidate) => isCurrentYear(getCandidateTrackingDate(candidate, "rejected"))).length;
  const screenedMtd = visibleCandidates.filter((candidate) => isCurrentMonth(getCandidateTrackingDate(candidate, "screened"))).length;
  const submittedMtd = visibleCandidates.filter((candidate) => isCurrentMonth(getCandidateTrackingDate(candidate, "submitted"))).length;
  const rejectedMtd = visibleCandidates.filter((candidate) => isCurrentMonth(getCandidateTrackingDate(candidate, "rejected"))).length;
  const ratings = visibleCandidates.map((candidate) => normalizeCandidateTracking(candidate));
  const technicalRatings = ratings.map((item) => item.technicalRating).filter((item) => item != null);
  const communicationRatings = ratings.map((item) => item.communicationRating).filter((item) => item != null);
  const overallRatings = ratings.map((item) => item.overallRating).filter((item) => item != null);

  return {
    byType: closureRows,
    ytdClosures: closureRows.reduce((acc, item) => acc + item.ytd, 0),
    mtdClosures: closureRows.reduce((acc, item) => acc + item.mtd, 0),
    ytdScreened: screenedYtd,
    ytdSubmitted: submittedYtd,
    ytdRejected: rejectedYtd,
    mtdScreened: screenedMtd,
    mtdSubmitted: submittedMtd,
    mtdRejected: rejectedMtd,
    avgTechnicalRating: average(technicalRatings),
    avgCommunicationRating: average(communicationRatings),
    avgOverallRating: average(overallRatings),
    ratingRows: [
      { label: "Technical", value: average(technicalRatings), meta: `${technicalRatings.length} rated` },
      { label: "Communication", value: average(communicationRatings), meta: `${communicationRatings.length} rated` },
      { label: "Overall", value: average(overallRatings), meta: `${overallRatings.length} rated` }
    ],
    stageSteps: PIPELINE_STAGES.map((stage) => ({
      label: stage,
      value: visibleCandidates.filter((candidate) => candidate.stage === stage).length,
      meta: `${formatPercent(getStepConversion(visibleCandidates, stage))} of active pool`
    }))
  };
}

function getStepConversion(candidates, stage) {
  const total = Math.max(Array.isArray(candidates) ? candidates.length : 0, 1);
  const count = candidates.filter((candidate) => candidate.stage === stage).length;
  return (count / total) * 100;
}

function getCandidateClosureDate(candidate) {
  const placement = findPlacementForCandidate(candidate?.id);
  return placement?.date || candidate?.onboardedAt || candidate?.updatedAt || candidate?.createdAt || "";
}

function getCandidateTrackingDate(candidate, type) {
  const tracking = normalizeCandidateTracking(candidate);
  if (type === "screened") {
    if (tracking.screenedAt) return tracking.screenedAt;
    return candidateHasReachedStage(candidate, "Qualified") ? candidate?.createdAt || "" : "";
  }
  if (type === "submitted") {
    if (tracking.submittedAt) return tracking.submittedAt;
    return candidateHasReachedStage(candidate, "Submitted") ? candidate?.createdAt || "" : "";
  }
  if (type === "rejected") {
    if (tracking.rejectedAt) return tracking.rejectedAt;
    return candidate?.stage === "Dropped" ? candidate?.updatedAt || candidate?.createdAt || "" : "";
  }
  return "";
}

function normalizeCandidateTracking(candidate) {
  const input = candidate || {};
  const parsedTracking = getParsedTracking(input);
  const merged = { ...parsedTracking, ...input };
  const stage = PIPELINE_STAGES.includes(input.stage) ? input.stage : "Identified";

  return {
    closureType: normalizeClosureType(merged.closureType || inferClosureTypeFromJob(input.jobId)),
    trackingStatus: normalizeTrackingStatus(merged.trackingStatus, stage),
    screenedAt: normalizeDateOnly(merged.screenedAt),
    submittedAt: normalizeDateOnly(merged.submittedAt),
    rejectedAt: normalizeDateOnly(merged.rejectedAt),
    rejectionReason: sanitizeLine(merged.rejectionReason || "", 160),
    nextStep: sanitizeLine(merged.nextStep || "", 160),
    nextStepDate: normalizeDateOnly(merged.nextStepDate),
    technicalRating: normalizeRating(merged.technicalRating),
    communicationRating: normalizeRating(merged.communicationRating),
    overallRating: normalizeRating(merged.overallRating),
    ratingNotes: sanitizeLine(merged.ratingNotes || "", 240)
  };
}

function getCandidateLinkedIn(candidate) {
  const input = candidate || {};
  const parsedData = input.parsedData && typeof input.parsedData === "object" && !Array.isArray(input.parsedData) ? input.parsedData : {};
  return normalizeLinkedInUrl(input.linkedin || parsedData.linkedin || parsedData.linkedIn || parsedData.linkedinUrl || "");
}

function normalizeLinkedInUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    if (!url.hostname.toLowerCase().includes("linkedin.com")) return "";
    return url.toString();
  } catch {
    return "";
  }
}

function getCandidateResumeMeta(candidate) {
  const input = candidate || {};
  const parsedData = input.parsedData && typeof input.parsedData === "object" && !Array.isArray(input.parsedData) ? input.parsedData : {};
  const originalResume =
    parsedData.originalResume && typeof parsedData.originalResume === "object" && !Array.isArray(parsedData.originalResume)
      ? parsedData.originalResume
      : {};
  const fileName = String(originalResume.fileName || deriveResumeFileNameFromSource(input.source) || "").trim();
  const resumeUrl = String(originalResume.resumeUrl || input.resumeUrl || "").trim();
  const fileType = String(originalResume.fileType || getFileExtension(fileName || resumeUrl).toUpperCase() || "").trim();

  return {
    fileName,
    fileType,
    resumeUrl,
    sizeBytes: Number(originalResume.sizeBytes || 0) || 0
  };
}

function getCandidateResumeExtraction(candidate) {
  const parsedData = candidate?.parsedData;
  if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) return null;
  const extraction = parsedData.resumeExtraction;
  return extraction && typeof extraction === "object" && !Array.isArray(extraction) ? extraction : null;
}

function getCandidateResumeVersions(candidate) {
  const parsedData = candidate?.parsedData;
  if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) return [];
  return Array.isArray(parsedData.resumeVersions)
    ? parsedData.resumeVersions.filter((item) => item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function getCandidateImportSource(candidate) {
  const parsedData = candidate?.parsedData;
  if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) return null;
  const uploadType = String(parsedData.uploadFileType || "").toUpperCase();
  const source = String(candidate?.source || "");
  if (!["CSV", "XLSX"].includes(uploadType) && !/^(CSV|Excel) Upload \(/i.test(source)) return null;
  const sourceMatch = source.match(/^(?:CSV|Excel) Upload \((.+)\)$/i);
  return { fileName: String(parsedData.uploadFileName || sourceMatch?.[1] || "Spreadsheet import") };
}

function renderResumeExtraction(extraction) {
  if (!extraction) {
    return `<section class="resume-extraction-card"><h4>CV Summary</h4><p class="panel-subtitle">No CV extraction is available. Manual candidate fields remain unchanged.</p></section>`;
  }
  const list = (value) => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);
  const skills = list(extraction.skills);
  const employment = list(extraction.employment);
  const education = list(extraction.education);
  const projects = list(extraction.projects);
  const missing = list(extraction.missingInformation);
  return `
    <section class="resume-extraction-card">
      <div class="resume-extraction-head"><h4>CV Summary</h4><span>${escapeHtml(String(extraction.status || "Extracted"))}</span></div>
      <p>${escapeHtml(String(extraction.profileSummary || "No summary was extracted."))}</p>
      <div class="resume-extraction-grid">
        <div><strong>Skills</strong><span>${escapeHtml(skills.join(", ") || "Not extracted")}</span></div>
        <div><strong>Current employment</strong><span>${escapeHtml([extraction.currentRole, extraction.currentCompany].filter(Boolean).join(" at ") || "Not extracted")}</span></div>
        <div><strong>Employment history</strong><span>${escapeHtml(employment.join(", ") || "Not extracted")}</span></div>
        <div><strong>Education</strong><span>${escapeHtml(education.join(" · ") || "Not extracted")}</span></div>
        <div><strong>Projects</strong><span>${escapeHtml(projects.join(" · ") || "Not extracted")}</span></div>
        <div><strong>Missing information</strong><span>${escapeHtml(missing.join(", ") || "None identified")}</span></div>
      </div>
      <p class="resume-extraction-note">Parsed information is a suggestion. Use “Apply Parsed Data to Draft”, review it, then Save Changes.</p>
    </section>`;
}

function renderResumeVersions(versions) {
  if (!versions.length) return "";
  return `
    <details class="resume-version-card">
      <summary>CV version history (${versions.length})</summary>
      <div class="resume-version-list">
        ${versions
          .map(
            (version, index) => `<p><strong>${index === 0 ? "Current · " : ""}${escapeHtml(String(version.fileName || "CV"))}</strong><span>${escapeHtml(formatShortDate(String(version.uploadedAt || "")))} · ${escapeHtml(String(version.uploadedBy || "Unknown"))}</span></p>`
          )
          .join("")}
      </div>
    </details>`;
}

function renderResumeDiagnostics(candidate) {
  if (!canCurrentUserAccessFounderWorkspace()) return "";
  const data = candidate?.parsedData && typeof candidate.parsedData === "object" && !Array.isArray(candidate.parsedData)
    ? candidate.parsedData
    : {};
  const extraction = getCandidateResumeExtraction(candidate) || {};
  const rows = [
    ["Status", candidate?.parsingStatus || extraction.status || "Unknown"],
    ["Parser", extraction.parser || data.parser || "Unknown"],
    ["Provider", extraction.provider || data.provider || "Not reported"],
    ["Model", extraction.model || data.model || "Not reported"],
    ["Parsed", extraction.parsedAt || data.reparsedAt || data.parsedAt || "Not reported"],
    ["Retained versions", getCandidateResumeVersions(candidate).length]
  ];
  return `<details class="resume-version-card"><summary>Admin parsing diagnostics</summary><div class="resume-diagnostic-grid">${rows.map(([label, value]) => `<p><strong>${escapeHtml(String(label))}</strong><span>${escapeHtml(String(value))}</span></p>`).join("")}</div></details>`;
}

function deriveResumeFileNameFromSource(source) {
  const match = String(source || "").match(/Resume Upload \((.+)\)/i);
  return match ? String(match[1] || "").trim() : "";
}

function getCandidateResumeDownloadUrl(candidate) {
  const id = String(candidate?.id || "").trim();
  const resumeMeta = getCandidateResumeMeta(candidate);
  if (!id || !resumeMeta.resumeUrl || !ui.api.connected) return "";
  return buildApiUrl(API_ROUTES.candidateResume(id));
}

function getCandidateStageHistory(candidate) {
  const parsedData = candidate?.parsedData;
  if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) return [];
  return normalizeStageHistory(parsedData.stageHistory);
}

function normalizeStageHistory(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: String(item.id || uid("stage")),
      oldStage: PIPELINE_STAGES.includes(item.oldStage) ? item.oldStage : String(item.oldStage || ""),
      newStage: PIPELINE_STAGES.includes(item.newStage) ? item.newStage : String(item.newStage || ""),
      actorName: String(item.actorName || "System"),
      actorEmail: String(item.actorEmail || ""),
      actorRole: String(item.actorRole || ""),
      comment: String(item.comment || ""),
      source: String(item.source || "ATS"),
      timestamp: String(item.timestamp || new Date().toISOString())
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function getCandidateTimeline(candidate) {
  const parsedData = candidate?.parsedData;
  if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) return [];
  return normalizeTimelineEvents(parsedData.timeline);
}

function getCandidateCollaborationNotes(candidate) {
  const parsedData = candidate?.parsedData;
  if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) return [];
  return Array.isArray(parsedData.collaborationNotes)
    ? parsedData.collaborationNotes.filter((item) => item && typeof item === "object").sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    : [];
}

function normalizeTimelineEvents(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: String(item.id || uid("evt")),
      eventType: String(item.eventType || "Activity"),
      candidateId: String(item.candidateId || ""),
      jobId: String(item.jobId || ""),
      clientId: String(item.clientId || ""),
      vendor: String(item.vendor || ""),
      endClient: String(item.endClient || ""),
      recruiter: String(item.recruiter || ""),
      user: String(item.user || item.actorName || "System"),
      timestamp: String(item.timestamp || new Date().toISOString()),
      previousStage: String(item.previousStage || ""),
      currentStage: String(item.currentStage || ""),
      remarks: String(item.remarks || ""),
      attachments: Array.isArray(item.attachments) ? item.attachments.map(String) : []
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function getCandidateFeedbackHistory(candidate) {
  const parsedData = candidate?.parsedData;
  if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) return [];
  return normalizeFeedbackHistory(parsedData.feedbackHistory);
}

function normalizeFeedbackHistory(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      id: String(item.id || uid("fb")),
      feedbackDate: String(item.feedbackDate || todayISO()),
      feedbackType: String(item.feedbackType || "Internal"),
      feedback: String(item.feedback || ""),
      clientFeedback: String(item.clientFeedback || ""),
      dropReason: String(item.dropReason || ""),
      addedBy: String(item.addedBy || "System"),
      version: Number(item.version || 1),
      attachments: Array.isArray(item.attachments) ? item.attachments.map(String) : [],
      timestamp: String(item.timestamp || new Date().toISOString())
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function getCandidateSubmissions(candidate) {
  const parsedData = candidate?.parsedData;
  if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) return [];
  return normalizeCandidateSubmissions(parsedData.submissions);
}

function normalizeCandidateSubmissions(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      submissionId: String(item.submissionId || uid("sub")),
      clientId: String(item.clientId || ""),
      vendor: String(item.vendor || ""),
      endClient: String(item.endClient || ""),
      jobId: String(item.jobId || ""),
      submissionVersion: Number(item.submissionVersion || 1),
      cvVersion: String(item.cvVersion || "Current CV"),
      submittedBy: String(item.submittedBy || ""),
      submissionDate: String(item.submissionDate || todayISO()),
      submissionStatus: String(item.submissionStatus || "Submitted"),
      currentStage: String(item.currentStage || "Submitted"),
      interviewStatus: String(item.interviewStatus || "Not Scheduled"),
      offerStatus: String(item.offerStatus || "Not Offered"),
      joiningStatus: String(item.joiningStatus || "Not Joined"),
      billingStatus: String(item.billingStatus || "Not Started"),
      feedback: String(item.feedback || ""),
      remarks: String(item.remarks || ""),
      createdAt: String(item.createdAt || new Date().toISOString())
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function appendCandidateStageHistory(candidate, oldStage, newStage, movement = {}) {
  if (!candidate || oldStage === newStage || !PIPELINE_STAGES.includes(newStage)) return candidate;
  const parsedData =
    candidate.parsedData && typeof candidate.parsedData === "object" && !Array.isArray(candidate.parsedData)
      ? { ...candidate.parsedData }
      : {};
  const actor = getActivityActor();
  const movementDate = sanitizeLine(movement.movementDate || todayISO(), 20);
  const movementTime = sanitizeLine(movement.movementTime || new Date().toTimeString().slice(0, 5), 20);
  const timestamp = toMovementTimestamp(movementDate, movementTime);
  const attachmentName = getMovementAttachmentName(movement.attachment);
  const attachments = attachmentName ? [attachmentName] : [];
  const feedback = sanitizeLine(movement.feedback || movement.comment || "", 800);
  const reason = sanitizeLine(movement.reason || "", 240);
  parsedData.stageHistory = [
    {
      id: uid("stage"),
      oldStage: PIPELINE_STAGES.includes(oldStage) ? oldStage : "",
      newStage,
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role,
      movementDate,
      movementTime,
      clientId: sanitizeLine(movement.clientId || "", 80),
      vendor: sanitizeLine(movement.vendor || "", 120),
      endClient: sanitizeLine(movement.endClient || "", 120),
      jobId: sanitizeLine(movement.jobId || candidate.jobId || "", 80),
      recruiter: sanitizeLine(movement.recruiter || candidate.recruiter || "", 120),
      feedback,
      reason,
      nextFollowUpDate: sanitizeLine(movement.nextFollowUpDate || "", 20),
      priority: sanitizeLine(movement.priority || "Medium", 20),
      movementOwner: sanitizeLine(movement.movementOwner || actor.name, 120),
      attachments,
      comment: feedback || reason,
      source: "ATS",
      timestamp
    },
    ...getCandidateStageHistory({ parsedData })
  ].slice(0, 100);
  parsedData.feedbackHistory = [
    {
      id: uid("fb"),
      feedbackDate: movementDate,
      feedbackType:
        newStage === "Dropped"
          ? "Drop Reason"
          : newStage === "On Hold"
            ? "Hold Reason"
            : newStage === "Pool"
              ? "Pool Reason"
              : newStage === "Interview"
                ? "Interview"
                : "Internal",
      feedback,
      clientFeedback: ["Submitted", "Client Review", "Interview", "Offer"].includes(newStage) ? feedback : "",
      dropReason: newStage === "Dropped" ? reason : "",
      addedBy: actor.name,
      version: getCandidateFeedbackHistory({ parsedData }).length + 1,
      attachments,
      timestamp
    },
    ...getCandidateFeedbackHistory({ parsedData })
  ].slice(0, 200);
  parsedData.timeline = [
    {
      id: uid("evt"),
      eventType: `Stage Movement: ${oldStage} → ${newStage}`,
      candidateId: candidate.id,
      jobId: sanitizeLine(movement.jobId || candidate.jobId || "", 80),
      clientId: sanitizeLine(movement.clientId || "", 80),
      vendor: sanitizeLine(movement.vendor || "", 120),
      endClient: sanitizeLine(movement.endClient || "", 120),
      recruiter: sanitizeLine(movement.recruiter || candidate.recruiter || "", 120),
      user: actor.name,
      timestamp,
      previousStage: oldStage,
      currentStage: newStage,
      remarks: [feedback, reason].filter(Boolean).join(" | "),
      attachments
    },
    ...getCandidateTimeline({ parsedData })
  ].slice(0, 300);
  if (["Submitted", "Client Review", "Interview", "Offer", "Onboarded"].includes(newStage)) {
    const submissions = getCandidateSubmissions({ parsedData });
    const existingSubmission = submissions.find(
      (item) => String(item.jobId || "") === String(movement.jobId || candidate.jobId || "") && String(item.clientId || "") === String(movement.clientId || "")
    );
    const submissionRecord = {
      submissionId: existingSubmission?.submissionId || uid("sub"),
      clientId: sanitizeLine(movement.clientId || existingSubmission?.clientId || "", 80),
      vendor: sanitizeLine(movement.vendor || existingSubmission?.vendor || "", 120),
      endClient: sanitizeLine(movement.endClient || existingSubmission?.endClient || "", 120),
      jobId: sanitizeLine(movement.jobId || candidate.jobId || existingSubmission?.jobId || "", 80),
      submissionVersion: existingSubmission ? Number(existingSubmission.submissionVersion || 1) + 1 : submissions.length + 1,
      cvVersion: getCandidateResumeMeta(candidate).fileName || "Current CV",
      submittedBy: sanitizeLine(movement.movementOwner || actor.name, 120),
      submissionDate: newStage === "Submitted" ? movementDate : existingSubmission?.submissionDate || movementDate,
      submissionStatus: newStage === "Dropped" ? "Dropped" : "Active",
      currentStage: newStage,
      interviewStatus: newStage === "Interview" ? "Interview" : existingSubmission?.interviewStatus || "Not Scheduled",
      offerStatus: newStage === "Offer" ? "Offer" : existingSubmission?.offerStatus || "Not Offered",
      joiningStatus: newStage === "Onboarded" ? "Joined" : existingSubmission?.joiningStatus || "Not Joined",
      billingStatus: newStage === "Onboarded" ? "Pending Billing" : existingSubmission?.billingStatus || "Not Started",
      feedback,
      remarks: reason,
      createdAt: timestamp
    };
    parsedData.submissions = [
      submissionRecord,
      ...submissions.filter((item) => item.submissionId !== submissionRecord.submissionId)
    ].slice(0, 100);
  }
  parsedData.lastActivityDate = movementDate;
  parsedData.nextFollowUpDate = sanitizeLine(movement.nextFollowUpDate || "", 20);
  parsedData.priority = sanitizeLine(movement.priority || "Medium", 20);
  const updatedTracking = normalizeCandidateTracking({ ...candidate, parsedData });
  updatedTracking.trackingStatus = normalizeTrackingStatus("", newStage);
  parsedData.tracking = updatedTracking;
  candidate.trackingStatus = updatedTracking.trackingStatus;
  candidate.parsedData = parsedData;
  candidate.jobId = sanitizeLine(
    newStage === "Pool" ? movement.jobId || "" : movement.jobId || candidate.jobId || "",
    80
  ).replace("__unassigned__", "");
  candidate.recruiter = sanitizeLine(movement.recruiter || candidate.recruiter || "", 120);
  candidate.nextStepDate = parsedData.nextFollowUpDate || candidate.nextStepDate || "";
  candidate.nextStep = feedback || reason || candidate.nextStep || "";
  candidate.updatedAt = new Date().toISOString();
  return candidate;
}

function toMovementTimestamp(dateText, timeText) {
  const candidate = new Date(`${dateText || todayISO()}T${timeText || "00:00"}:00`);
  return Number.isNaN(candidate.getTime()) ? new Date().toISOString() : candidate.toISOString();
}

function getMovementAttachmentName(fileValue) {
  if (!fileValue || typeof fileValue !== "object") return "";
  return sanitizeLine(fileValue.name || "", 180);
}

function getPreviousStageContext(candidate) {
  const stageHistory = getCandidateStageHistory(candidate);
  const feedbackHistory = getCandidateFeedbackHistory(candidate);
  const latestStage = stageHistory[0] || {};
  const latestFeedback = feedbackHistory[0] || {};
  const enteredAt = latestStage.timestamp || candidate.updatedAt || candidate.createdAt;
  return {
    feedback: latestFeedback.feedback || latestStage.feedback || latestStage.comment || "",
    clientFeedback: latestFeedback.clientFeedback || "",
    nextFollowUpDate: latestStage.nextFollowUpDate || candidate.nextStepDate || getParsedTracking(candidate).nextStepDate || "",
    daysInStage: daysBetween(enteredAt, new Date().toISOString()),
    lastUpdatedBy: latestStage.actorName || latestFeedback.addedBy || candidate.recruiter || "",
    lastUpdatedDate: formatShortDate(latestStage.timestamp || latestFeedback.timestamp || candidate.updatedAt || candidate.createdAt || "")
  };
}

async function copyTextToClipboard(text, successMessage = "Copied.") {
  const value = String(text || "").trim();
  if (!value) return;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
    } else {
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "true");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    alert(successMessage);
  } catch {
    alert("Copy failed. Select the text manually and copy.");
  }
}

function getParsedTracking(candidate) {
  const parsedData = candidate?.parsedData;
  if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) return {};
  const tracking = parsedData.tracking;
  if (!tracking || typeof tracking !== "object" || Array.isArray(tracking)) return {};
  return tracking;
}

function normalizeClosureType(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text.includes("contract") || text.includes("recurring")) return "Contractual";
  return "FTE";
}

function inferClosureTypeFromJob(jobId) {
  const job = findById(state.jobs, jobId);
  return normalizeJobType(job?.jobType) === "FTE" ? "FTE" : "Contractual";
}

function normalizeTrackingStatus(value, stage = "Identified") {
  const text = String(value || "").trim().toLowerCase();
  const direct = TRACKING_STATUS_OPTIONS.find((status) => status.toLowerCase() === text);
  if (direct) return direct;
  if (stage === "On Hold") return "On Hold";
  if (stage === "Pool") return "Pool";
  if (stage === "Dropped") return "Rejected";
  if (stage === "Onboarded") return "Onboarded";
  if (stage === "Offer") return "Offer";
  if (stage === "Interview") return "Interview";
  if (stage === "Submitted") return "Submitted";
  if (stage === "Qualified") return "Screened";
  return "Not Screened";
}

function getCandidateTrackingStatus(candidate) {
  return normalizeCandidateTracking(candidate).trackingStatus;
}

function normalizeRating(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.min(Math.max(Math.round(parsed * 10) / 10, 0), 10);
}

function formatRating(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "0";
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(1);
}

function normalizeDateOnly(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function getAccessControlRows() {
  const categoryDefinitions = [
    {
      role: "CEO / Managing Director",
      roles: ["CEO", "Managing Director"],
      scope: "100% company-wide access from finance to operations",
      controls:
        "All candidates, jobs, clients, users, finance, operations, revenue, reports, exports, deleted records, and system settings"
    },
    {
      role: "Admin",
      roles: ["Admin"],
      scope: "Founder-delegated full workspace",
      controls: "Operational override access including users, imports, exports, activity logs, and deleted records"
    },
    {
      role: "TA Manager",
      roles: ["TA Manager"],
      scope: "Own team recruiting workspace",
      controls: "Team candidates, team dashboard, leaderboard, assigned jobs, pipeline, interviews, and activity review"
    },
    {
      role: "Recruiter",
      roles: ["Recruiter"],
      scope: "Assigned candidates and jobs",
      controls:
        "End-to-end recruitment handling for their candidates: upload CVs, edit profiles, move pipeline stages, run AI Match, schedule interviews, and track own performance"
    },
    {
      role: "Viewer",
      roles: ["Viewer"],
      scope: "Read-only assigned workspace",
      controls: "View assigned dashboards, candidates, jobs, pipeline, and interviews without create/edit/delete actions"
    }
  ];

  return categoryDefinitions.map((definition) => ({
    ...definition,
    count: state.users.filter((user) => definition.roles.includes(normalizeUserRole(user.role))).length
  }));
}

function quickActionButton(label, description, section) {
  return `
    <button class="quick-action-card" type="button" data-action="go-section" data-section="${escapeHtml(section)}">
      <strong>${escapeHtml(label)}</strong>
      <span>${escapeHtml(description)}</span>
    </button>
  `;
}

function operationsCard(item) {
  return `
    <button class="ops-card ${escapeHtml(item.tone || "blue")}" type="button" data-action="go-section" data-section="${escapeHtml(
      item.section || "dashboard"
    )}">
      <span>${escapeHtml(item.label)}</span>
      <strong>${escapeHtml(String(item.value))}</strong>
      <em>${escapeHtml(item.help || "")}</em>
    </button>
  `;
}

function getOperationalCommandCenter(candidates, jobs) {
  const isFounder = canCurrentUserAccessFounderWorkspace();
  const activeCandidates = candidates.filter((candidate) => !isCandidateDeleted(candidate));
  const failedParses = activeCandidates.filter((candidate) => candidate.parsingStatus === "FAILED").length;
  const duplicatePending = state.candidates.filter((candidate) => candidate.status === "DUPLICATE_PENDING").length;
  const staleCandidates = activeCandidates.filter((candidate) => isCandidateStale(candidate)).length;
  const openJobs = jobs.filter((job) => isJobStatusActive(job.status)).length;
  const submitted = activeCandidates.filter((candidate) => candidateHasReachedStage(candidate, "Submitted")).length;
  const interviewReady = activeCandidates.filter((candidate) => ["Qualified", "Submitted", "Interview"].includes(candidate.stage)).length;

  if (isFounder) {
    return [
      { label: "Failed CV Parses", value: failedParses, help: "Review extraction quality", section: "bulk-upload", tone: failedParses ? "red" : "green" },
      { label: "Duplicate Reviews", value: duplicatePending, help: "Merge or ignore duplicates", section: "bulk-upload", tone: duplicatePending ? "yellow" : "green" },
      { label: "Stuck Candidates", value: staleCandidates, help: "No update in 7+ days", section: "pipeline", tone: staleCandidates ? "yellow" : "green" },
      { label: "Open Jobs", value: openJobs, help: "Active hiring demand", section: "jobs", tone: "blue" },
      { label: "Revenue View", value: formatCurrency(filteredPlacements().reduce((acc, item) => acc + Number(item.revenue || 0), 0)), help: "Founder finance", section: "revenue", tone: "green" },
      { label: "Team Tracking", value: getRecruiterPerformanceRows().length, help: "Recruiter performance", section: "team-dashboard", tone: "blue" }
    ];
  }

  return [
    { label: "My Candidates", value: activeCandidates.length, help: "Assigned candidate pool", section: "candidates", tone: "blue" },
    { label: "Interview Ready", value: interviewReady, help: "Qualified/submitted/interview", section: "pipeline", tone: "yellow" },
    { label: "Submitted", value: submitted, help: "Profiles shared forward", section: "pipeline", tone: "green" },
    { label: "Needs Follow-up", value: staleCandidates, help: "No update in 7+ days", section: "candidates", tone: staleCandidates ? "red" : "green" },
    { label: "AI Match", value: "Run", help: "Paste JD and rank candidates", section: "ai-match", tone: "blue" },
    { label: "Bulk Upload", value: "CV", help: "Add resumes to your pool", section: "bulk-upload", tone: "yellow" }
  ];
}

function isCandidateStale(candidate) {
  const dateText = candidate.updatedAt || candidate.createdAt;
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return false;
  const ageMs = Date.now() - date.getTime();
  return ageMs > 7 * 24 * 60 * 60 * 1000 && !PIPELINE_INACTIVE_STAGES.has(candidate.stage);
}

function normalizePersonKey(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isAgodlyCompanyEmail(value) {
  return normalizeEmail(value).endsWith(AGODLY_EMAIL_DOMAIN);
}

function getCurrentUser() {
  if (auth.user) {
    return {
      ...auth.user,
      status: "Active"
    };
  }

  const activeUsers = state.users.filter((user) => user.status === "Active");
  const savedUserId = String(localStorage.getItem(CURRENT_USER_ID_KEY) || "").trim();
  return activeUsers.find((user) => user.id === savedUserId) || activeUsers[0] || null;
}

function canCurrentUserManageUsers() {
  const user = getCurrentUser();
  return canUserAccessFounderWorkspace(user);
}

function canCurrentUserWriteRecords() {
  const user = getCurrentUser();
  if (!user) return false;
  return !READ_ONLY_ROLES.has(normalizeUserRole(user.role));
}

function canCurrentUserAccessFounderWorkspace() {
  return canUserAccessFounderWorkspace(getCurrentUser());
}

function canUserAccessFounderWorkspace(user) {
  return Boolean(user && FOUNDER_ROLES.has(normalizeUserRole(user.role)));
}

function openCurrentUserPasswordPanel() {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    alert("Sign in before changing password.");
    return;
  }

  if (isEnvironmentManagedUser(currentUser)) {
    alert("This administrator password is managed through the server environment. Update ADMIN_PASSWORD on the server and restart the app.");
    return;
  }

  if (!canCurrentUserManageUsers()) {
    openPasswordDialog(currentUser.id);
    return;
  }

  ui.activeSection = "users";
  openUserEditor(currentUser.id);
}

function openPasswordDialog(userId) {
  const user = findById(state.users, userId);
  const currentUser = getCurrentUser();
  if (!user || !currentUser) return;

  const isOwnPassword = user.id === currentUser.id || normalizeEmail(user.email) === normalizeEmail(currentUser.email);
  if (!isOwnPassword && !canCurrentUserManageUsers()) {
    alert("Only CEO and Managing Director can reset another user's password.");
    return;
  }

  ensureRecordDialogMounted();
  el.recordDialog.dataset.entity = "password-reset";
  el.recordDialog.dataset.userId = user.id;
  el.recordDialogTitle.textContent = isOwnPassword ? "Change Password" : `Reset Password: ${user.name}`;
  el.recordFields.innerHTML = `
    <div class="dialog-field">
      <label for="dialog_passwordReset">New Password</label>
      <input id="dialog_passwordReset" name="password" type="password" minlength="8" autocomplete="new-password" placeholder="Minimum 8 characters" required />
    </div>
  `;
  el.recordDialog.showModal();
}

function openUserEditor(userId) {
  if (!canCurrentUserManageUsers()) {
    alert("Only CEO and Managing Director can manage users.");
    return;
  }

  const user = findById(state.users, userId);
  if (!user) return;
  if (isEnvironmentManagedUser(user)) {
    alert("This administrator account is managed through the server environment and cannot be edited in the portal.");
    return;
  }

  ui.users.selectedId = user.id;
  ui.users.resetPassword = "";
  ui.users.editDraft = {
    id: user.id,
    name: String(user.name || ""),
    email: normalizeEmail(user.email),
    phone: String(user.phone || ""),
    role: normalizeUserRole(user.role),
    status: normalizeUserStatus(user.status),
    team: String(user.team || "Recruiting"),
    manager: String(user.manager || ""),
    monthlyTarget: Number(user.monthlyTarget || normalizeMonthlyTarget("", user.role)),
    revenueTarget: normalizeRevenueTarget(user.revenueTarget)
  };
  render();
}

function openStageMovementDialog(candidateId, nextStage) {
  if (!canCurrentUserWriteRecords()) {
    alert("Your role can view pipeline stages but cannot move candidates.");
    renderSection();
    return;
  }

  const candidate = findCandidateByIdAnywhere(candidateId);
  const targetStage = PIPELINE_STAGES.includes(nextStage) ? nextStage : "";
  if (!candidate || !targetStage || candidate.stage === targetStage) {
    renderSection();
    return;
  }

  if (isCandidateDeleted(candidate)) {
    alert("Restore this candidate before moving pipeline stage.");
    renderSection();
    return;
  }

  ensureRecordDialogMounted();

  const now = new Date();
  const previousContext = getPreviousStageContext(candidate);
  const currentUser = getCurrentUser();
  const isPoolMovement = targetStage === "Pool";

  el.recordDialog.dataset.entity = "stage-movement";
  el.recordDialog.dataset.candidateId = candidate.id;
  el.recordDialog.dataset.nextStage = targetStage;
  el.recordDialogTitle.textContent = `Move ${candidate.name}: ${candidate.stage} → ${targetStage}`;
  el.recordFields.innerHTML = `
    ${
      targetStage === "On Hold"
        ? `<p class="movement-guidance">Use On Hold when the linked requirement is temporarily paused. Record the reason and next follow-up date so the candidate is not lost.</p>`
        : isPoolMovement
          ? `<p class="movement-guidance">Use Pool for a suitable candidate who is not attached to an active requirement. Client, job, and follow-up are optional.</p>`
          : ""
    }
    <div class="movement-context-card">
      <strong>Previous stage context</strong>
      <span>Previous Stage: ${escapeHtml(candidate.stage || "-")}</span>
      <span>Previous Feedback: ${escapeHtml(previousContext.feedback || "No previous feedback recorded")}</span>
      <span>Previous Client Feedback: ${escapeHtml(previousContext.clientFeedback || "No client feedback recorded")}</span>
      <span>Previous Follow-up: ${escapeHtml(previousContext.nextFollowUpDate || "-")}</span>
      <span>Days in Previous Stage: ${escapeHtml(String(previousContext.daysInStage))}</span>
      <span>Last Updated By: ${escapeHtml(previousContext.lastUpdatedBy || "-")}</span>
      <span>Last Updated Date: ${escapeHtml(previousContext.lastUpdatedDate || "-")}</span>
    </div>

    <div class="dialog-field">
      <label for="stage_move_date">Movement Date *</label>
      <input id="stage_move_date" name="movementDate" type="date" value="${escapeHtml(todayISO())}" required />
    </div>
    <div class="dialog-field">
      <label for="stage_move_time">Movement Time *</label>
      <input id="stage_move_time" name="movementTime" type="time" value="${escapeHtml(now.toTimeString().slice(0, 5))}" required />
    </div>
    <div class="dialog-field">
      <label for="stage_client">Client${isPoolMovement ? " (Optional)" : " *"}</label>
      <select id="stage_client" name="clientId" ${isPoolMovement ? "" : "required"}>
        <option value="">Select client</option>
        ${state.clients
          .map((client) => `<option value="${escapeHtml(client.id)}" ${candidate.jobId && findById(state.jobs, candidate.jobId)?.clientId === client.id ? "selected" : ""}>${escapeHtml(client.name)}</option>`)
          .join("")}
        <option value="__manual__">Manual / Not in system</option>
      </select>
    </div>
    <div class="dialog-field">
      <label for="stage_vendor">Vendor</label>
      <input id="stage_vendor" name="vendor" type="text" placeholder="Vendor / partner name" />
    </div>
    <div class="dialog-field">
      <label for="stage_end_client">End Client</label>
      <input id="stage_end_client" name="endClient" type="text" placeholder="End client name" />
    </div>
    <div class="dialog-field">
      <label for="stage_job">Job${isPoolMovement ? " (Optional)" : " *"}</label>
      <select id="stage_job" name="jobId" ${isPoolMovement ? "" : "required"}>
        <option value="">Select job</option>
        ${state.jobs.map((job) => `<option value="${escapeHtml(job.id)}" ${candidate.jobId === job.id ? "selected" : ""}>${escapeHtml(job.title)}</option>`).join("")}
        <option value="__unassigned__">Unassigned / manual movement</option>
      </select>
    </div>
    <div class="dialog-field">
      <label for="stage_recruiter">Recruiter *</label>
      <input id="stage_recruiter" name="recruiter" type="text" value="${escapeHtml(candidate.recruiter || currentUser?.name || "")}" required />
    </div>
    <div class="dialog-field">
      <label for="stage_previous">Previous Stage</label>
      <input id="stage_previous" name="previousStage" type="text" value="${escapeHtml(candidate.stage || "")}" readonly />
    </div>
    <div class="dialog-field">
      <label for="stage_current">Current Stage</label>
      <input id="stage_current" name="currentStage" type="text" value="${escapeHtml(targetStage)}" readonly />
    </div>
    <div class="dialog-field candidate-field-wide">
      <label for="stage_feedback">Feedback / Internal Notes *</label>
      <textarea id="stage_feedback" name="feedback" rows="4" placeholder="Mandatory feedback. Example: submitted to client, waiting for screening, L1 cleared, offer pending..." required></textarea>
    </div>
    <div class="dialog-field candidate-field-wide">
      <label for="stage_reason">Reason *</label>
      <input id="stage_reason" name="reason" type="text" placeholder="Why is this movement happening?" required />
    </div>
    <div class="dialog-field">
      <label for="stage_next_followup">Next Follow-up Date${isPoolMovement ? " (Optional)" : " *"}</label>
      <input id="stage_next_followup" name="nextFollowUpDate" type="date" ${isPoolMovement ? "" : "required"} />
    </div>
    <div class="dialog-field">
      <label for="stage_priority">Priority *</label>
      <select id="stage_priority" name="priority" required>
        <option value="Medium">Medium</option>
        <option value="High">High</option>
        <option value="Critical">Critical</option>
        <option value="Low">Low</option>
      </select>
    </div>
    <div class="dialog-field">
      <label for="stage_owner">Movement Owner *</label>
      <input id="stage_owner" name="movementOwner" type="text" value="${escapeHtml(currentUser?.name || candidate.recruiter || "Unassigned")}" required />
    </div>
    <div class="dialog-field">
      <label for="stage_attachment">Attachment</label>
      <input id="stage_attachment" name="attachment" type="file" />
    </div>
  `;
  el.recordDialog.showModal();
}

function closeUserEditor() {
  ui.users.selectedId = "";
  ui.users.editDraft = null;
  ui.users.resetPassword = "";
  renderSection();
}

async function toggleUserAccessStatus(userId) {
  if (!canCurrentUserManageUsers()) {
    alert("Only CEO and Managing Director can manage users.");
    return;
  }

  const user = findById(state.users, userId);
  if (!user) return;

  const nextStatus = normalizeUserStatus(user.status) === "Active" ? "Inactive" : "Active";
  if (wouldRemoveLastActiveFounder(user, user.role, nextStatus)) {
    alert("At least one active CEO / Managing Director account must remain.");
    return;
  }

  user.status = nextStatus;
  if (nextStatus === "Active") user.archivedAt = "";
  recordActivity("users", `User status updated: ${user.name} is now ${user.status}`);
  if (ui.users.selectedId === user.id) openUserEditor(user.id);
  await saveAndRenderSyncNow("User access updated and synced.");
}

async function archiveUserAccount(userId) {
  if (!canCurrentUserManageUsers()) {
    alert("Only CEO and Managing Director can manage users.");
    return;
  }

  const user = findById(state.users, userId);
  if (!user) return;

  if (wouldRemoveLastActiveFounder(user, user.role, "Archived")) {
    alert("Cannot archive the last active CEO / Managing Director account.");
    return;
  }

  const firstConfirm = window.confirm(`Archive ${user.name}? They will lose login access, but audit history will stay in the system.`);
  if (!firstConfirm) return;
  const secondConfirm = window.confirm("Second confirmation: archive this user account?");
  if (!secondConfirm) return;

  user.status = "Archived";
  user.archivedAt = new Date().toISOString();
  recordActivity("users", `User archived: ${user.name}`);
  if (ui.users.selectedId === user.id) closeUserEditor();
  await saveAndRenderSyncNow("User archived and synced.");
}

async function saveUserProfileEdits() {
  if (!canCurrentUserManageUsers()) {
    alert("Only CEO and Managing Director can manage users.");
    return;
  }

  const draft = ui.users.editDraft;
  if (!draft?.id) return;

  const user = findById(state.users, draft.id);
  if (!user) return;

  const email = normalizeEmail(draft.email);
  const role = normalizeUserRole(draft.role);
  const status = normalizeUserStatus(draft.status);

  if (!String(draft.name || "").trim()) {
    alert("User name is required.");
    return;
  }

  if (!isAgodlyCompanyEmail(email)) {
    alert("User email must end with @agodly.com.");
    return;
  }

  const duplicate = state.users.find((item) => item.id !== user.id && normalizeEmail(item.email) === email);
  if (duplicate) {
    alert("Another user already has this Agodly email.");
    return;
  }

  if (wouldRemoveLastActiveFounder(user, role, status)) {
    alert("At least one active CEO / Managing Director account must remain.");
    return;
  }

  user.name = sanitizeLine(draft.name, 80);
  user.email = email;
  user.phone = sanitizeLine(draft.phone, 40);
  user.role = role;
  user.status = status;
  user.team = sanitizeLine(draft.team || "Recruiting", 80) || "Recruiting";
  user.manager = sanitizeLine(draft.manager || "", 80);
  user.monthlyTarget = normalizeMonthlyTarget(draft.monthlyTarget, role);
  user.revenueTarget = normalizeRevenueTarget(draft.revenueTarget);
  user.updatedAt = new Date().toISOString();
  if (status !== "Archived") user.archivedAt = "";

  if (auth.user?.id === user.id) {
    auth.user = normalizeAuthUser(user);
    persistAuthState();
  }

  recordActivity("users", `User profile updated: ${user.name} (${user.role})`);
  openUserEditor(user.id);
  await saveAndRenderSyncNow("User profile synced.");
}

async function resetManagedUserPassword() {
  if (!canCurrentUserManageUsers()) {
    alert("Only CEO and Managing Director can reset passwords.");
    return;
  }

  const user = findById(state.users, ui.users.selectedId);
  if (!user) return;

  const password = String(ui.users.resetPassword || "");
  if (password.length < 8) {
    alert("Password must be at least 8 characters.");
    return;
  }

  delete user.passwordHash; // never store/sync a client-side hash; backend owns it
  user.passwordConfigured = true;
  user.passwordSetAt = new Date().toISOString();
  user.authProvider = "password";
  user.updatedAt = new Date().toISOString();
  ui.users.resetPassword = "";
  recordActivity("users", `Password reset for user: ${user.name}`);
  try {
    await saveAndRenderSyncNow("User synced.");
    await apiSetUserPassword(user, password);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Password could not be saved on the server.");
    return;
  }
}

async function submitPasswordDialog(data) {
  const user = findById(state.users, el.recordDialog.dataset.userId);
  const currentUser = getCurrentUser();
  if (!user || !currentUser) return;

  const isOwnPassword = user.id === currentUser.id || normalizeEmail(user.email) === normalizeEmail(currentUser.email);
  if (!isOwnPassword && !canCurrentUserManageUsers()) {
    alert("Only CEO and Managing Director can reset another user's password.");
    return;
  }

  const password = String(data.password || "");
  if (password.length < 8) {
    alert("Password must be at least 8 characters.");
    return;
  }

  delete user.passwordHash; // never store/sync a client-side hash; backend owns it
  user.passwordConfigured = true;
  user.passwordSetAt = new Date().toISOString();
  user.authProvider = "password";
  user.updatedAt = new Date().toISOString();
  recordActivity("users", `${isOwnPassword ? "Password changed" : "Password reset"} for user: ${user.name}`);
  el.recordForm?.reset();
  closeRecordDialog();
  try {
    await saveAndRenderSyncNow("User synced.");
    await apiSetUserPassword(user, password);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Password could not be saved on the server.");
  }
}

function wouldRemoveLastActiveFounder(user, nextRole, nextStatus) {
  const wasActiveFounder = user && FOUNDER_ROLES.has(normalizeUserRole(user.role)) && normalizeUserStatus(user.status) === "Active";
  if (!wasActiveFounder) return false;

  const willRemainActiveFounder = FOUNDER_ROLES.has(normalizeUserRole(nextRole)) && normalizeUserStatus(nextStatus) === "Active";
  if (willRemainActiveFounder) return false;

  return state.users.filter((item) => item.id !== user.id && FOUNDER_ROLES.has(normalizeUserRole(item.role)) && normalizeUserStatus(item.status) === "Active").length === 0;
}

function normalizeUserRole(value) {
  const role = String(value || "Recruiter").trim();
  if (role === "MD") return "Managing Director";
  if (role === "Employee" || role === "Sourcer" || role === "Interviewer" || role === "Operations" || role === "Finance") return "Recruiter";
  return USER_ROLE_OPTIONS.includes(role) ? role : "Recruiter";
}

function normalizeUserStatus(value) {
  const status = String(value || "Active").trim();
  if (status === "Inactive") return "Inactive";
  if (status === "Archived") return "Archived";
  return "Active";
}

function isEnvironmentManagedUser(user) {
  return Boolean(user && String(user.id || "") === "usr-admin");
}

function normalizeMonthlyTarget(value, role) {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) return Math.round(parsed);
  if (FOUNDER_ROLES.has(normalizeUserRole(role))) return 0;
  return 25;
}

function normalizeRevenueTarget(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function normalizeJobType(value) {
  const text = String(value || "").trim().toLowerCase();
  if (text === "c2h" || text.includes("contract to hire") || text.includes("contract-to-hire")) return "C2H";
  if (text === "c2c" || text.includes("contract") || text.includes("corp")) return "C2C";
  return "FTE";
}

function normalizeBillingRateType(value) {
  const text = String(value || "").trim().toLowerCase();
  return text.includes("hour") ? "Hourly" : "Monthly";
}

function formatJobCommercials(job) {
  const jobType = normalizeJobType(job?.jobType);
  if (job?.ctcNotDisclosed) return "Not disclosed";

  if (jobType === "FTE") {
    const min = normalizeNullableNumber(job?.ctcMin);
    const max = normalizeNullableNumber(job?.ctcMax);
    if (min == null && max == null) return "Annual package not set";
    if (min != null && max != null) return `${min}-${max} LPA`;
    return `${min ?? max} LPA`;
  }

  const min = normalizeNullableNumber(job?.rateMin);
  const max = normalizeNullableNumber(job?.rateMax);
  const rateType = normalizeBillingRateType(job?.billingRateType);
  const suffix = rateType === "Hourly" ? "/hr" : "/month";
  if (min == null && max == null) return `${rateType} rate not set`;
  if (min != null && max != null) return `${formatCurrencyCompact(min, job?.currency)}-${formatCurrencyCompact(max, job?.currency)} ${suffix}`;
  return `${formatCurrencyCompact(min ?? max, job?.currency)} ${suffix}`;
}

function normalizeNullableNumber(value) {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatCurrencyCompact(value, currency = "INR") {
  const amount = Number(value || 0);
  if (String(currency || "INR").toUpperCase() === "USD") return `$${amount.toLocaleString("en-US")}`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatPercent(value) {
  const number = Number(value || 0);
  return `${Number.isFinite(number) ? Math.round(number) : 0}%`;
}

function average(values) {
  const numbers = values.map(Number).filter((value) => Number.isFinite(value));
  if (!numbers.length) return 0;
  return numbers.reduce((acc, item) => acc + item, 0) / numbers.length;
}

function progressBar(value) {
  const capped = Math.min(Math.max(Number(value || 0), 0), 100);
  return `<span class="target-bar" aria-label="${Math.round(capped)}% target achieved"><span style="width: ${capped}%"></span></span>`;
}

function horizontalChart(title, subtitle, rows, valueFormatter = null, maxOverride = null) {
  const cleanRows = Array.isArray(rows) ? rows.filter((row) => row && Number.isFinite(Number(row.value))) : [];
  const maxValue = Math.max(Number(maxOverride || 0), ...cleanRows.map((row) => Number(row.value || 0)), 1);

  return `
    <article class="chart-card">
      <div class="chart-card-head">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(subtitle)}</p>
      </div>
      <div class="chart-bars">
        ${
          cleanRows.length
            ? cleanRows
                .map((row) => {
                  const value = Number(row.value || 0);
                  const width = Math.min(Math.max((value / maxValue) * 100, value > 0 ? 4 : 0), 100);
                  const displayValue = valueFormatter ? valueFormatter(value) : String(Math.round(value));
                  return `
                    <div class="chart-row">
                      <div class="chart-row-label">
                        <strong>${escapeHtml(row.label || "-")}</strong>
                        <span>${escapeHtml(row.meta || "")}</span>
                      </div>
                      <div class="chart-track"><span style="width: ${width}%"></span></div>
                      <b>${escapeHtml(displayValue)}</b>
                    </div>
                  `;
                })
                .join("")
            : `<p class="empty chart-empty">No data available yet.</p>`
        }
      </div>
    </article>
  `;
}

function donutMetric(label, value, total, color = "blue", displayValue = null) {
  const safeTotal = Math.max(Number(total || 0), 1);
  const safeValue = Math.max(Number(value || 0), 0);
  const percent = Math.min(Math.round((safeValue / safeTotal) * 100), 100);

  return `
    <article class="donut-card ${color}">
      <div class="donut-ring" style="--donut-value: ${percent}%">
        <strong>${escapeHtml(displayValue || String(safeValue))}</strong>
      </div>
      <p>${escapeHtml(label)}</p>
    </article>
  `;
}

function formatShortDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function renderRevenueSection() {
  const placements = filteredPlacements();
  const revenueTotal = placements.reduce((acc, item) => acc + Number(item.revenue || 0), 0);
  const costTotal = placements.reduce((acc, item) => acc + calculatePlacementCost(item), 0);
  const marginTotal = revenueTotal - costTotal;
  const thisMonthRevenue = placements
    .filter((item) => isCurrentMonth(item.date))
    .reduce((acc, item) => acc + Number(item.revenue || 0), 0);

  return `
    <section class="panel">
      <div class="metrics-grid">
        ${metricCard("Total Revenue", formatCurrency(revenueTotal))}
        ${metricCard("Revenue This Month", formatCurrency(thisMonthRevenue))}
        ${metricCard("Delivery Cost", formatCurrency(costTotal))}
        ${metricCard("Gross Margin", formatCurrency(marginTotal))}
        ${metricCard("Placements", placements.length)}
      </div>
    </section>

    <section class="panel">
      <h2 class="panel-title">Placement Revenue</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Job</th>
              <th>Recruiter</th>
              <th>Date</th>
              <th>Revenue</th>
              <th>Cost</th>
              <th>Margin</th>
            </tr>
          </thead>
          <tbody>
            ${placements.length
              ? placements
                  .map((item) => {
                    const candidate = findById(state.candidates, item.candidateId);
                    const job = findById(state.jobs, item.jobId);
                    const margin = calculatePlacementMargin(item);
                    const marginPercent = Number(item.revenue || 0) ? Math.round((margin / Number(item.revenue || 0)) * 100) : 0;
                    return `<tr><td>${escapeHtml(candidate?.name || item.candidateId)}</td><td>${escapeHtml(job?.title || item.jobId)}</td><td>${escapeHtml(item.recruiter)}</td><td>${escapeHtml(item.date)}</td><td>${formatCurrency(item.revenue)}</td><td>${formatCurrency(calculatePlacementCost(item))}</td><td>${formatCurrency(margin)}<br /><span class="muted-cell">${formatPercent(marginPercent)}</span></td></tr>`;
                  })
                  .join("")
              : `<tr><td colspan="7" class="empty">No revenue data available.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderLeaderboardSection() {
  const ranked = rankRecruiterPerformanceRows(
    getRecruiterPerformanceRows({ includeAll: true, currentMonthOnly: true, ignoreSearch: true })
  );
  const rows = ranked
    .map((item, index) => ({ ...item, rank: index + 1 }))
    .filter((item) => matchesSearch(`${item.name} ${item.team} ${item.role}`));

  return `
    <section class="panel">
      <h2 class="panel-title">Recruiter Leaderboard</h2>
      <p class="panel-subtitle">Current-month standing using the same score and target calculations shown on recruiter dashboards.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Recruiter</th>
              <th>Candidates</th>
              <th>Target Progress</th>
              <th>Submitted</th>
              <th>Joined</th>
              <th>Revenue</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length
              ? rows
                  .map(
                    (item) =>
                      `<tr><td><span class="rank-pill">${item.rank}</span></td><td><strong>${escapeHtml(item.name)}</strong><br /><span class="muted-cell">${escapeHtml(item.team)}</span></td><td>${item.candidates}</td><td><div class="target-cell"><span>${item.candidates}/${item.monthlyTarget || "-"} · ${formatPercent(item.targetAttainment)}</span>${progressBar(item.targetAttainment)}</div></td><td>${item.submitted}</td><td>${item.joined}</td><td>${formatCurrency(item.revenue)}</td><td><strong>${item.score}</strong></td></tr>`
                  )
                  .join("")
              : `<tr><td colspan="8" class="empty">No leaderboard data available.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderActivityLogSection() {
  const rows = state.activities
    .filter((item) => matchesSearch(`${item.message} ${item.actorName || ""} ${item.actorEmail || ""} ${item.type || ""} ${item.module || ""}`))
    .slice(0, 60);

  return `
    ${renderAdoptionReport()}
    <section class="panel">
      <h2 class="panel-title">Activity Log</h2>
      <ul class="log-list">
        ${rows.length
          ? rows
              .map((item) => {
                const actor = [item.actorName, item.actorEmail].filter(Boolean).join(" · ") || "System";
                return `<li class="log-item"><p>${escapeHtml(item.message)}</p><span>${escapeHtml(
                  `${item.type || item.module || "system"} | ${actor} | ${item.timestamp}`
                )}</span></li>`;
              })
              .join("")
          : `<li class="log-item"><p class="empty">No activity for current filter.</p></li>`}
      </ul>
    </section>
  `;
}

function renderAdoptionReport() {
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  const candidates = filteredCandidates({ mode: "active", ignoreSearch: true });
  const recentUpdates = candidates.filter((candidate) => new Date(candidate.updatedAt || candidate.createdAt || 0).getTime() >= sevenDaysAgo).length;
  const complete = candidates.filter((candidate) => getCandidateQualityIssues(candidate).length === 0).length;
  const recentActivities = state.activities.filter((item) => new Date(item.timestamp || 0).getTime() >= sevenDaysAgo);
  const imports = recentActivities.filter((item) => String(item.type || item.module || "").includes("bulk-upload")).length;
  const byRecruiter = new Map();
  candidates.forEach((candidate) => {
    const key = candidate.recruiter || "Unassigned";
    const row = byRecruiter.get(key) || { recruiter: key, candidates: 0, complete: 0, followups: 0, updated: 0 };
    row.candidates += 1;
    if (!getCandidateQualityIssues(candidate).length) row.complete += 1;
    if (normalizeCandidateTracking(candidate).nextStepDate) row.followups += 1;
    if (new Date(candidate.updatedAt || candidate.createdAt || 0).getTime() >= sevenDaysAgo) row.updated += 1;
    byRecruiter.set(key, row);
  });
  const rows = [...byRecruiter.values()].sort((a, b) => b.updated - a.updated).slice(0, 20);
  return `
    <section class="panel adoption-report-panel">
      <p class="panel-kicker">ATS adoption</p><h2 class="panel-title">Is the team working in the system?</h2><p class="panel-subtitle">A seven-day signal based on candidate updates, follow-ups, imports, and data completeness.</p>
      <div class="metrics-grid">${metricCard("Candidates updated", recentUpdates)}${metricCard("Activity events", recentActivities.length)}${metricCard("Spreadsheet / CV imports", imports)}${metricCard("Complete records", candidates.length ? `${Math.round((complete / candidates.length) * 100)}%` : "0%")}</div>
      <div class="table-wrap"><table><thead><tr><th>Recruiter</th><th>Candidates</th><th>Updated 7d</th><th>Follow-ups set</th><th>Complete records</th></tr></thead><tbody>${rows.length ? rows.map((row) => `<tr><td>${escapeHtml(row.recruiter)}</td><td>${row.candidates}</td><td>${row.updated}</td><td>${row.followups}</td><td>${row.candidates ? Math.round((row.complete / row.candidates) * 100) : 0}%</td></tr>`).join("") : `<tr><td colspan="5" class="empty">No adoption data available.</td></tr>`}</tbody></table></div>
    </section>`;
}

function renderCandidateBulkToolbar(count) {
  const canAssignRecruiter = canCurrentUserAccessFounderWorkspace() || normalizeUserRole(getCurrentUser()?.role) === "TA Manager";
  return `
    <div class="candidate-bulk-toolbar">
      <strong>${count} selected</strong>
      <select data-action="candidate-bulk-field">
        <option value="jobId" ${ui.candidates.bulkField === "jobId" ? "selected" : ""}>Assign job</option>
        <option value="nextStepDate" ${ui.candidates.bulkField === "nextStepDate" ? "selected" : ""}>Set follow-up</option>
        ${canAssignRecruiter ? `<option value="recruiter" ${ui.candidates.bulkField === "recruiter" ? "selected" : ""}>Assign recruiter</option>` : ""}
      </select>
      ${ui.candidates.bulkField === "jobId"
        ? `<select data-action="candidate-bulk-value"><option value="">Unassigned</option>${state.jobs.map((job) => `<option value="${escapeHtml(job.id)}" ${ui.candidates.bulkValue === job.id ? "selected" : ""}>${escapeHtml(job.title)}</option>`).join("")}</select>`
        : ui.candidates.bulkField === "nextStepDate"
          ? `<input type="date" data-action="candidate-bulk-value" value="${escapeHtml(ui.candidates.bulkValue || "")}" />`
          : `<input type="text" data-action="candidate-bulk-value" value="${escapeHtml(ui.candidates.bulkValue || "")}" placeholder="Recruiter name" />`}
      <button class="tool-btn primary" type="button" data-action="apply-candidate-bulk">Apply</button>
      <button class="tool-btn" type="button" data-action="export-selected-candidates">Export CSV</button>
      <button class="tool-btn" type="button" data-action="clear-candidate-selection">Clear</button>
    </div>`;
}

function renderCandidateRow(item, isSelected = false) {
  const job = findById(state.jobs, item.jobId);
  const deleted = isCandidateDeleted(item);
  const stageClass = deleted ? "red" : STAGE_BADGE[item.stage] || "blue";
  const stageLabel = deleted ? "Deleted" : item.stage;
  const currentRole = getCandidateCurrentRole(item);
  const trackingStatus = getCandidateTrackingStatus(item);
  const closureType = normalizeClosureType(item.closureType);
  const overallRating = normalizeRating(item.overallRating);
  const canWrite = canCurrentUserWriteRecords();
  const isChecked = (ui.candidates.selectedIds || []).includes(item.id);
  const inline = ui.candidates.inlineEdit && !deleted && canWrite;
  const nextStepDate = normalizeCandidateTracking(item).nextStepDate;

  return `
    <tr
      class="candidate-row ${isSelected ? "is-selected" : ""}"
      data-action="open-candidate-sidepanel"
      data-candidate-id="${escapeHtml(item.id)}"
      tabindex="0"
      role="button"
      ${isSelected ? `aria-expanded="true" aria-controls="candidateProfilePanel"` : `aria-expanded="false"`}
      aria-label="Open candidate profile for ${escapeHtml(item.name)}"
    >
      <td data-label="Select"><input type="checkbox" data-action="candidate-select" data-candidate-id="${escapeHtml(item.id)}" aria-label="Select ${escapeHtml(item.name)}" ${isChecked ? "checked" : ""} /></td>
      <td data-label="Candidate">${escapeHtml(item.name)}<br />${inline ? `<select class="grid-cell-input" data-action="candidate-quick-field" data-field="jobId" data-candidate-id="${escapeHtml(item.id)}"><option value="">Unassigned</option>${state.jobs.map((availableJob) => `<option value="${escapeHtml(availableJob.id)}" ${item.jobId === availableJob.id ? "selected" : ""}>${escapeHtml(availableJob.title)}</option>`).join("")}</select>` : `<span class="panel-subtitle">${escapeHtml(job?.title || "Unassigned")}</span>`}</td>
      <td data-label="Email">${escapeHtml(item.email || "-")}</td>
      <td data-label="Phone">${escapeHtml(item.phone || "-")}</td>
      <td data-label="Current Role">${inline ? `<input class="grid-cell-input" type="text" data-action="candidate-quick-field" data-field="currentRole" data-candidate-id="${escapeHtml(item.id)}" value="${escapeHtml(currentRole || "")}" />` : escapeHtml(currentRole || "-")}</td>
      <td data-label="Experience">${item.experienceYears == null ? "-" : `${item.experienceYears} yrs`}</td>
      <td data-label="Closure">${statusBadge(closureType)}</td>
      <td data-label="Tracking">${statusBadge(trackingStatus)}</td>
      <td data-label="Rating">${overallRating == null ? "-" : `${overallRating}/10`}</td>
      <td data-label="Location">${escapeHtml(item.location || "-")}</td>
      <td data-label="Skills">${escapeHtml(item.skills.join(", "))}</td>
      <td data-label="Stage"><span class="badge ${stageClass}">${escapeHtml(stageLabel)}</span></td>
      <td data-label="Source">${escapeHtml(item.source)}</td>
      <td data-label="Recruiter">${inline ? `<input class="grid-cell-input" type="text" data-action="candidate-quick-field" data-field="recruiter" data-candidate-id="${escapeHtml(item.id)}" value="${escapeHtml(item.recruiter || "")}" />` : escapeHtml(item.recruiter)}</td>
      <td data-label="Follow-up">${inline ? `<input class="grid-cell-input" type="date" data-action="candidate-quick-field" data-field="nextStepDate" data-candidate-id="${escapeHtml(item.id)}" value="${escapeHtml(nextStepDate || "")}" />` : escapeHtml(nextStepDate || "Not set")}</td>
      <td data-label="Actions">
        <div class="table-actions">
          <button class="tool-btn" type="button" data-action="edit-candidate" data-candidate-id="${escapeHtml(item.id)}">Edit</button>
          ${
            deleted
              ? `<button class="tool-btn" type="button" data-action="restore-candidate" data-candidate-id="${escapeHtml(item.id)}" ${canWrite ? "" : "disabled"}>Restore</button>`
              : `<button class="tool-btn danger" type="button" data-action="delete-candidate" data-candidate-id="${escapeHtml(item.id)}" ${canWrite ? "" : "disabled"}>Delete</button>`
          }
        </div>
      </td>
    </tr>
  `;
}

function renderCandidateSidePanel() {
  const selectedCandidate = findCandidateByIdAnywhere(ui.candidates.selectedId);
  const draft = ui.candidates.editDraft;

  if (!selectedCandidate || !draft) {
    return "";
  }

  const preview = buildCandidateFromDraft(selectedCandidate, draft);
  const deleted = isCandidateDeleted(selectedCandidate);
  const linkedInUrl = normalizeLinkedInUrl(preview.linkedin || "");
  const resumeMeta = getCandidateResumeMeta(preview);
  const resumeDownloadUrl = getCandidateResumeDownloadUrl(preview);
  const resumeExtraction = getCandidateResumeExtraction(preview);
  const resumeVersions = getCandidateResumeVersions(preview);
  const importSource = getCandidateImportSource(preview);
  const stageHistory = getCandidateStageHistory(preview);
  const timeline = getCandidateTimeline(preview);
  const submissions = getCandidateSubmissions(preview);
  const collaborationNotes = getCandidateCollaborationNotes(preview);
  const canWrite = canCurrentUserWriteRecords();

  return `
    <aside class="panel candidate-side-panel" id="candidateProfilePanel" aria-labelledby="candidateProfileTitle">
      <div class="candidate-side-head">
        <div>
          <span class="candidate-profile-eyebrow">Candidate workspace</span>
          <h3 class="jobs-block-title" id="candidateProfileTitle">Candidate Profile</h3>
        </div>
        <button class="tool-btn candidate-profile-close" type="button" data-action="close-candidate-sidepanel" aria-label="Close candidate profile">Close ×</button>
      </div>
      <p class="panel-subtitle">Editing: ${escapeHtml(selectedCandidate.name)}</p>
      ${deleted ? `<p class="panel-subtitle">This profile is in Deleted Candidates.</p>` : ""}

      <div class="candidate-edit-grid">
        <label class="dialog-field">
          <span>Name</span>
          <input type="text" data-action="candidate-profile-field" data-field="name" value="${escapeHtml(draft.name || "")}" />
        </label>
        <label class="dialog-field">
          <span>Email</span>
          <input type="email" data-action="candidate-profile-field" data-field="email" value="${escapeHtml(draft.email || "")}" />
        </label>
        <label class="dialog-field">
          <span>Phone</span>
          <input type="text" data-action="candidate-profile-field" data-field="phone" value="${escapeHtml(draft.phone || "")}" />
        </label>
        <label class="dialog-field candidate-field-wide">
          <span>LinkedIn Profile</span>
          <div class="inline-copy-row">
            <input type="url" data-action="candidate-profile-field" data-field="linkedin" value="${escapeHtml(draft.linkedin || "")}" placeholder="https://www.linkedin.com/in/..." />
            <button class="tool-btn" type="button" data-action="copy-linkedin-url" ${linkedInUrl ? "" : "disabled"}>Copy</button>
            ${
              linkedInUrl
                ? `<a class="tool-btn link-tool-btn" href="${escapeHtml(linkedInUrl)}" target="_blank" rel="noopener noreferrer">Open</a>`
                : ""
            }
          </div>
        </label>
        <label class="dialog-field">
          <span>Current Role</span>
          <input type="text" data-action="candidate-profile-field" data-field="currentRole" value="${escapeHtml(draft.currentRole || "")}" />
        </label>
        <label class="dialog-field">
          <span>Total Experience (Years)</span>
          <input type="number" min="0" step="0.1" data-action="candidate-profile-field" data-field="experienceYears" value="${escapeHtml(
            String(draft.experienceYears || "")
          )}" />
        </label>
        <label class="dialog-field">
          <span>Current Company</span>
          <input type="text" data-action="candidate-profile-field" data-field="currentCompany" value="${escapeHtml(draft.currentCompany || "")}" />
        </label>
        <label class="dialog-field">
          <span>Location</span>
          <input type="text" data-action="candidate-profile-field" data-field="location" value="${escapeHtml(draft.location || "")}" />
        </label>
        <label class="dialog-field">
          <span>Education</span>
          <input type="text" data-action="candidate-profile-field" data-field="education" value="${escapeHtml(draft.education || "")}" />
        </label>
        <label class="dialog-field">
          <span>Stage</span>
          <select data-action="candidate-profile-field" data-field="stage">
            ${PIPELINE_STAGES.map((stage) => `<option value="${stage}" ${draft.stage === stage ? "selected" : ""}>${stage}</option>`).join("")}
          </select>
        </label>
        <label class="dialog-field">
          <span>Job</span>
          <select data-action="candidate-profile-field" data-field="jobId">
            <option value="">Unassigned</option>
            ${state.jobs.map((job) => `<option value="${escapeHtml(job.id)}" ${draft.jobId === job.id ? "selected" : ""}>${escapeHtml(job.title)}</option>`).join("")}
          </select>
        </label>
        <label class="dialog-field">
          <span>Closure Type</span>
          <select data-action="candidate-profile-field" data-field="closureType">
            ${CLOSURE_TYPE_OPTIONS.map((type) => `<option value="${type}" ${draft.closureType === type ? "selected" : ""}>${type}</option>`).join("")}
          </select>
        </label>
        <label class="dialog-field">
          <span>Tracking Status</span>
          <select data-action="candidate-profile-field" data-field="trackingStatus">
            ${TRACKING_STATUS_OPTIONS.map(
              (status) => `<option value="${status}" ${draft.trackingStatus === status ? "selected" : ""}>${status}</option>`
            ).join("")}
          </select>
        </label>
        <label class="dialog-field">
          <span>Screened Date</span>
          <input type="date" data-action="candidate-profile-field" data-field="screenedAt" value="${escapeHtml(draft.screenedAt || "")}" />
        </label>
        <label class="dialog-field">
          <span>Submitted Date</span>
          <input type="date" data-action="candidate-profile-field" data-field="submittedAt" value="${escapeHtml(draft.submittedAt || "")}" />
        </label>
        <label class="dialog-field">
          <span>Rejected Date</span>
          <input type="date" data-action="candidate-profile-field" data-field="rejectedAt" value="${escapeHtml(draft.rejectedAt || "")}" />
        </label>
        <label class="dialog-field">
          <span>Next Step Date</span>
          <input type="date" data-action="candidate-profile-field" data-field="nextStepDate" value="${escapeHtml(draft.nextStepDate || "")}" />
        </label>
        <label class="dialog-field candidate-field-wide">
          <span>Next Step</span>
          <input type="text" data-action="candidate-profile-field" data-field="nextStep" value="${escapeHtml(draft.nextStep || "")}" placeholder="e.g. L2 feedback pending, HR round, offer approval" />
        </label>
        <label class="dialog-field candidate-field-wide">
          <span>Rejection Reason</span>
          <input type="text" data-action="candidate-profile-field" data-field="rejectionReason" value="${escapeHtml(draft.rejectionReason || "")}" placeholder="Reason if rejected/dropped" />
        </label>
        <label class="dialog-field">
          <span>Technical Rating /10</span>
          <input type="number" min="0" max="10" step="0.1" data-action="candidate-profile-field" data-field="technicalRating" value="${escapeHtml(draft.technicalRating || "")}" />
        </label>
        <label class="dialog-field">
          <span>Communication /10</span>
          <input type="number" min="0" max="10" step="0.1" data-action="candidate-profile-field" data-field="communicationRating" value="${escapeHtml(draft.communicationRating || "")}" />
        </label>
        <label class="dialog-field">
          <span>Overall Rating /10</span>
          <input type="number" min="0" max="10" step="0.1" data-action="candidate-profile-field" data-field="overallRating" value="${escapeHtml(draft.overallRating || "")}" />
        </label>
        <label class="dialog-field candidate-field-wide">
          <span>Manager Rating Notes</span>
          <textarea rows="3" data-action="candidate-profile-field" data-field="ratingNotes">${escapeHtml(draft.ratingNotes || "")}</textarea>
        </label>
        <label class="dialog-field">
          <span>Source</span>
          <input type="text" data-action="candidate-profile-field" data-field="source" value="${escapeHtml(draft.source || "")}" />
        </label>
        <label class="dialog-field">
          <span>Recruiter</span>
          <input type="text" data-action="candidate-profile-field" data-field="recruiter" value="${escapeHtml(draft.recruiter || "")}" />
        </label>
        <label class="dialog-field candidate-field-wide">
          <span>Skills (comma separated)</span>
          <input type="text" data-action="candidate-profile-field" data-field="skills" value="${escapeHtml(draft.skills || "")}" />
        </label>
        <label class="dialog-field candidate-field-wide">
          <span>Keywords (comma separated)</span>
          <input type="text" data-action="candidate-profile-field" data-field="keywords" value="${escapeHtml(draft.keywords || "")}" />
        </label>
        <label class="dialog-field candidate-field-wide">
          <span>Profile Summary</span>
          <textarea rows="4" data-action="candidate-profile-field" data-field="profileSummary">${escapeHtml(draft.profileSummary || "")}</textarea>
        </label>
      </div>

      <div class="candidate-timeline-card collaboration-card">
        <div class="candidate-timeline-head"><div><h4>Team Notes & Mentions</h4><p>Use @name to make ownership visible in the activity trail.</p></div><span>${collaborationNotes.length} note${collaborationNotes.length === 1 ? "" : "s"}</span></div>
        ${deleted || !canWrite ? "" : `<div class="note-composer"><textarea rows="3" data-action="candidate-note-draft" placeholder="Add an update, decision, or @mention…">${escapeHtml(ui.candidates.noteDraft || "")}</textarea><button class="tool-btn primary" type="button" data-action="add-candidate-note">Add note</button></div>`}
        <div class="candidate-timeline-list">${collaborationNotes.length ? collaborationNotes.slice(0, 12).map((note) => `<article class="timeline-event"><strong>${escapeHtml(note.author || "Team member")}</strong><span>${escapeHtml(formatShortDate(note.createdAt || ""))}${Array.isArray(note.mentions) && note.mentions.length ? ` · mentions ${escapeHtml(note.mentions.join(", "))}` : ""}</span><p>${escapeHtml(note.text || "")}</p></article>`).join("") : `<p class="panel-subtitle">No team notes yet.</p>`}</div>
      </div>

      <div class="candidate-file-card">
        <div>
          <h4>Stage History</h4>
          <p>${stageHistory.length ? `${stageHistory.length} movement${stageHistory.length === 1 ? "" : "s"} tracked` : "No stage movements recorded yet"}</p>
          <span>Tracks who moved the candidate, when, and from which stage.</span>
        </div>
        <div class="stage-history-list">
          ${
            stageHistory.length
              ? stageHistory
                  .slice(0, 5)
                  .map(
                    (entry) => `
                      <p class="stage-history-item">
                        <strong>${escapeHtml(entry.oldStage || "New")} → ${escapeHtml(entry.newStage || "-")}</strong>
                        <span>${escapeHtml(entry.actorName || "System")} · ${escapeHtml(formatShortDate(entry.timestamp || ""))}</span>
                        ${entry.comment ? `<em>${escapeHtml(entry.comment)}</em>` : ""}
                      </p>
                    `
                  )
                  .join("")
              : `<p class="panel-subtitle">Move this candidate in Pipeline or update Stage and Save Changes.</p>`
          }
        </div>
      </div>

      <div class="candidate-timeline-card">
        <div class="candidate-timeline-head">
          <div>
            <h4>Master Timeline</h4>
            <p>${timeline.length ? `${timeline.length} event${timeline.length === 1 ? "" : "s"} tracked` : "No timeline events yet"}</p>
          </div>
          <span>${submissions.length} submission${submissions.length === 1 ? "" : "s"}</span>
        </div>
        <div class="candidate-timeline-list">
          ${
            timeline.length
              ? timeline
                  .slice(0, 8)
                  .map(
                    (event) => `
                      <article class="timeline-event">
                        <strong>${escapeHtml(event.eventType)}</strong>
                        <span>${escapeHtml(formatShortDate(event.timestamp))} · ${escapeHtml(event.user || event.recruiter || "System")}</span>
                        ${event.remarks ? `<p>${escapeHtml(event.remarks)}</p>` : ""}
                      </article>
                    `
                  )
                  .join("")
              : `<p class="panel-subtitle">Timeline starts when a candidate is created, uploaded, parsed, submitted, or moved across stages.</p>`
          }
        </div>
      </div>

      <div class="candidate-file-card">
        <div>
          <h4>Attached CV</h4>
          <p>${escapeHtml(resumeMeta.fileName || "No CV attached")}</p>
          <span>${escapeHtml(resumeMeta.fileType ? `${resumeMeta.fileType} · ${resumeVersions.length || 1} retained version(s)` : "Attach a PDF or DOCX when a genuine CV is available")}</span>
        </div>
        <div class="candidate-file-actions">
          ${
            resumeDownloadUrl
              ? `<button class="tool-btn link-tool-btn" type="button" data-action="preview-candidate-resume">Preview CV</button>
                 <button class="tool-btn link-tool-btn" type="button" data-action="download-candidate-resume">Download exact CV</button>`
              : `<button class="tool-btn" type="button" disabled>No Stored CV</button>`
          }
          ${
            deleted || !canWrite
              ? ""
              : `<label class="tool-btn candidate-upload-label">
                   ${ui.candidates.resumeUploadInProgress ? "Uploading..." : resumeMeta.resumeUrl ? "Replace CV" : "Upload CV"}
                   <input type="file" data-action="candidate-resume-file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" ${ui.candidates.resumeUploadInProgress ? "disabled" : ""} />
                 </label>`
          }
        </div>
      </div>

      ${
        importSource
          ? `<div class="candidate-file-card candidate-import-source">
               <div><h4>Import Source</h4><p>${escapeHtml(importSource.fileName)}</p><span>Spreadsheet import provenance only — this is not a candidate CV.</span></div>
             </div>`
          : ""
      }

      ${renderResumeExtraction(resumeExtraction)}
      ${renderResumeVersions(resumeVersions)}
      ${renderResumeDiagnostics(preview)}

      <div class="candidate-panel-actions">
        <button class="tool-btn" type="button" data-action="email-candidate" ${preview.email ? "" : "disabled"}>Email candidate</button>
        <button class="tool-btn" type="button" data-action="download-followup-calendar" ${normalizeCandidateTracking(preview).nextStepDate ? "" : "disabled"}>Add follow-up to calendar</button>
        <button class="tool-btn" type="button" data-action="preview-candidate-profile">Preview Profile</button>
        <button class="tool-btn" type="button" data-action="download-candidate-json">Export Profile</button>
        <button class="tool-btn" type="button" data-action="apply-resume-extraction" ${deleted || !canWrite || !resumeExtraction ? "disabled" : ""}>Apply Parsed Data to Draft</button>
        <button
          class="tool-btn"
          type="button"
          data-action="reparse-candidate-ai"
          ${deleted || ui.candidates.reparseInProgress || !canWrite || !resumeMeta.resumeUrl ? "disabled" : ""}
        >
          ${ui.candidates.reparseInProgress ? "Re-parsing..." : "Re-parse with AI"}
        </button>
        <button class="tool-btn" type="button" data-action="reset-candidate-profile">Reset</button>
        ${deleted || !canWrite ? "" : `<button class="tool-btn primary" type="button" data-action="save-candidate-profile">Save Changes</button>`}
      </div>
    </aside>
  `;
}

function focusCandidateSidePanel() {
  window.requestAnimationFrame(() => {
    el.sectionContainer?.querySelector("[data-action='close-candidate-sidepanel']")?.focus({ preventScroll: true });
  });
}

function closeCandidateSidePanel() {
  const candidateId = String(ui.candidates.selectedId || "");
  ui.candidates.selectedId = "";
  ui.candidates.editDraft = null;
  renderSection();
  window.requestAnimationFrame(() => {
    const candidateRow = Array.from(el.sectionContainer?.querySelectorAll("[data-action='open-candidate-sidepanel']") || []).find(
      (row) => String(row.dataset.candidateId || "") === candidateId
    );
    candidateRow?.focus({ preventScroll: true });
  });
}

function candidateDraftFromRecord(candidate) {
  const input = candidate || {};
  const tracking = normalizeCandidateTracking(input);
  return {
    id: String(input.id || ""),
    name: String(input.name || ""),
    email: String(input.email || ""),
    phone: String(input.phone || ""),
    linkedin: getCandidateLinkedIn(input),
    currentRole: String(input.currentRole || ""),
    experienceYears: input.experienceYears == null ? "" : String(input.experienceYears),
    currentCompany: String(input.currentCompany || ""),
    location: String(input.location || ""),
    education: String(input.education || ""),
    stage: PIPELINE_STAGES.includes(input.stage) ? input.stage : "Identified",
    jobId: String(input.jobId || ""),
    closureType: tracking.closureType,
    trackingStatus: tracking.trackingStatus,
    screenedAt: tracking.screenedAt,
    submittedAt: tracking.submittedAt,
    rejectedAt: tracking.rejectedAt,
    rejectionReason: tracking.rejectionReason,
    nextStep: tracking.nextStep,
    nextStepDate: tracking.nextStepDate,
    technicalRating: tracking.technicalRating == null ? "" : String(tracking.technicalRating),
    communicationRating: tracking.communicationRating == null ? "" : String(tracking.communicationRating),
    overallRating: tracking.overallRating == null ? "" : String(tracking.overallRating),
    ratingNotes: tracking.ratingNotes,
    source: String(input.source || ""),
    recruiter: String(input.recruiter || ""),
    skills: Array.isArray(input.skills) ? input.skills.join(", ") : String(input.skills || ""),
    keywords: Array.isArray(input.keywords) ? input.keywords.join(", ") : String(input.keywords || ""),
    profileSummary: String(input.profileSummary || "")
  };
}

function buildCandidateFromDraft(baseCandidate, draft) {
  const base = baseCandidate || {};
  const safeDraft = draft || {};
  const skills = uniqueStringsLocal(splitMultiDelimiter(safeDraft.skills || ""));
  const keywords = uniqueStringsLocal(
    splitMultiDelimiter(safeDraft.keywords || "").map((item) => String(item || "").toLowerCase())
  );
  const summary = cleanText(safeDraft.profileSummary || "");
  const currentRole = cleanText(safeDraft.currentRole || "") || inferCurrentRoleFromText(`${summary} ${skills.join(" ")}`);
  const tracking = normalizeCandidateTracking({
    ...base,
    closureType: safeDraft.closureType,
    trackingStatus: safeDraft.trackingStatus,
    screenedAt: safeDraft.screenedAt,
    submittedAt: safeDraft.submittedAt,
    rejectedAt: safeDraft.rejectedAt,
    rejectionReason: safeDraft.rejectionReason,
    nextStep: safeDraft.nextStep,
    nextStepDate: safeDraft.nextStepDate,
    technicalRating: safeDraft.technicalRating,
    communicationRating: safeDraft.communicationRating,
    overallRating: safeDraft.overallRating,
    ratingNotes: safeDraft.ratingNotes
  });
  const parsedData =
    base.parsedData && typeof base.parsedData === "object" && !Array.isArray(base.parsedData)
      ? { ...base.parsedData }
      : {};
  parsedData.tracking = { ...tracking };
  parsedData.linkedin = normalizeLinkedInUrl(safeDraft.linkedin || "");

  return {
    ...base,
    id: String(base.id || safeDraft.id || ""),
    name: cleanText(safeDraft.name || base.name || "Unknown Candidate"),
    email: cleanText(safeDraft.email || ""),
    phone: cleanText(safeDraft.phone || ""),
    linkedin: normalizeLinkedInUrl(safeDraft.linkedin || ""),
    skills,
    source: cleanText(safeDraft.source || base.source || "Unknown"),
    recruiter: cleanText(safeDraft.recruiter || base.recruiter || "Unassigned"),
    stage: PIPELINE_STAGES.includes(safeDraft.stage) ? safeDraft.stage : base.stage || "Identified",
    jobId: cleanText(safeDraft.jobId || ""),
    closureType: tracking.closureType,
    trackingStatus: tracking.trackingStatus,
    screenedAt: tracking.screenedAt,
    submittedAt: tracking.submittedAt,
    rejectedAt: tracking.rejectedAt,
    rejectionReason: tracking.rejectionReason,
    nextStep: tracking.nextStep,
    nextStepDate: tracking.nextStepDate,
    technicalRating: tracking.technicalRating,
    communicationRating: tracking.communicationRating,
    overallRating: tracking.overallRating,
    ratingNotes: tracking.ratingNotes,
    createdAt: String(base.createdAt || todayISO()),
    profileSummary: summary,
    keywords: keywords.length ? keywords : extractCatalogSkills(`${skills.join(" ")} ${summary}`),
    experienceYears: parseNullableNumber(safeDraft.experienceYears),
    currentRole,
    location: cleanText(safeDraft.location || ""),
    education: cleanText(safeDraft.education || ""),
    currentCompany: cleanText(safeDraft.currentCompany || ""),
    resumeUrl: String(base.resumeUrl || ""),
    parsedData,
    status: normalizeCandidateStatus(base.status),
    deletedAt: base.deletedAt ? String(base.deletedAt) : null
  };
}

function exportSelectedCandidateProfile() {
  const selectedId = String(ui.candidates.selectedId || "");
  const draft = ui.candidates.editDraft;
  if (!selectedId || !draft) return;

  const existing = findCandidateByIdAnywhere(selectedId);
  if (!existing) return;

  const payload = buildCandidateFromDraft(existing, draft);
  const resumeMeta = getCandidateResumeMeta(payload);
  const exportHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(payload.name || "Candidate Profile")}</title><style>body{font:15px/1.5 Arial,sans-serif;color:#172033;max-width:850px;margin:40px auto;padding:0 24px}h1{margin-bottom:4px}.meta{color:#526071}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;margin:24px 0}.block{border-top:1px solid #d8deea;padding-top:16px;margin-top:20px}@media print{body{margin:0}}</style></head><body><h1>${escapeHtml(payload.name || "Candidate")}</h1><p class="meta">Candidate profile exported from Agodly ATS</p><div class="grid"><div><strong>Email</strong><br>${escapeHtml(payload.email || "-")}</div><div><strong>Phone</strong><br>${escapeHtml(payload.phone || "-")}</div><div><strong>Current role</strong><br>${escapeHtml(payload.currentRole || "-")}</div><div><strong>Current company</strong><br>${escapeHtml(payload.currentCompany || "-")}</div><div><strong>Experience</strong><br>${payload.experienceYears == null ? "-" : `${escapeHtml(String(payload.experienceYears))} years`}</div><div><strong>Location</strong><br>${escapeHtml(payload.location || "-")}</div><div><strong>Education</strong><br>${escapeHtml(payload.education || "-")}</div><div><strong>Pipeline stage</strong><br>${escapeHtml(payload.stage || "-")}</div></div><section class="block"><h2>Skills</h2><p>${escapeHtml((payload.skills || []).join(", ") || "-")}</p></section><section class="block"><h2>Profile summary</h2><p>${escapeHtml(payload.profileSummary || "-")}</p></section><section class="block"><h2>CV</h2><p>${escapeHtml(resumeMeta.fileName || "No CV attached")}</p></section></body></html>`;
  const blob = new Blob([exportHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const safeName = String(payload.name || "candidate")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  anchor.download = `${safeName || "candidate"}-profile.html`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function applySelectedResumeExtractionToDraft() {
  const candidate = findCandidateByIdAnywhere(ui.candidates.selectedId);
  const extraction = getCandidateResumeExtraction(candidate);
  if (!candidate || !extraction || !ui.candidates.editDraft) return;
  const next = { ...ui.candidates.editDraft };
  const assign = (field, value) => {
    if (value !== undefined && value !== null && String(value).trim()) next[field] = String(value).trim();
  };
  assign("name", extraction.fullName);
  assign("email", extraction.email);
  assign("phone", extraction.phone);
  assign("location", extraction.location);
  assign("currentRole", extraction.currentRole);
  assign("currentCompany", extraction.currentCompany);
  assign("profileSummary", extraction.profileSummary);
  assign("experienceYears", extraction.totalExperienceYears);
  if (Array.isArray(extraction.education) && extraction.education.length) next.education = extraction.education.join(" | ");
  if (Array.isArray(extraction.skills) && extraction.skills.length) next.skills = extraction.skills.join(", ");
  assign("linkedin", extraction.linkedin);
  ui.candidates.editDraft = next;
  renderSection();
  alert("Parsed CV data was applied to the editable draft. Review the fields and select Save Changes to keep them.");
}

async function uploadSelectedCandidateResume(file) {
  const candidateId = String(ui.candidates.selectedId || "");
  if (!candidateId || ui.candidates.resumeUploadInProgress) return;
  const extension = getFileExtension(file?.name || "").toLowerCase();
  if (!new Set(["pdf", "docx"]).has(extension)) {
    alert("Only PDF and DOCX CV files are supported.");
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    alert("CV file must be 10MB or smaller.");
    return;
  }
  if (!ui.api.connected) {
    alert("Backend is disconnected. CV files cannot be stored safely right now.");
    return;
  }

  ui.candidates.resumeUploadInProgress = true;
  renderSection();
  try {
    const form = new FormData();
    form.append("resume", file);
    const response = await fetch(buildApiUrl(API_ROUTES.candidateResume(candidateId)), {
      method: "PUT",
      headers: getAuthHeaders(),
      body: form
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success || !payload?.candidate) {
      throw new Error(payload?.error?.message || "Could not store the CV");
    }
    const updated = mapApiCandidateToLocal(payload.candidate);
    upsertCandidateInState(updated);
    ui.candidates.selectedId = updated.id;
    ui.candidates.editDraft = candidateDraftFromRecord(updated);
    recordActivity("candidate", `CV version stored for ${updated.name}`);
    saveAndRender();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Could not store the CV");
  } finally {
    ui.candidates.resumeUploadInProgress = false;
    renderSection();
  }
}

async function copySelectedCandidateLinkedIn() {
  const candidate = buildSelectedCandidatePreview();
  const linkedInUrl = normalizeLinkedInUrl(candidate?.linkedin || "");
  if (!linkedInUrl) return;
  await copyTextToClipboard(linkedInUrl, "LinkedIn profile link copied.");
}

async function copySelectedCandidateResumeLink() {
  const candidate = buildSelectedCandidatePreview();
  const resumeUrl = getCandidateResumeDownloadUrl(candidate);
  if (!resumeUrl) return;
  await copyTextToClipboard(resumeUrl, "Original CV download link copied.");
}

async function downloadSelectedCandidateResume() {
  const candidate = buildSelectedCandidatePreview();
  if (!candidate?.id) return;

  const resumeUrl = getCandidateResumeDownloadUrl(candidate);
  if (!resumeUrl) {
    alert("No stored original CV is available for this candidate.");
    return;
  }

  try {
    const response = await fetch(resumeUrl, {
      method: "GET",
      headers: getAuthHeaders({ Accept: "application/octet-stream" })
    });

    if (!response.ok) {
      throw new Error("Could not download stored CV.");
    }

    const blob = await response.blob();
    const resumeMeta = getCandidateResumeMeta(candidate);
    const anchor = document.createElement("a");
    const objectUrl = URL.createObjectURL(blob);
    anchor.href = objectUrl;
    anchor.download = resumeMeta.fileName || `${candidate.name || "candidate"}-resume`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Could not download stored CV.");
  }
}

function openSelectedCandidateProfilePreview() {
  const candidate = buildSelectedCandidatePreview();
  if (!candidate?.id) return;

  ensureCandidateProfileDialogMounted();
  const resumeMeta = getCandidateResumeMeta(candidate);
  el.candidateProfileTitle.textContent = `Candidate Preview: ${candidate.name || "Candidate"}`;
  el.candidateProfileContent.innerHTML = `
    <section class="profile-block">
      <h4>Candidate Profile</h4>
      <div class="profile-grid">
        <p><strong>Name:</strong> ${escapeHtml(candidate.name || "-")}</p>
        <p><strong>Phone:</strong> ${escapeHtml(candidate.phone || "-")}</p>
        <p><strong>Email:</strong> ${escapeHtml(candidate.email || "-")}</p>
        <p><strong>Total Experience:</strong> ${candidate.experienceYears == null ? "-" : `${candidate.experienceYears} yrs`}</p>
        <p><strong>Location:</strong> ${escapeHtml(candidate.location || "-")}</p>
        <p><strong>Current Role:</strong> ${escapeHtml(getCandidateCurrentRole(candidate) || "-")}</p>
        <p><strong>Current Company:</strong> ${escapeHtml(candidate.currentCompany || "-")}</p>
        <p><strong>Source:</strong> ${escapeHtml(candidate.source || "-")}</p>
        <p><strong>Uploaded By / Recruiter:</strong> ${escapeHtml(getCandidateUploadedBy(candidate) || "-")}</p>
        <p><strong>Stage:</strong> ${escapeHtml(candidate.stage || "-")}</p>
        <p><strong>CV:</strong> ${escapeHtml(resumeMeta.fileName || "Manual profile - no CV uploaded")}</p>
      </div>
      <p class="profile-summary"><strong>Skills:</strong> ${escapeHtml((candidate.skills || []).join(", ") || "-")}</p>
      <p class="profile-summary"><strong>Summary:</strong> ${escapeHtml(candidate.profileSummary || "No summary added yet.")}</p>
    </section>
  `;
  el.candidateProfileDialog.showModal();
}

function getCandidateUploadedBy(candidate) {
  const parsedData = candidate?.parsedData && typeof candidate.parsedData === "object" ? candidate.parsedData : {};
  return String(parsedData.uploadedBy || candidate?.uploadedBy || candidate?.recruiter || "").trim();
}

async function previewSelectedCandidateResume() {
  const candidate = buildSelectedCandidatePreview();
  if (!candidate?.id) return;

  const resumeUrl = getCandidateResumeDownloadUrl(candidate);
  if (!resumeUrl) {
    alert("No stored original CV is available for this candidate.");
    return;
  }

  try {
    const response = await fetch(resumeUrl, {
      method: "GET",
      headers: getAuthHeaders({ Accept: "application/octet-stream" })
    });

    if (!response.ok) {
      throw new Error("Could not preview stored CV.");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
    if (!opened) {
      alert("Popup blocked. Use Download CV or allow popups to preview the original file.");
      URL.revokeObjectURL(objectUrl);
      return;
    }

    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Could not preview stored CV.");
  }
}

function buildSelectedCandidatePreview() {
  const selectedId = String(ui.candidates.selectedId || "");
  const draft = ui.candidates.editDraft;
  if (!selectedId || !draft) return null;

  const existing = findCandidateByIdAnywhere(selectedId);
  if (!existing) return null;
  return buildCandidateFromDraft(existing, draft);
}

class DuplicateCandidateError extends Error {
  constructor(message, duplicates) {
    super(message);
    this.name = "DuplicateCandidateError";
    this.duplicates = Array.isArray(duplicates) ? duplicates.map(mapApiCandidateToLocal) : [];
  }
}

async function createCandidateViaBackend(candidate, allowDuplicate = false) {
  const response = await fetch(buildApiUrl(API_ROUTES.createCandidate), {
    method: "POST",
    headers: getAuthHeaders({
      "Content-Type": "application/json",
      Accept: "application/json"
    }),
    body: JSON.stringify({
      ...candidate,
      allowDuplicate
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (response.status === 409 && payload?.error?.code === "DUPLICATE_CANDIDATE") {
    throw new DuplicateCandidateError(payload.error.message || "Potential duplicate candidate found", payload.duplicates || []);
  }

  if (!response.ok || !payload?.success || !payload?.candidate) {
    throw new Error(payload?.error?.message || "Could not create candidate");
  }

  return mapApiCandidateToLocal(payload.candidate);
}

async function updateCandidateFields(candidateId, changes, activityLabel = "Candidate updated") {
  if (!canCurrentUserWriteRecords() || !ui.api.connected) throw new Error("Candidate changes require an active write-enabled session.");
  const existing = findCandidateByIdAnywhere(candidateId);
  if (!existing) throw new Error("Candidate not found.");
  const next = { ...existing, ...changes };
  if (Object.prototype.hasOwnProperty.call(changes, "nextStepDate")) {
    const parsedData = existing.parsedData && typeof existing.parsedData === "object" && !Array.isArray(existing.parsedData)
      ? { ...existing.parsedData }
      : {};
    parsedData.tracking = { ...normalizeCandidateTracking(existing), nextStepDate: normalizeDateOnly(changes.nextStepDate) };
    next.parsedData = parsedData;
    next.nextStepDate = normalizeDateOnly(changes.nextStepDate);
  }
  const response = await fetch(buildApiUrl(API_ROUTES.updateCandidate(candidateId)), {
    method: "PUT",
    headers: getAuthHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
    body: JSON.stringify(next)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success || !payload?.candidate) throw new Error(payload?.error?.message || "Candidate update failed.");
  const updated = mapApiCandidateToLocal(payload.candidate);
  upsertCandidateInState(updated);
  const pageIndex = (ui.candidates.pageRows || []).findIndex((item) => item.id === updated.id);
  if (pageIndex >= 0) ui.candidates.pageRows[pageIndex] = updated;
  recordActivity("candidate", `${activityLabel}: ${updated.name}`, { action: "candidate.quick-update", candidateId: updated.id });
  return updated;
}

async function quickUpdateCandidate(candidateId, field, value) {
  const allowed = new Set(["currentRole", "recruiter", "jobId", "nextStepDate"]);
  if (!allowed.has(field)) return;
  try {
    const existing = findCandidateByIdAnywhere(candidateId);
    const previousValue = field === "nextStepDate" ? normalizeCandidateTracking(existing).nextStepDate : existing?.[field];
    await updateCandidateFields(candidateId, { [field]: value }, `Grid field ${field} updated`);
    ui.candidates.undoStack = [{ candidateId, field, value: previousValue ?? "" }, ...(ui.candidates.undoStack || [])].slice(0, 20);
    renderSection();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Grid edit could not be saved.");
    renderSection();
  }
}

async function undoLastCandidateGridEdit() {
  const [last, ...remaining] = ui.candidates.undoStack || [];
  if (!last) return;
  try {
    await updateCandidateFields(last.candidateId, { [last.field]: last.value }, `Grid edit undone`);
    ui.candidates.undoStack = remaining;
    renderSection();
  } catch (error) {
    alert(error instanceof Error ? error.message : "The last edit could not be undone.");
  }
}

async function applyCandidateBulkUpdate() {
  const ids = [...new Set(ui.candidates.selectedIds || [])];
  if (!ids.length) return;
  const field = ui.candidates.bulkField || "jobId";
  const value = ui.candidates.bulkValue || "";
  if (field === "recruiter" && !String(value).trim()) {
    alert("Enter a recruiter name before applying.");
    return;
  }
  if (field === "nextStepDate" && !value) {
    alert("Choose a follow-up date before applying.");
    return;
  }
  if (!window.confirm(`Apply this change to ${ids.length} candidate(s)? Each record will keep its existing history and data.`)) return;
  let completed = 0;
  const failures = [];
  for (const id of ids) {
    try {
      await updateCandidateFields(id, { [field]: value }, `Bulk ${field} updated`);
      completed += 1;
    } catch (error) {
      failures.push(error instanceof Error ? error.message : "Update failed");
    }
  }
  ui.candidates.selectedIds = failures.length ? ids.slice(completed) : [];
  ui.candidates.lastQueryKey = "";
  renderSection();
  alert(`${completed} candidate(s) updated.${failures.length ? ` ${failures.length} failed: ${failures[0]}` : ""}`);
}

function exportSelectedCandidatesCsv() {
  const ids = new Set(ui.candidates.selectedIds || []);
  const rows = state.candidates.filter((candidate) => ids.has(candidate.id));
  if (!rows.length) return;
  const quote = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const columns = ["Name", "Email", "Phone", "Current Role", "Experience", "Location", "Skills", "Stage", "Job", "Recruiter", "Follow-up", "Source"];
  const csv = [columns.map(quote).join(","), ...rows.map((candidate) => {
    const job = findById(state.jobs, candidate.jobId);
    return [candidate.name, candidate.email, candidate.phone, candidate.currentRole, candidate.experienceYears, candidate.location, (candidate.skills || []).join("; "), candidate.stage, job?.title || "", candidate.recruiter, normalizeCandidateTracking(candidate).nextStepDate, candidate.source].map(quote).join(",");
  })].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agodly-candidates-${todayISO()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
  recordActivity("candidate", `Exported ${rows.length} selected candidate(s) to CSV`);
}

async function addCandidateCollaborationNote() {
  const candidate = findCandidateByIdAnywhere(ui.candidates.selectedId);
  const text = String(ui.candidates.noteDraft || "").trim();
  if (!candidate || !text) return;
  const actor = getCurrentUser();
  const parsedData = candidate.parsedData && typeof candidate.parsedData === "object" && !Array.isArray(candidate.parsedData)
    ? { ...candidate.parsedData }
    : {};
  const mentions = [...text.matchAll(/(^|\s)@([a-zA-Z][\w.-]*(?:\s+[a-zA-Z][\w.-]*)?)/g)].map((match) => match[2].trim());
  const note = { id: uid("note"), text, mentions, author: actor?.name || "Team member", authorEmail: actor?.email || "", createdAt: new Date().toISOString() };
  parsedData.collaborationNotes = [note, ...getCandidateCollaborationNotes(candidate)].slice(0, 100);
  parsedData.timeline = [{ id: uid("evt"), eventType: "Team note", candidateId: candidate.id, timestamp: note.createdAt, user: note.author, remarks: text }, ...getCandidateTimeline(candidate)].slice(0, 200);
  try {
    const updated = await updateCandidateFields(candidate.id, { parsedData }, "Team note added");
    ui.candidates.noteDraft = "";
    ui.candidates.editDraft = candidateDraftFromRecord(updated);
    renderSection();
  } catch (error) {
    alert(error instanceof Error ? error.message : "The note could not be saved.");
  }
}

function openCandidateEmailTemplate() {
  const candidate = findCandidateByIdAnywhere(ui.candidates.selectedId);
  if (!candidate?.email) return;
  const job = findById(state.jobs, candidate.jobId);
  const tracking = normalizeCandidateTracking(candidate);
  const subject = `Agodly update${job?.title ? `: ${job.title}` : " on your application"}`;
  const body = `Hi ${candidate.name || "there"},\n\nI’m following up regarding ${job?.title || candidate.currentRole || "your application"}.${tracking.nextStep ? `\n\nNext step: ${tracking.nextStep}` : ""}${tracking.nextStepDate ? `\nPlanned date: ${tracking.nextStepDate}` : ""}\n\nRegards,\n${getCurrentUser()?.name || "Agodly Recruitment Team"}`;
  window.location.href = `mailto:${encodeURIComponent(candidate.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  recordActivity("communication", `Email template opened for ${candidate.name}`, { candidateId: candidate.id, action: "candidate.email-template" });
}

function downloadCandidateFollowUpCalendar() {
  const candidate = findCandidateByIdAnywhere(ui.candidates.selectedId);
  const tracking = normalizeCandidateTracking(candidate);
  if (!candidate || !tracking.nextStepDate) return;
  const compactDate = tracking.nextStepDate.replace(/-/g, "");
  const escapeIcs = (value) => String(value || "").replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
  const job = findById(state.jobs, candidate.jobId);
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Agodly ATS//Follow-up//EN", "BEGIN:VEVENT",
    `UID:${candidate.id}-${compactDate}@agodly.com`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    `DTSTART;VALUE=DATE:${compactDate}`, `DTEND;VALUE=DATE:${compactDate}`,
    `SUMMARY:${escapeIcs(`Follow up: ${candidate.name}`)}`,
    `DESCRIPTION:${escapeIcs(`${tracking.nextStep || "Candidate follow-up"}${job?.title ? ` for ${job.title}` : ""}`)}`,
    "END:VEVENT", "END:VCALENDAR"
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${String(candidate.name || "candidate").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-follow-up.ics`;
  anchor.click();
  URL.revokeObjectURL(url);
  recordActivity("communication", `Calendar follow-up created for ${candidate.name}`, { candidateId: candidate.id, action: "candidate.calendar" });
}

async function saveCandidateProfileDraft() {
  if (!canCurrentUserWriteRecords()) {
    alert("Your role can view records but cannot edit candidate profiles.");
    return;
  }

  const selectedId = String(ui.candidates.selectedId || "");
  const draft = ui.candidates.editDraft;
  if (!selectedId || !draft) return;

  const existing = findCandidateByIdAnywhere(selectedId);
  if (!existing) return;

  const localCandidate = buildCandidateFromDraft(existing, draft);
  if (existing.stage !== localCandidate.stage) {
    ui.candidates.editDraft.stage = existing.stage;
    alert("Pipeline stage changes require the Stage Movement modal. Use the Pipeline board stage dropdown and complete mandatory feedback.");
    renderSection();
    return;
  }

  if (!ui.api.connected) {
    alert("Candidate edits require the backend database. Start the backend and try again; no local-only changes were saved.");
    return;
  }

  let updated = localCandidate;
  try {
    const response = await fetch(buildApiUrl(API_ROUTES.updateCandidate(selectedId)), {
      method: "PUT",
      headers: getAuthHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify(localCandidate)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success || !payload?.candidate) {
      alert(payload?.error?.message || "Candidate profile could not be saved to the database.");
      return;
    }
    updated = mapApiCandidateToLocal(payload.candidate);
  } catch (_error) {
    ui.api.connected = false;
    ui.api.message = "Backend disconnected";
    renderApiStatus();
    alert("Candidate profile could not be saved because the backend is unavailable. No local-only changes were saved.");
    return;
  }

  upsertCandidateInState(updated);
  if (ui.api.connected) {
    ui.candidates.inFlightQueryKey = "";
    ui.candidates.lastQueryKey = "";
    void ensureCandidatesPageLoaded({ force: true });
  }
  ui.candidates.selectedId = updated.id;
  ui.candidates.editDraft = candidateDraftFromRecord(updated);
  recordActivity("candidate", `Candidate updated: ${updated.name}`, {
    action: "candidate.update",
    candidateId: updated.id
  });
  saveAndRender();
}

async function moveCandidateStage(candidateId, nextStage, movement = {}) {
  if (!canCurrentUserWriteRecords()) {
    alert("Your role can view pipeline stages but cannot move candidates.");
    renderSection();
    return;
  }

  const selectedId = String(candidateId || "").trim();
  const stage = PIPELINE_STAGES.includes(nextStage) ? nextStage : "";
  if (!selectedId || !stage) return;

  const existing = findCandidateByIdAnywhere(selectedId);
  if (!existing || existing.stage === stage) {
    renderSection();
    return;
  }

  if (isCandidateDeleted(existing)) {
    alert("Restore this candidate before moving pipeline stage.");
    renderSection();
    return;
  }

  const oldStage = existing.stage;
  let updated = {
    ...existing,
    stage
  };
  appendCandidateStageHistory(updated, oldStage, stage, movement);

  if (!ui.api.connected) {
    alert("Pipeline movement requires the backend database. No local-only stage change was saved.");
    renderSection();
    return;
  }

  try {
    const response = await fetch(buildApiUrl(API_ROUTES.updateCandidate(selectedId)), {
      method: "PUT",
      headers: getAuthHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify(updated)
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success || !payload?.candidate) {
      alert(payload?.error?.message || "Pipeline stage could not be saved to the database.");
      renderSection();
      return;
    }
    updated = mapApiCandidateToLocal(payload.candidate);
  } catch (_error) {
    ui.api.connected = false;
    ui.api.message = "Backend disconnected";
    renderApiStatus();
    alert("Pipeline stage could not be saved because the backend is unavailable. No local-only change was saved.");
    renderSection();
    return;
  }

  upsertCandidateInState(updated);
  if (ui.candidates.selectedId === updated.id) {
    ui.candidates.editDraft = candidateDraftFromRecord(updated);
  }
  recordActivity("pipeline", `${updated.name} moved from ${oldStage} to ${stage}`, {
    action: "candidate.stage.move",
    candidateId: updated.id,
    oldStage,
    newStage: stage,
    remarks: movement.feedback || movement.reason || "",
    nextFollowUpDate: movement.nextFollowUpDate || ""
  });
  saveAndRender();
}

async function submitStageMovementDialog(data) {
  const candidateId = String(el.recordDialog.dataset.candidateId || "").trim();
  const nextStage = String(el.recordDialog.dataset.nextStage || "").trim();
  const isPoolMovement = nextStage === "Pool";
  const attachmentInput = el.recordForm.querySelector("input[name='attachment']");
  const movement = {
    movementDate: String(data.movementDate || "").trim(),
    movementTime: String(data.movementTime || "").trim(),
    clientId: String(data.clientId || "").trim().replace("__manual__", ""),
    vendor: String(data.vendor || "").trim(),
    endClient: String(data.endClient || "").trim(),
    jobId: String(data.jobId || "").trim().replace("__unassigned__", ""),
    recruiter: String(data.recruiter || "").trim(),
    previousStage: String(data.previousStage || "").trim(),
    currentStage: String(data.currentStage || nextStage).trim(),
    feedback: String(data.feedback || "").trim(),
    reason: String(data.reason || "").trim(),
    nextFollowUpDate: String(data.nextFollowUpDate || "").trim(),
    priority: String(data.priority || "Medium").trim(),
    movementOwner: String(data.movementOwner || "").trim(),
    attachment: attachmentInput?.files?.[0] || null
  };

  const requiredFields = [
    ["Movement Date", movement.movementDate],
    ["Movement Time", movement.movementTime],
    ["Recruiter", movement.recruiter],
    ["Feedback", movement.feedback],
    ["Reason", movement.reason],
    ["Priority", movement.priority],
    ["Movement Owner", movement.movementOwner]
  ];
  if (!isPoolMovement) {
    requiredFields.push(["Job", movement.jobId || data.jobId]);
    requiredFields.push(["Next Follow-up Date", movement.nextFollowUpDate]);
  }
  const missing = requiredFields.filter(([, value]) => !String(value || "").trim());

  if (missing.length) {
    alert(`Complete mandatory fields before moving stage: ${missing.map(([label]) => label).join(", ")}`);
    return;
  }

  await moveCandidateStage(candidateId, nextStage, movement);
  el.recordForm?.reset();
  closeRecordDialog();
}

async function reparseCandidateProfileWithAI() {
  if (!canCurrentUserWriteRecords()) {
    alert("Your role can view candidates but cannot re-parse or alter profiles.");
    return;
  }

  const selectedId = String(ui.candidates.selectedId || "");
  if (!selectedId || ui.candidates.reparseInProgress) return;

  const candidate = findCandidateByIdAnywhere(selectedId);
  if (!candidate) return;

  if (isCandidateDeleted(candidate)) {
    alert("Cannot re-parse a deleted candidate profile.");
    return;
  }

  if (!ui.api.connected) {
    alert("Backend is disconnected. Start backend to run AI re-parse.");
    return;
  }

  ui.candidates.reparseInProgress = true;
  renderSection();

  try {
    const response = await fetch(buildApiUrl(API_ROUTES.reparseCandidate(selectedId)), {
      method: "POST",
      headers: getAuthHeaders({ Accept: "application/json" })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success || !payload?.candidate) {
      throw new Error(payload?.error?.message || "AI re-parse failed");
    }

    const updated = mapApiCandidateToLocal(payload.candidate);
    upsertCandidateInState(updated);
    ui.candidates.inFlightQueryKey = "";
    ui.candidates.lastQueryKey = "";
    void ensureCandidatesPageLoaded({ force: true });
    ui.candidates.selectedId = updated.id;
    ui.candidates.editDraft = candidateDraftFromRecord(updated);

    recordActivity("candidate", `Candidate re-parsed with AI: ${updated.name}`);
    saveAndRender();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not re-parse candidate";
    alert(message);
  } finally {
    ui.candidates.reparseInProgress = false;
    renderSection();
  }
}

async function deleteCandidateRecord(candidateId) {
  if (!canCurrentUserWriteRecords()) {
    alert("Your role can view candidates but cannot delete records.");
    return;
  }

  const selectedId = String(candidateId || "").trim();
  if (!selectedId) return;

  const candidate = findCandidateByIdAnywhere(selectedId);
  if (!candidate) return;

  if (isCandidateDeleted(candidate)) {
    alert("Candidate is already in deleted candidates.");
    return;
  }

  const firstConfirm = confirm(`Move ${candidate.name} to Deleted Candidates?`);
  if (!firstConfirm) return;

  const secondConfirm = prompt('Type DELETE to confirm this action');
  if (String(secondConfirm || "").trim().toUpperCase() !== "DELETE") {
    alert("Delete cancelled. Confirmation text did not match.");
    return;
  }

  if (!ui.api.connected) {
    alert("Deleting candidates requires the backend database. No local-only delete was saved.");
    return;
  }

  let updated = candidate;
  try {
    const response = await fetch(buildApiUrl(API_ROUTES.deleteCandidate(selectedId)), {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify({
        confirmationToken: "DELETE"
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success || !payload?.candidate) {
      alert(payload?.error?.message || "Candidate could not be moved to Deleted Candidates.");
      return;
    }
    updated = mapApiCandidateToLocal(payload.candidate);
  } catch (_error) {
    ui.api.connected = false;
    ui.api.message = "Backend disconnected";
    renderApiStatus();
    alert("Candidate could not be deleted because the backend is unavailable. No local-only delete was saved.");
    return;
  }

  upsertCandidateInState(updated);
  ui.candidates.selectedId = "";
  ui.candidates.editDraft = null;
  ui.candidates.view = "active";
  if (ui.api.connected) {
    ui.candidates.inFlightQueryKey = "";
    ui.candidates.lastQueryKey = "";
    void ensureCandidatesPageLoaded({ force: true });
  }
  recordActivity("candidate", `Candidate moved to Deleted Candidates: ${candidate.name}`);
  saveAndRender();
}

async function restoreCandidateRecord(candidateId) {
  if (!canCurrentUserWriteRecords()) {
    alert("Your role can view candidates but cannot restore records.");
    return;
  }

  const selectedId = String(candidateId || "").trim();
  if (!selectedId) return;

  const candidate = findCandidateByIdAnywhere(selectedId);
  if (!candidate) return;
  if (!isCandidateDeleted(candidate)) {
    alert("Candidate is already active.");
    return;
  }

  const shouldRestore = confirm(`Restore ${candidate.name} to Active Candidates?`);
  if (!shouldRestore) return;

  if (!ui.api.connected) {
    alert("Restoring candidates requires the backend database. No local-only restore was saved.");
    return;
  }

  let updated = candidate;
  try {
    const response = await fetch(buildApiUrl(API_ROUTES.restoreCandidate(selectedId)), {
      method: "POST",
      headers: getAuthHeaders({ Accept: "application/json" })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success || !payload?.candidate) {
      alert(payload?.error?.message || "Candidate could not be restored.");
      return;
    }
    updated = mapApiCandidateToLocal(payload.candidate);
  } catch (_error) {
    ui.api.connected = false;
    ui.api.message = "Backend disconnected";
    renderApiStatus();
    alert("Candidate could not be restored because the backend is unavailable. No local-only restore was saved.");
    return;
  }

  upsertCandidateInState(updated);
  if (ui.api.connected) {
    ui.candidates.inFlightQueryKey = "";
    ui.candidates.lastQueryKey = "";
    void ensureCandidatesPageLoaded({ force: true });
  }
  ui.candidates.selectedId = "";
  ui.candidates.editDraft = null;
  recordActivity("candidate", `Candidate restored from Deleted: ${candidate.name}`);
  saveAndRender();
}

function metricCard(label, value) {
  return `<article class="metric-card"><p class="metric-label">${escapeHtml(String(label))}</p><p class="metric-value">${escapeHtml(String(value))}</p></article>`;
}

function statusBadge(value) {
  const lower = String(value).toLowerCase();

  if (["open", "completed", "onboarded", "joined", "active", "screened", "submitted", "fte"].includes(lower)) {
    return `<span class="badge green">${escapeHtml(value)}</span>`;
  }

  if (["paused", "scheduled", "pending", "offer", "interview", "contractual", "c2c", "c2h", "inactive"].includes(lower)) {
    return `<span class="badge yellow">${escapeHtml(value)}</span>`;
  }

  if (["closed", "cancelled", "dropped", "rejected", "archived", "blocked"].includes(lower)) {
    return `<span class="badge red">${escapeHtml(value)}</span>`;
  }

  return `<span class="badge blue">${escapeHtml(value)}</span>`;
}

function filterCandidatePoolCandidates(candidates) {
  const pool = ui.candidatePool || {};
  const skillFilter = String(pool.skill || "all").trim().toLowerCase();
  const roleFilter = String(pool.role || "all").trim().toLowerCase();
  const sourceFilter = String(pool.source || "all").trim().toLowerCase();
  const locationFilter = String(pool.location || "all").trim().toLowerCase();
  const minExp = parseNullableNumber(pool.expMin);
  const maxExp = parseNullableNumber(pool.expMax);

  return (Array.isArray(candidates) ? candidates : []).filter((candidate) => {
    const skills = Array.isArray(candidate.skills) ? candidate.skills.map((item) => String(item).toLowerCase()) : [];
    const keywords = Array.isArray(candidate.keywords) ? candidate.keywords.map((item) => String(item).toLowerCase()) : [];
    const role = String(getCandidateCurrentRole(candidate) || "").toLowerCase();
    const source = String(candidate.source || "").toLowerCase();
    const location = String(candidate.location || "").toLowerCase();
    const summary = String(candidate.profileSummary || "").toLowerCase();

    if (skillFilter !== "all") {
      const skillMatch =
        skills.some((skill) => skill.includes(skillFilter) || skillFilter.includes(skill)) ||
        keywords.some((keyword) => keyword.includes(skillFilter) || skillFilter.includes(keyword)) ||
        summary.includes(skillFilter);
      if (!skillMatch) return false;
    }

    if (roleFilter !== "all" && !role.includes(roleFilter)) return false;
    if (sourceFilter !== "all" && source !== sourceFilter) return false;
    if (locationFilter !== "all" && location !== locationFilter) return false;

    const exp = candidate.experienceYears == null ? null : Number(candidate.experienceYears);
    if (minExp != null && (exp == null || exp < minExp)) return false;
    if (maxExp != null && (exp == null || exp > maxExp)) return false;

    return true;
  });
}

function aggregateBySource(candidates, options = {}) {
  const ignoreGlobalSearch = Boolean(options.ignoreGlobalSearch);
  const map = new Map();

  candidates.forEach((candidate) => {
    if (!ignoreGlobalSearch && !matchesSearch(candidate.source || "")) return;

    const current = map.get(candidate.source) || { source: candidate.source, count: 0, onboarded: 0 };
    current.count += 1;
    if (candidate.stage === "Onboarded") current.onboarded += 1;
    map.set(candidate.source, current);
  });

  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function aggregateSkills(candidates) {
  const map = new Map();

  candidates.forEach((candidate) => {
    candidate.skills.forEach((skill) => {
      const normalized = skill.trim();
      if (!normalized) return;
      map.set(normalized, (map.get(normalized) || 0) + 1);
    });
  });

  return Array.from(map.entries())
    .map(([skill, count]) => ({ skill, count }))
    .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill));
}

function analyzeJdInput(jdText, keywordText) {
  const keywordsFromInput = splitMultiDelimiter(keywordText);
  const termsFromJd = tokenizeToTerms(jdText);
  const skillHits = extractCatalogSkills(`${jdText} ${keywordText}`);
  const minExperienceYears = extractExperienceFromText(`${jdText} ${keywordText}`);

  const requiredTerms = uniqueStringsLocal([
    ...skillHits,
    ...keywordsFromInput,
    ...termsFromJd.filter((term) => term.length > 2)
  ]).slice(0, 60);

  return {
    requiredTerms,
    coreSkills: uniqueStringsLocal(skillHits),
    minExperienceYears
  };
}

function buildAiMatches(jdAnalysis) {
  const candidates = filteredCandidates();
  const jobs = filteredJobs();

  const fallbackTerms = uniqueStringsLocal(jobs.flatMap((job) => job.requiredSkills || []));
  const requiredTerms = jdAnalysis.requiredTerms.length ? jdAnalysis.requiredTerms : fallbackTerms;
  const jdSkills = jdAnalysis.coreSkills.length ? jdAnalysis.coreSkills : fallbackTerms;
  const mustHaveTerms = jdAnalysis.coreSkills.length ? jdAnalysis.coreSkills : requiredTerms.slice(0, Math.min(8, requiredTerms.length));
  const weights = {
    terms: 0.65,
    skills: 0.25,
    experience: 0.1
  };
  const minExp = jdAnalysis.minExperienceYears;
  const hasTargetSignals = requiredTerms.length > 0 || jdSkills.length > 0 || minExp != null;
  if (!hasTargetSignals) return [];

  return candidates
    .map((candidate) => {
      const candidateTerms = new Set([
        ...candidate.skills.map((item) => String(item).toLowerCase()),
        ...tokenizeToTerms(candidate.currentRole || ""),
        ...tokenizeToTerms(candidate.currentCompany || ""),
        ...splitMultiDelimiter(candidate.profileSummary || "").map((item) => item.toLowerCase()),
        ...(Array.isArray(candidate.keywords) ? candidate.keywords.map((item) => String(item).toLowerCase()) : [])
      ]);

      const matchedTerms = requiredTerms.filter((term) => candidateTerms.has(String(term).toLowerCase()));
      const matchedSkills = jdSkills.filter((skill) => candidateTerms.has(String(skill).toLowerCase()));
      const matchedMustHaves = mustHaveTerms.filter((term) => candidateTerms.has(String(term).toLowerCase()));
      const missingMustHaves = mustHaveTerms.filter((term) => !candidateTerms.has(String(term).toLowerCase()));

      const termScore = requiredTerms.length ? matchedTerms.length / requiredTerms.length : 0;
      const skillScore = jdSkills.length ? matchedSkills.length / jdSkills.length : termScore;

      let expScore = requiredTerms.length || jdSkills.length ? 1 : 0;
      if (minExp != null) {
        const exp = candidate.experienceYears == null ? 0 : candidate.experienceYears;
        expScore = exp >= minExp ? 1 : exp / Math.max(minExp, 1);
      }

      const weightedPoints = {
        terms: roundTo(termScore * weights.terms * 100, 1),
        skills: roundTo(skillScore * weights.skills * 100, 1),
        experience: roundTo(expScore * weights.experience * 100, 1)
      };
      const score = Math.round(weightedPoints.terms + weightedPoints.skills + weightedPoints.experience);
      const candidateExp = candidate.experienceYears == null ? 0 : candidate.experienceYears;
      const experienceGapYears = minExp == null ? 0 : Math.max(0, Math.ceil(minExp - candidateExp));
      const confidenceLabel = getConfidenceLabel(score, matchedMustHaves.length, mustHaveTerms.length, experienceGapYears);
      const explanation = buildConfidenceExplanation({
        score,
        matchedTermsCount: matchedTerms.length,
        requiredTermCount: requiredTerms.length,
        matchedMustHaveCount: matchedMustHaves.length,
        mustHaveCount: mustHaveTerms.length,
        experienceGapYears
      });

      const bestJob = jobs
        .map((job) => {
          const required = (job.requiredSkills || []).map((item) => String(item).toLowerCase());
          const overlap = required.filter((term) => candidateTerms.has(term)).length;
          const ratio = required.length ? overlap / required.length : 0;
          return { job, ratio };
        })
        .sort((a, b) => b.ratio - a.ratio)[0];

      return {
        candidate,
        score: Math.max(0, Math.min(100, score)),
        matchedSkills,
        matchedTerms,
        matchedMustHaves,
        missingMustHaves,
        requiredTermCount: requiredTerms.length,
        mustHaveCount: mustHaveTerms.length,
        experienceGapYears,
        confidenceLabel,
        explanation,
        scoreBreakdown: {
          weights,
          normalized: {
            terms: roundTo(termScore * 100, 1),
            skills: roundTo(skillScore * 100, 1),
            experience: roundTo(expScore * 100, 1)
          },
          weightedPoints
        },
        bestJobTitle: bestJob?.job?.title || ""
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name));
}

function calculateAvgDaysToHire() {
  if (!state.placements.length) return 0;

  const diffs = state.placements
    .map((placement) => {
      const candidate = findById(state.candidates, placement.candidateId);
      if (!candidate) return null;
      return daysBetween(candidate.createdAt, placement.date);
    })
    .filter((value) => typeof value === "number");

  if (!diffs.length) return 0;
  return Math.round(diffs.reduce((acc, item) => acc + item, 0) / diffs.length);
}

function filteredCandidates(options = {}) {
  const mode = options.mode === "deleted" ? "deleted" : "active";
  const ignoreSearch = Boolean(options.ignoreSearch);
  const ignoreRoleScope = Boolean(options.ignoreRoleScope);
  return state.candidates.filter(
    (item) => {
      const tracking = normalizeCandidateTracking(item);
      const resumeMeta = getCandidateResumeMeta(item);
      return (
        (mode === "deleted" ? isCandidateDeleted(item) : !isCandidateDeleted(item)) &&
        (ignoreRoleScope || canCurrentUserAccessCandidate(item)) &&
        inSelectedPeriod(item.createdAt) &&
        (ignoreSearch ||
          matchesSearch(
            `${item.name} ${item.email} ${item.phone} ${item.currentRole || ""} ${item.currentCompany || ""} ${item.location || ""} ${
              item.education || ""
            } ${item.linkedin || ""} ${resumeMeta.fileName} ${resumeMeta.fileType} ${item.source} ${item.recruiter} ${item.skills.join(" ")} ${item.profileSummary || ""} ${buildCandidateTrackingSearchText(tracking)}`
          ))
      );
    }
  );
}

function getVisibleCandidateCount() {
  return filteredCandidates({ mode: "active", ignoreSearch: true }).length;
}

function buildCandidateTrackingSearchText(tracking) {
  return [
    tracking.closureType,
    tracking.trackingStatus,
    tracking.screenedAt,
    tracking.submittedAt,
    tracking.rejectedAt,
    tracking.rejectionReason,
    tracking.nextStep,
    tracking.nextStepDate,
    tracking.technicalRating == null ? "" : `technical ${tracking.technicalRating}`,
    tracking.communicationRating == null ? "" : `communication ${tracking.communicationRating}`,
    tracking.overallRating == null ? "" : `overall ${tracking.overallRating}`,
    tracking.ratingNotes
  ].join(" ");
}

function canCurrentUserAccessCandidate(candidate) {
  const user = getCurrentUser();
  if (!user) return true;
  if (canUserAccessFounderWorkspace(user)) return true;

  const role = normalizeUserRole(user.role);
  const recruiterKey = normalizePersonKey(candidate?.recruiter);
  const userNameKey = normalizePersonKey(user.name);
  const userEmailKey = normalizePersonKey(user.email);
  if (role === "TA Manager") {
    const teamMemberKeys = new Set(
      state.users
        .filter((item) => normalizePersonKey(item.manager) === userNameKey || normalizePersonKey(item.manager) === userEmailKey)
        .flatMap((item) => [normalizePersonKey(item.name), normalizePersonKey(item.email)])
        .filter(Boolean)
    );
    return Boolean(recruiterKey && (recruiterKey === userNameKey || recruiterKey === userEmailKey || teamMemberKeys.has(recruiterKey)));
  }

  return Boolean(recruiterKey && (recruiterKey === userNameKey || recruiterKey === userEmailKey));
}

function normalizeCandidateStatus(value) {
  const text = String(value || "").trim().toUpperCase();
  if (text === "DELETED") return "DELETED";
  return "ACTIVE";
}

function isCandidateDeleted(candidate) {
  return normalizeCandidateStatus(candidate?.status) === "DELETED";
}

function filteredUsers() {
  return state.users.filter((item) => inSelectedPeriod(item.createdAt) && matchesSearch(`${item.name} ${item.email} ${item.phone} ${item.role} ${item.status}`));
}

function filteredJobs(options = {}) {
  const includeJobsFilters = Boolean(options.includeJobsFilters);
  const localSearch = String(ui.jobs.search || "").trim().toLowerCase();
  const statusFilter = String(ui.jobs.statusFilter || "all").toLowerCase();
  const clientFilter = String(ui.jobs.clientFilter || "all");

  return state.jobs.filter((item) => {
    if (!inSelectedPeriod(item.createdAt)) return false;
    if (!matchesSearch(`${item.title} ${item.location} ${item.status} ${item.jobType || ""} ${formatJobCommercials(item)} ${(item.requiredSkills || []).join(" ")}`)) return false;
    if (!includeJobsFilters) return true;

    const haystack = `${item.title} ${item.location} ${item.status} ${item.jobType || ""} ${formatJobCommercials(item)} ${(item.requiredSkills || []).join(" ")} ${(item.preferredSkills || []).join(" ")}`
      .toLowerCase()
      .trim();
    if (localSearch && !haystack.includes(localSearch)) return false;

    if (statusFilter !== "all" && !matchesJobStatusFilter(item.status, statusFilter)) return false;
    if (clientFilter !== "all" && String(item.clientId) !== clientFilter) return false;
    return true;
  });
}

function filteredClients() {
  return state.clients.filter((item) => inSelectedPeriod(item.createdAt) && matchesSearch(`${item.name} ${item.industry} ${item.owner}`));
}

function filteredInterviews() {
  return state.interviews.filter((item) => inSelectedPeriod(item.scheduledAt) && matchesSearch(`${item.round} ${item.status} ${item.candidateId} ${item.jobId}`));
}

function filteredPlacements() {
  return state.placements.filter(
    (item) => canCurrentUserAccessPlacement(item) && inSelectedPeriod(item.date) && matchesSearch(`${item.recruiter} ${item.candidateId} ${item.jobId}`)
  );
}

function canCurrentUserAccessPlacement(placement) {
  const user = getCurrentUser();
  if (!user) return true;
  if (canUserAccessFounderWorkspace(user)) return true;
  const recruiterKey = normalizePersonKey(placement?.recruiter);
  return Boolean(recruiterKey && (recruiterKey === normalizePersonKey(user.name) || recruiterKey === normalizePersonKey(user.email)));
}

function inSelectedPeriod(dateText) {
  if (ui.period !== "current-month") return true;
  return isCurrentMonth(dateText);
}

function matchesSearch(text) {
  if (!ui.search) return true;
  return String(text).toLowerCase().includes(ui.search);
}

function stageRank(stage) {
  if (PIPELINE_DISPOSITION_STAGES.has(stage)) return -1;
  return PIPELINE_PROGRESS_RANK.get(stage) ?? 0;
}

function candidateHasReachedStage(candidate, targetStage) {
  const targetRank = stageRank(targetStage);
  if (targetRank < 0) return candidate?.stage === targetStage;
  if (!PIPELINE_DISPOSITION_STAGES.has(candidate?.stage)) {
    return stageRank(candidate?.stage) >= targetRank;
  }

  return getCandidateStageHistory(candidate).some(
    (movement) => stageRank(movement.oldStage) >= targetRank || stageRank(movement.newStage) >= targetRank
  );
}

function normalizeJobStatus(value) {
  const lower = String(value || "DRAFT").trim().toLowerCase().replace(/-/g, "_");
  if (["active", "open", "published"].includes(lower)) return "ACTIVE";
  if (lower === "paused") return "PAUSED";
  if (["hold", "on hold", "on_hold"].includes(lower)) return "ON_HOLD";
  if (lower === "filled") return "FILLED";
  if (["closed", "inactive"].includes(lower)) return "CLOSED";
  if (["cancelled", "canceled"].includes(lower)) return "CANCELLED";
  if (lower === "archived") return "ARCHIVED";
  return "DRAFT";
}

function displayJobStatus(value) {
  return normalizeJobStatus(value)
    .toLowerCase()
    .split("_")
    .map((part) => part ? part[0].toUpperCase() + part.slice(1) : "")
    .join(" ");
}

function isJobStatusActive(value) {
  return normalizeJobStatus(value) === "ACTIVE";
}

function matchesJobStatusFilter(statusValue, filterValue) {
  if (filterValue === "all") return true;
  const normalized = normalizeJobStatus(statusValue).toLowerCase();
  return normalized === filterValue;
}

function createJobDraft(initial = {}) {
  const source = initial && typeof initial === "object" ? initial : {};
  const locations = Array.isArray(source.locations) ? source.locations.map(String) : splitMultiDelimiter(source.location || "");
  const jobType = normalizeJobType(source.jobType);
  return {
    id: source.id ? String(source.id) : "",
    jdText: String(source.jdText || ""),
    title: String(source.title || ""),
    clientId: String(source.clientId || ""),
    locations: uniqueStringsLocal(locations),
    workMode: normalizeWorkModeLabel(source.workMode),
    remoteScope: String(source.remoteScope || "India"),
    country: String(source.country || "India"),
    state: String(source.state || ""),
    city: String(source.city || ""),
    locationEntry: "",
    primaryTimeZone: String(source.primaryTimeZone || "Asia/Kolkata"),
    supportedTimeZones: uniqueStringsLocal(Array.isArray(source.supportedTimeZones) ? source.supportedTimeZones.map(String) : splitMultiDelimiter(source.supportedTimeZones || "")),
    timeZoneEntry: "Asia/Kolkata",
    workingHours: String(source.workingHours || ""),
    minTimeZoneOverlap: source.minTimeZoneOverlap == null ? "" : String(source.minTimeZoneOverlap),
    priority: String(source.priority || "NORMAL").toUpperCase(),
    jobType,
    openings: source.openings == null || source.openings === "" ? "1" : String(source.openings),
    expMin: source.expMin == null ? "" : String(source.expMin),
    expMax: source.expMax == null ? "" : String(source.expMax),
    currency: String(source.currency || "INR"),
    ctcMin: source.ctcMin == null ? "" : String(source.ctcMin),
    ctcMax: source.ctcMax == null ? "" : String(source.ctcMax),
    rateMin: source.rateMin == null ? "" : String(source.rateMin),
    rateMax: source.rateMax == null ? "" : String(source.rateMax),
    billingRateType: normalizeBillingRateType(source.billingRateType || "Monthly"),
    ctcNotDisclosed: Boolean(source.ctcNotDisclosed),
    requiredSkills: uniqueStringsLocal(Array.isArray(source.requiredSkills) ? source.requiredSkills.map(String) : splitComma(source.requiredSkills)),
    preferredSkills: uniqueStringsLocal(Array.isArray(source.preferredSkills) ? source.preferredSkills.map(String) : splitComma(source.preferredSkills))
  };
}

function normalizeWorkModeLabel(value) {
  const normalized = String(value || "Hybrid").trim().toLowerCase();
  if (normalized === "remote") return "Remote";
  if (normalized === "onsite" || normalized === "on-site") return "Onsite";
  return "Hybrid";
}

function addJobLocationFromInput() {
  const input = document.getElementById("jobLocationEntry");
  const location = String(input?.value || ui.jobs.draft.locationEntry || "").trim();
  if (!location) return;
  ui.jobs.draft.locations = uniqueStringsLocal([...(ui.jobs.draft.locations || []), location]);
  ui.jobs.draft.locationEntry = "";
  renderSection();
}

function addJobTimeZoneFromInput() {
  const input = document.getElementById("jobSupportedTimeZoneEntry");
  const timeZone = String(input?.value || ui.jobs.draft.timeZoneEntry || "").trim();
  if (!timeZone) return;
  ui.jobs.draft.supportedTimeZones = uniqueStringsLocal([...(ui.jobs.draft.supportedTimeZones || []), timeZone]);
  renderSection();
}

function renderJobCommercialFields(draft) {
  const jobType = normalizeJobType(draft.jobType);
  const currency = String(draft.currency || "INR");

  if (jobType === "FTE") {
    return `
      <div class="dialog-field">
        <span>Annual Package (LPA)</span>
        <div class="jobs-range">
          <input
            data-action="job-ctc-min"
            type="number"
            min="0"
            step="0.1"
            placeholder="Min LPA"
            value="${escapeHtml(String(draft.ctcMin || ""))}"
            ${draft.ctcNotDisclosed ? "disabled" : ""}
          />
          <span>to</span>
          <input
            data-action="job-ctc-max"
            type="number"
            min="0"
            step="0.1"
            placeholder="Max LPA"
            value="${escapeHtml(String(draft.ctcMax || ""))}"
            ${draft.ctcNotDisclosed ? "disabled" : ""}
          />
        </div>
        <label class="jobs-checkbox">
          <input data-action="job-ctc-not-disclosed" type="checkbox" ${draft.ctcNotDisclosed ? "checked" : ""} />
          <span>Not Disclosed</span>
        </label>
      </div>
    `;
  }

  return `
    <div class="dialog-field">
      <span>${jobType} Billing Rate</span>
      <select data-action="job-billing-rate-type">
        ${BILLING_RATE_TYPE_OPTIONS.map(
          (type) => `<option value="${type}" ${normalizeBillingRateType(draft.billingRateType) === type ? "selected" : ""}>${type} Rate</option>`
        ).join("")}
      </select>
    </div>

    <div class="dialog-field">
      <span>${normalizeBillingRateType(draft.billingRateType)} Rate (${currency})</span>
      <div class="jobs-range">
        <input
          data-action="job-rate-min"
          type="number"
          min="0"
          step="1"
          placeholder="Min"
          value="${escapeHtml(String(draft.rateMin || ""))}"
          ${draft.ctcNotDisclosed ? "disabled" : ""}
        />
        <span>to</span>
        <input
          data-action="job-rate-max"
          type="number"
          min="0"
          step="1"
          placeholder="Max"
          value="${escapeHtml(String(draft.rateMax || ""))}"
          ${draft.ctcNotDisclosed ? "disabled" : ""}
        />
      </div>
      <label class="jobs-checkbox">
        <input data-action="job-ctc-not-disclosed" type="checkbox" ${draft.ctcNotDisclosed ? "checked" : ""} />
        <span>Rate Not Disclosed</span>
      </label>
    </div>
  `;
}

function renderJobSkillChips(skills, skillType) {
  const list = Array.isArray(skills) ? skills : [];
  if (!list.length) {
    return `<span class="panel-subtitle">No skills added yet.</span>`;
  }

  return list
    .map(
      (skill) => `
        <span class="skill-pill">
          ${escapeHtml(skill)}
          <button
            class="jobs-chip-remove"
            type="button"
            data-action="remove-job-skill"
            data-skill-type="${escapeHtml(skillType)}"
            data-skill="${escapeHtml(skill)}"
            aria-label="Remove ${escapeHtml(skill)}"
          >
            ×
          </button>
        </span>
      `
    )
    .join("");
}

function addJobSkillFromInput(skillType) {
  const key = skillType === "preferredSkills" ? "preferredSkills" : "requiredSkills";
  const inputId = key === "preferredSkills" ? "jobPreferredSkillInput" : "jobRequiredSkillInput";
  const input = document.getElementById(inputId);
  if (!input) return;
  const value = String(input.value || "").trim();
  if (!value) return;
  ui.jobs.draft[key] = uniqueStringsLocal([...(ui.jobs.draft[key] || []), value]);
  input.value = "";
  renderSection();
}

function removeJobSkill(skillType, skill) {
  const key = skillType === "preferredSkills" ? "preferredSkills" : "requiredSkills";
  ui.jobs.draft[key] = (ui.jobs.draft[key] || []).filter((item) => String(item).toLowerCase() !== String(skill).toLowerCase());
}

function autofillJobFromJd(draftInput) {
  const draft = createJobDraft(draftInput);
  const jdText = String(draft.jdText || "").trim();
  if (!jdText) return draft;

  const extracted = analyzeJdInput(jdText, "");
  const title = inferJobTitleFromJd(jdText);
  const exp = extractExperienceRangeFromText(jdText);
  const required = extracted.coreSkills.length ? extracted.coreSkills : extracted.requiredTerms.slice(0, 12);
  const preferred = extractPreferredSkillsFromJd(jdText, required);
  const locations = INDIA_CITY_OPTIONS.filter((city) => jdText.toLowerCase().includes(city.toLowerCase()));

  draft.title = draft.title || title;
  draft.expMin = draft.expMin || (exp.min == null ? "" : String(exp.min));
  draft.expMax = draft.expMax || (exp.max == null ? "" : String(exp.max));
  draft.requiredSkills = uniqueStringsLocal([...(draft.requiredSkills || []), ...required]);
  draft.preferredSkills = uniqueStringsLocal([...(draft.preferredSkills || []), ...preferred]);
  if (!draft.locations.length && locations.length) {
    draft.locations = locations;
  }

  const lower = jdText.toLowerCase();
  if (lower.includes("remote")) draft.workMode = "Remote";
  if (lower.includes("hybrid")) draft.workMode = "Hybrid";
  if (lower.includes("onsite") || lower.includes("on-site")) draft.workMode = "Onsite";

  if (/\bc2h\b|contract\s*to\s*hire|contract-to-hire/.test(lower)) draft.jobType = "C2H";
  else if (/\bc2c\b|contract|corp\s*to\s*corp|corp-to-corp/.test(lower)) draft.jobType = "C2C";
  else if (lower.includes("full time") || lower.includes("full-time") || lower.includes("permanent")) draft.jobType = "FTE";
  if (lower.includes("hourly") || lower.includes("per hour")) draft.billingRateType = "Hourly";
  if (lower.includes("monthly") || lower.includes("per month")) draft.billingRateType = "Monthly";

  return draft;
}

function inferJobTitleFromJd(jdText) {
  const lines = String(jdText || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return "";

  const directLine = lines.find((line) => /(engineer|developer|manager|analyst|designer|recruiter|specialist|architect)/i.test(line));
  if (directLine) {
    return directLine.replace(/^job title\s*[:\-]?\s*/i, "").slice(0, 80);
  }

  const sentenceMatch = String(jdText).match(/(?:looking for|hiring|position for)\s+(?:an?\s+)?([a-z0-9\s/+.-]{4,70})/i);
  if (sentenceMatch) return toTitleCase(sentenceMatch[1]).slice(0, 80);
  return "";
}

function extractExperienceRangeFromText(text) {
  const source = String(text || "");
  const rangeMatch = source.match(/(\d+(?:\.\d+)?)\s*(?:-|to)\s*(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years|year|yrs|yr)/i);
  if (rangeMatch) {
    return {
      min: Number(rangeMatch[1]),
      max: Number(rangeMatch[2])
    };
  }
  const min = extractExperienceFromText(source);
  return { min, max: null };
}

function extractPreferredSkillsFromJd(jdText, requiredSkills) {
  const lower = String(jdText || "").toLowerCase();
  const preferredSectionMatch = lower.match(/(?:nice to have|preferred skills|good to have)([\s\S]{0,400})/i);
  if (!preferredSectionMatch) return [];
  const preferredTerms = uniqueStringsLocal(extractCatalogSkills(preferredSectionMatch[1]));
  const requiredSet = new Set((requiredSkills || []).map((item) => String(item).toLowerCase()));
  return preferredTerms.filter((item) => !requiredSet.has(String(item).toLowerCase()));
}

async function submitJobDraft(targetStatus) {
  if (ui.jobs.isSaving) return;
  const draft = ui.jobs.draft;
  const title = String(draft.title || "").trim();
  const openings = Number(draft.openings || 1);
  const clientId = String(draft.clientId || "");
  if (!title) {
    alert("Job title is required.");
    return;
  }
  if (!clientId) {
    alert("Please select a client.");
    return;
  }

  const jobType = normalizeJobType(draft.jobType);
  const isFte = jobType === "FTE";
  const body = {
    title,
    jdText: String(draft.jdText || "").trim(),
    clientId,
    locations: uniqueStringsLocal(draft.locations || []),
    location: uniqueStringsLocal(draft.locations || []).join(", "),
    workMode: String(draft.workMode || "Hybrid"),
    jobType,
    status: draft.id
      ? normalizeJobStatus(findById(state.jobs, draft.id)?.status)
      : normalizeJobStatus(targetStatus),
    openings: Number.isFinite(openings) && openings > 0 ? openings : 1,
    expMin: draft.expMin === "" ? "" : Number(draft.expMin),
    expMax: draft.expMax === "" ? "" : Number(draft.expMax),
    currency: String(draft.currency || "INR"),
    ctcMin: !isFte || draft.ctcNotDisclosed || draft.ctcMin === "" ? "" : Number(draft.ctcMin),
    ctcMax: !isFte || draft.ctcNotDisclosed || draft.ctcMax === "" ? "" : Number(draft.ctcMax),
    rateMin: isFte || draft.ctcNotDisclosed || draft.rateMin === "" ? "" : Number(draft.rateMin),
    rateMax: isFte || draft.ctcNotDisclosed || draft.rateMax === "" ? "" : Number(draft.rateMax),
    billingRateType: normalizeBillingRateType(draft.billingRateType),
    ctcNotDisclosed: Boolean(draft.ctcNotDisclosed),
    requiredSkills: uniqueStringsLocal(draft.requiredSkills || []),
    preferredSkills: uniqueStringsLocal(draft.preferredSkills || []),
    remoteScope: String(draft.remoteScope || ""),
    country: String(draft.country || ""),
    state: String(draft.state || ""),
    city: String(draft.city || ""),
    primaryTimeZone: String(draft.primaryTimeZone || ""),
    supportedTimeZones: uniqueStringsLocal(draft.supportedTimeZones || []),
    workingHours: String(draft.workingHours || ""),
    minTimeZoneOverlap: draft.minTimeZoneOverlap === "" ? null : Number(draft.minTimeZoneOverlap),
    priority: String(draft.priority || "NORMAL")
  };

  ui.jobs.isSaving = true;
  renderSection();
  try {
    const editing = Boolean(draft.id);
    const payload = await jobsApiRequest(editing ? API_ROUTES.job(draft.id) : API_ROUTES.jobs, {
      method: editing ? "PATCH" : "POST",
      body
    });
    const job = payload?.data?.job;
    if (!job) throw new Error("The Jobs API did not return the saved job.");
    replaceJobInState(job);
    recordActivity("job", `Job ${editing ? "updated" : "created"}: ${job.title} (${displayJobStatus(job.status)})`);
    ui.jobs.mode = "list";
    ui.jobs.draft = createJobDraft();
    invalidateJobInsights();
    saveState(state);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Unable to save the job.");
  } finally {
    ui.jobs.isSaving = false;
    renderSection();
  }
}

async function jobsApiRequest(path, options = {}) {
  const response = await fetch(buildApiUrl(path), {
    method: options.method || "GET",
    headers: getAuthHeaders({
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {})
    }),
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message || `Jobs request failed with HTTP ${response.status}`);
  }
  return payload;
}

function replaceJobInState(job) {
  const index = state.jobs.findIndex((item) => String(item.id) === String(job.id));
  if (index >= 0) state.jobs[index] = job;
  else state.jobs.unshift(job);
}

function invalidateJobInsights() {
  ui.jobs.insights = null;
  ui.jobs.insightsError = "";
}

async function loadJobInsights() {
  if (ui.jobs.insightsLoading || Array.isArray(ui.jobs.insights)) return;
  ui.jobs.insightsLoading = true;
  ui.jobs.insightsError = "";
  renderSection();
  try {
    const payload = await jobsApiRequest(API_ROUTES.jobInsights);
    ui.jobs.insights = Array.isArray(payload?.data?.insights) ? payload.data.insights : [];
  } catch (error) {
    ui.jobs.insightsError = error instanceof Error ? error.message : "Unable to load demand insights.";
  } finally {
    ui.jobs.insightsLoading = false;
    renderSection();
  }
}

async function changeJobStatusViaApi(jobId, status) {
  const job = findById(state.jobs, jobId);
  if (!job || normalizeJobStatus(job.status) === normalizeJobStatus(status)) return;
  const needsReason = ["PAUSED", "ON_HOLD", "CLOSED", "CANCELLED", "ARCHIVED"].includes(normalizeJobStatus(status));
  const reason = needsReason ? prompt(`Reason for changing this job to ${displayJobStatus(status)}:`) : "";
  if (needsReason && (!reason || !reason.trim())) {
    renderSection();
    return;
  }
  try {
    const payload = await jobsApiRequest(API_ROUTES.jobStatus(jobId), { method: "POST", body: { status, reason } });
    replaceJobInState(payload.data.job);
    invalidateJobInsights();
    saveState(state);
    renderSection();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Unable to change job status.");
    renderSection();
  }
}

async function archiveJobViaApi(jobId) {
  const job = findById(state.jobs, jobId);
  if (!job) return;
  const reason = prompt(`Why are you archiving “${job.title}”?`);
  if (!reason || !reason.trim()) return;
  try {
    const payload = await jobsApiRequest(API_ROUTES.jobArchive(jobId), { method: "POST", body: { reason } });
    replaceJobInState(payload.data.job);
    invalidateJobInsights();
    saveState(state);
    renderSection();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Unable to archive the job.");
  }
}

async function duplicateJobViaApi(jobId) {
  try {
    const payload = await jobsApiRequest(API_ROUTES.jobDuplicate(jobId), { method: "POST", body: {} });
    replaceJobInState(payload.data.job);
    ui.jobs.draft = createJobDraft(payload.data.job);
    ui.jobs.mode = "create";
    invalidateJobInsights();
    saveState(state);
    renderSection();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Unable to duplicate the job.");
  }
}

async function permanentlyDeleteJobViaApi(jobId) {
  const job = findById(state.jobs, jobId);
  if (!job) return;
  const confirmation = prompt(`Permanent deletion is only allowed when no candidates, submissions, or interviews are linked. Type the exact job title to continue:\n\n${job.title}`);
  if (confirmation === null) return;
  try {
    await jobsApiRequest(API_ROUTES.job(jobId), { method: "DELETE", body: { confirmation } });
    state.jobs = state.jobs.filter((item) => String(item.id) !== String(jobId));
    invalidateJobInsights();
    saveState(state);
    renderSection();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Unable to delete the job.");
  }
}

async function createCandidatePoolFromJob(jobId) {
  try {
    const payload = await jobsApiRequest(API_ROUTES.jobCandidatePool(jobId), { method: "POST", body: {} });
    const pool = payload.data.pool;
    alert(`Candidate pool “${pool.name}” created with ${pool.memberCount} matching candidate(s). Existing candidate records were not moved or changed.`);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Unable to create the candidate pool.");
  }
}

async function createCandidatePoolFromInsight(key) {
  try {
    const payload = await jobsApiRequest(API_ROUTES.insightCandidatePool, { method: "POST", body: { key } });
    const pool = payload.data.pool;
    alert(`Proactive pool “${pool.name}” created with ${pool.memberCount} matching candidate(s).`);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Unable to create the candidate pool.");
  }
}

async function loadJobAudit(jobId) {
  ui.jobs.auditJobId = jobId;
  ui.jobs.auditEntries = [];
  ui.jobs.auditLoading = true;
  renderSection();
  try {
    const payload = await jobsApiRequest(API_ROUTES.job(jobId));
    ui.jobs.auditEntries = Array.isArray(payload?.data?.audit) ? payload.data.audit : [];
  } catch (error) {
    alert(error instanceof Error ? error.message : "Unable to load job history.");
    ui.jobs.auditJobId = "";
  } finally {
    ui.jobs.auditLoading = false;
    renderSection();
  }
}

async function handleBulkUploadFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length || ui.bulkUpload.isProcessing) return;

  const { validFiles, rejectedResults } = validateBulkUploadFiles(files);

  if (!validFiles.length) {
    recordActivity("bulk-upload", "Bulk upload rejected due to invalid file types or size limits");
    appendRejectedBulkResults(rejectedResults, true);
    return;
  }

  ui.bulkUpload.isProcessing = true;
  renderSection();

  try {
    if (!ui.api.connected) {
      appendRejectedBulkResults(
        validFiles.map((file) => ({
          fileName: file.name,
          kind: (getFileExtension(file.name) || "Unknown").toUpperCase(),
          status: "Failed",
          added: 0,
          message: "Backend database unavailable; upload was not saved"
        })),
        true
      );
      alert("Bulk upload requires the backend database. No local-only candidates were saved.");
      return;
    }

    try {
      await handleBulkUploadViaBackend(validFiles);
    } catch (error) {
      ui.api.connected = false;
      ui.api.message = "Backend disconnected";
      renderApiStatus();
      appendRejectedBulkResults(
        validFiles.map((file) => ({
          fileName: file.name,
          kind: (getFileExtension(file.name) || "Unknown").toUpperCase(),
          status: "Failed",
          added: 0,
          message: error instanceof Error ? error.message : "Backend parse failed; upload was not saved"
        })),
        true
      );
      alert("Bulk upload failed before database save. No local-only candidates were created.");
      return;
    }

    if (rejectedResults.length) {
      appendRejectedBulkResults(rejectedResults, false);
    }
  } finally {
    ui.bulkUpload.isProcessing = false;
    renderSection();
  }
}

async function requestBulkUploadBackend(files, options = {}) {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });
  if (options.previewOnly) formData.append("previewOnly", "true");

  const response = await fetch(buildApiUrl(API_ROUTES.parseBulkUpload), {
    method: "POST",
    headers: getAuthHeaders(),
    body: formData
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message || "Backend parse failed");
  }

  return payload;
}

async function previewBulkImport(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length || ui.bulkUpload.isPreviewing) return;
  const spreadsheetFiles = files.filter((file) => ["csv", "xlsx"].includes(getFileExtension(file.name).toLowerCase()));
  if (spreadsheetFiles.length !== files.length) {
    alert("Import preview accepts CSV and XLSX files only.");
    return;
  }
  if (!ui.api.connected) {
    alert("Import preview requires the backend database connection.");
    return;
  }
  ui.bulkUpload.isPreviewing = true;
  renderSection();
  try {
    const payload = await requestBulkUploadBackend(spreadsheetFiles, { previewOnly: true });
    ui.bulkUpload.pendingImportFiles = spreadsheetFiles;
    ui.bulkUpload.preview = payload;
    recordActivity("bulk-upload", `Previewed ${spreadsheetFiles.length} spreadsheet file(s); no records saved`);
  } catch (error) {
    alert(error instanceof Error ? error.message : "Import preview failed.");
  } finally {
    ui.bulkUpload.isPreviewing = false;
    renderSection();
  }
}

async function handleBulkUploadViaBackend(files) {
  const payload = await requestBulkUploadBackend(files);

  const addedCandidates = Array.isArray(payload.addedCandidates) ? payload.addedCandidates.map(mapApiCandidateToLocal) : [];
  const duplicates = Array.isArray(payload.duplicates)
    ? payload.duplicates.map((group) => ({
        duplicateCandidate: mapApiCandidateToLocal(group.duplicateCandidate),
        matchedCandidates: Array.isArray(group.matchedCandidates)
          ? group.matchedCandidates.map((item) => mapApiCandidateToLocal(item))
          : [],
        reason: String(group.reason || "Potential duplicate")
      }))
    : [];
  const blockedDuplicates = Array.isArray(payload.blockedDuplicates)
    ? payload.blockedDuplicates.map((candidate) => ({
        name: String(candidate?.name || "Unknown"),
        email: String(candidate?.email || ""),
        phone: String(candidate?.phone || ""),
        reason: String(candidate?.reason || "Blocked duplicate")
      }))
    : [];

  applyNewCandidates(addedCandidates);

  const summary = payload.summary || {};
  const newResults = Array.isArray(payload.results) ? payload.results : [];

  state.bulkUpload = {
    totalFiles: Number(summary.totalFiles || files.length),
    pending: Number(summary.pending || 0),
    completed: Number(summary.completed || 0),
    failed: Number(summary.failed || 0),
    blockedCount: Number(summary.duplicateCandidates || blockedDuplicates.length),
    lastRunAt: new Date().toISOString(),
    results: [...newResults, ...(state.bulkUpload?.results || [])].slice(0, 120),
    duplicates,
    blockedDuplicates: [...blockedDuplicates, ...(state.bulkUpload?.blockedDuplicates || [])].slice(0, 120),
    candidateNotes: [...addedCandidates, ...(state.bulkUpload?.candidateNotes || [])].slice(0, 120)
  };

  if (addedCandidates.length) {
    recordActivity("bulk-upload", `Bulk upload added ${addedCandidates.length} candidate(s) via backend parser`);
  } else if (blockedDuplicates.length) {
    recordActivity("bulk-upload", `Bulk upload blocked ${blockedDuplicates.length} duplicate candidate(s)`);
  } else {
    recordActivity("bulk-upload", "Bulk upload processed via backend with no new candidates");
  }

  saveAndRender();
  void refreshPendingDuplicatesFromBackend();
}

async function handleBulkUploadLocal(files) {
  const summary = {
    totalFiles: files.length,
    pending: files.length,
    completed: 0,
    failed: 0,
    lastRunAt: new Date().toISOString(),
    results: []
  };

  const createdCandidates = [];
  const duplicateGroups = [];

  for (const file of files) {
    const extension = getFileExtension(file.name);

    if (file.size > BULK_MAX_FILE_SIZE) {
      summary.failed += 1;
      summary.pending -= 1;
      summary.results.push({
        fileName: file.name,
        kind: extension.toUpperCase() || "Unknown",
        status: "Failed",
        added: 0,
        message: "File exceeds 10MB limit"
      });
      continue;
    }

    try {
      if (extension === "csv") {
        const text = await readFileAsText(file);
        const csvCandidates = parseCsvToCandidates(text, file.name);
        const { addedCount, duplicateCount } = processParsedCandidates(csvCandidates, createdCandidates, duplicateGroups);

        summary.completed += 1;
        summary.pending -= 1;
        summary.results.push({
          fileName: file.name,
          kind: "CSV",
          status: "Completed",
          added: addedCount,
          message: `Parsed ${csvCandidates.length} row(s), ${duplicateCount} duplicate(s)`
        });
        continue;
      }

      if (BULK_CV_EXTENSIONS.has(extension)) {
        const { candidate: parsedCandidate, parseMode } = await parseLocalResumeCandidate(file);
        const { addedCount, duplicateCount } = processParsedCandidates([parsedCandidate], createdCandidates, duplicateGroups);

        summary.completed += 1;
        summary.pending -= 1;
        summary.results.push({
          fileName: file.name,
          kind: extension.toUpperCase(),
          status: "Completed",
          added: addedCount,
          message: duplicateCount
            ? "Detected duplicate candidate"
            : parseMode === "text"
              ? "Resume text parsed and candidate auto-synced"
              : "Profile auto-created from filename"
        });
        continue;
      }

      summary.failed += 1;
      summary.pending -= 1;
      summary.results.push({
        fileName: file.name,
        kind: extension.toUpperCase() || "Unknown",
        status: "Failed",
        added: 0,
        message: "Unsupported file format"
      });
    } catch (error) {
      summary.failed += 1;
      summary.pending -= 1;
      summary.results.push({
        fileName: file.name,
        kind: extension.toUpperCase() || "Unknown",
        status: "Failed",
        added: 0,
        message: "Could not parse file"
      });
    }
  }

  applyNewCandidates(createdCandidates);

  state.bulkUpload = {
    totalFiles: summary.totalFiles,
    pending: summary.pending,
    completed: summary.completed,
    failed: summary.failed,
    lastRunAt: summary.lastRunAt,
    results: [...summary.results, ...(state.bulkUpload?.results || [])].slice(0, 120),
    duplicates: [...duplicateGroups, ...(state.bulkUpload?.duplicates || [])].slice(0, 120),
    candidateNotes: [...createdCandidates, ...(state.bulkUpload?.candidateNotes || [])].slice(0, 120)
  };

  if (createdCandidates.length) {
    recordActivity("bulk-upload", `Bulk upload added ${createdCandidates.length} candidate(s) via offline parser`);
  } else {
    recordActivity("bulk-upload", "Bulk upload processed with no new candidates");
  }

  saveAndRender();
}

function openBulkPicker(kind = "all") {
  const inputId = kind === "cv" ? "bulkUploadCvInput" : kind === "csv" ? "bulkUploadCsvInput" : "bulkUploadInput";
  const input = document.getElementById(inputId);
  if (input) {
    input.click();
  }
}

function downloadBulkTemplate() {
  const template = [
    "name,email,phone,current role,experience years,skills,location,current company,education,summary",
    "\"Aarav Sharma\",aarav.sharma@example.com,+91-9876543210,\"Senior Recruiter\",\"6 years\",\"Recruitment|Sourcing|Stakeholder Management\",Pune,\"Agodly ATS\",\"MBA\",\"Handled volume hiring across IT and non-IT roles\"",
    "\"Neha Iyer\",neha.iyer@example.com,+91-9988776655,\"Backend Engineer\",\"5 years\",\"Node.js|TypeScript|PostgreSQL\",Bengaluru,\"TechBridge\",\"B.Tech\",\"Built hiring workflow APIs and integrations\""
  ].join("\n");

  const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "agodly_bulk_upload_template.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  recordActivity("bulk-upload", "CSV template downloaded");
  saveState(state);
}

function validateBulkUploadFiles(files) {
  const validFiles = [];
  const rejectedResults = [];

  files.forEach((file) => {
    const extension = getFileExtension(file.name);
    const kind = extension.toUpperCase() || "Unknown";

    if (!BULK_ALLOWED_EXTENSIONS.has(extension)) {
      rejectedResults.push({
        fileName: file.name,
        kind,
        status: "Failed",
        added: 0,
        message: "Unsupported file format. Allowed: CSV, PDF, DOC, DOCX"
      });
      return;
    }

    if (file.size > BULK_MAX_FILE_SIZE) {
      rejectedResults.push({
        fileName: file.name,
        kind,
        status: "Failed",
        added: 0,
        message: "File exceeds 10MB limit"
      });
      return;
    }

    validFiles.push(file);
  });

  return { validFiles, rejectedResults };
}

function appendRejectedBulkResults(rejectedResults, resetSummary) {
  if (!Array.isArray(rejectedResults) || !rejectedResults.length) return;

  const current = normalizeBulkUpload(state.bulkUpload);
  const base = resetSummary
    ? {
        ...current,
        totalFiles: 0,
        pending: 0,
        completed: 0,
        failed: 0,
        lastRunAt: new Date().toISOString()
      }
    : current;

  state.bulkUpload = {
    ...base,
    totalFiles: Number(base.totalFiles || 0) + rejectedResults.length,
    pending: 0,
    failed: Number(base.failed || 0) + rejectedResults.length,
    lastRunAt: new Date().toISOString(),
    results: [...rejectedResults, ...(base.results || [])].slice(0, 120)
  };

  saveAndRender();
}

function processParsedCandidates(parsedCandidates, createdCandidates, duplicateGroups) {
  let addedCount = 0;
  let duplicateCount = 0;

  parsedCandidates.forEach((candidate) => {
    const attributedCandidate = attributeLocalBulkUploadCandidate(candidate);
    const matches = findLocalDuplicateMatches(attributedCandidate, [...state.candidates, ...createdCandidates]);
    if (matches.length) {
      duplicateCount += 1;
      duplicateGroups.push({
        duplicateCandidate: attributedCandidate,
        matchedCandidates: matches,
        reason: buildDuplicateReasonLocal(candidate, matches)
      });
      return;
    }

    createdCandidates.push(attributedCandidate);
    addedCount += 1;
  });

  return { addedCount, duplicateCount };
}

function attributeLocalBulkUploadCandidate(candidate) {
  const currentUser = getCurrentUser();
  const uploaderName = String(currentUser?.name || "").trim() || String(currentUser?.email || "").trim() || "Unknown User";
  const parsedData = candidate?.parsedData && typeof candidate.parsedData === "object" && !Array.isArray(candidate.parsedData)
    ? candidate.parsedData
    : {};

  return {
    ...candidate,
    recruiter: uploaderName,
    parsedData: {
      ...parsedData,
      uploadedBy: uploaderName,
      uploadedByUserId: currentUser?.id || "",
      uploadedAt: new Date().toISOString()
    }
  };
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Read failed"));
    reader.readAsText(file);
  });
}

function parseCsvToCandidates(text, fileName) {
  const rows = parseCsv(text);
  if (!rows.length) return [];

  return rows
    .map((row, index) => createCandidateFromCsvRow(row, fileName, index))
    .filter(Boolean);
}

function parseCsv(text) {
  const lines = String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((item) => normalizeHeader(item));
  const rows = [];

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    if (!values.length) continue;
    const row = {};

    headers.forEach((header, index) => {
      row[header] = String(values[index] || "").trim();
    });

    rows.push(row);
  }

  return rows;
}

function parseCsvLine(line) {
  const output = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        current += "\"";
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      output.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  output.push(current.trim());
  return output;
}

function createCandidateFromCsvRow(row, fileName, index) {
  const get = (...keys) => {
    for (const key of keys) {
      const normalized = normalizeHeader(key);
      if (row[normalized]) return row[normalized];
    }
    return "";
  };

  const email = get("email", "email id", "mail");
  const phone = get("phone", "mobile", "phone number", "contact");
  const name = get("name", "candidate name", "full name") || deriveNameFromEmail(email) || `Candidate ${index + 1}`;
  const stage = get("stage", "status");
  const skillsRaw = get("skills", "skill", "technologies");
  const profileSummary = get("summary", "profile summary", "about", "objective");
  const location = get("location", "city");
  const education = get("education", "qualification");
  const currentCompany = get("current company", "company");
  const linkedin = get("linkedin", "linkedin profile", "linkedin url", "profile link");
  const experienceYears = extractExperienceFromText(get("experience", "experience years", "exp"));
  const currentRoleRaw = get("current role", "role", "designation", "title", "job title");
  const inferredRole = inferCurrentRoleFromText(`${currentRoleRaw} ${skillsRaw} ${profileSummary}`);

  if (!name && !email && !phone) return null;

  return {
    id: uid("cand"),
    name: cleanText(name),
    email: cleanText(email),
    phone: cleanText(phone),
    linkedin: normalizeLinkedInUrl(linkedin),
    skills: splitMultiDelimiter(skillsRaw),
    source: cleanText(get("source")) || `CSV Upload (${fileName})`,
    recruiter: cleanText(get("recruiter", "owner")) || "Bulk Upload",
    stage: PIPELINE_STAGES.includes(stage) ? stage : "Identified",
    jobId: cleanText(get("jobid", "job id", "job", "position id")),
    createdAt: todayISO(),
    profileSummary: cleanText(profileSummary),
    keywords: extractCatalogSkills(`${skillsRaw} ${profileSummary}`),
    experienceYears,
    currentRole: cleanText(currentRoleRaw) || inferredRole,
    location: cleanText(location),
    education: cleanText(education),
    currentCompany: cleanText(currentCompany),
    parsedData: {
      linkedin: normalizeLinkedInUrl(linkedin)
    }
  };
}

function createCandidateFromResumeFile(file) {
  const rawName = file.name.replace(/\.[^.]+$/, "");
  const emailMatch = rawName.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = rawName.match(/(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){9,14}/);

  const stripped = rawName
    .replace(emailMatch?.[0] || "", "")
    .replace(phoneMatch?.[0] || "", "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const inferredRole = inferCurrentRoleFromText(rawName);
  const inferredSkills = inferCandidateSkillsFromText(rawName);
  const inferredExperience = extractExperienceFromText(rawName);
  const summaryBits = [
    `Uploaded resume: ${file.name}`,
    inferredRole ? `Role: ${inferredRole}` : "",
    inferredExperience != null ? `Experience: ${inferredExperience} years` : "",
    inferredSkills.length ? `Skills: ${inferredSkills.join(", ")}` : ""
  ].filter(Boolean);

  return {
    id: uid("cand"),
    name: stripped || "Unknown Candidate",
    email: emailMatch ? emailMatch[0] : "",
    phone: phoneMatch ? phoneMatch[0].replace(/\s+/g, " ").trim() : "",
    linkedin: "",
    skills: inferredSkills,
    source: `Resume Upload (${file.name})`,
    recruiter: "Bulk Upload",
    stage: "Identified",
    jobId: "",
    createdAt: todayISO(),
    profileSummary: summaryBits.join(" | "),
    keywords: uniqueStringsLocal([
      ...extractCatalogSkills(rawName),
      ...inferredSkills.map((item) => String(item).toLowerCase())
    ]),
    experienceYears: inferredExperience,
    currentRole: inferredRole,
    location: "",
    education: "",
    currentCompany: "",
    parsedData: {
      originalResume: {
        fileName: file.name,
        fileType: getFileExtension(file.name).toUpperCase()
      }
    }
  };
}

async function parseLocalResumeCandidate(file) {
  const extension = getFileExtension(file?.name);
  if (!file || !extension) {
    return { candidate: createCandidateFromResumeFile(file || { name: "resume" }), parseMode: "filename" };
  }

  try {
    let rawText = "";

    if (extension === "pdf") {
      rawText = await extractPdfTextFromFile(file);
    } else if (extension === "docx") {
      rawText = await extractDocxTextFromFile(file);
    } else if (extension === "doc") {
      rawText = await extractDocBinaryTextFromFile(file);
    }

    const cleaned = cleanResumeText(rawText);
    if (!cleaned) {
      return { candidate: createCandidateFromResumeFile(file), parseMode: "filename" };
    }

    return {
      candidate: extractCandidateFromResumeText(cleaned, file.name),
      parseMode: "text"
    };
  } catch (_error) {
    return { candidate: createCandidateFromResumeFile(file), parseMode: "filename" };
  }
}

async function extractPdfTextFromFile(file) {
  if (!window?.pdfjsLib) return "";

  const workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
  if (window.pdfjsLib.GlobalWorkerOptions && !window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
  }

  const data = await file.arrayBuffer();
  const document = await window.pdfjsLib.getDocument({ data }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const line = (content.items || [])
      .map((item) => String(item?.str || "").trim())
      .filter(Boolean)
      .join(" ");
    if (line) pages.push(line);
  }

  return pages.join("\n");
}

async function extractDocxTextFromFile(file) {
  if (!window?.mammoth?.extractRawText) return "";
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return String(result?.value || "");
}

async function extractDocBinaryTextFromFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const text = new TextDecoder("latin1").decode(arrayBuffer);
  return text
    .replace(/[^\x20-\x7E\r\n\t]/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function extractCandidateFromResumeText(resumeText, fileName) {
  const text = cleanResumeText(resumeText);
  const lines = text
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter((line) => line.length > 1);

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = text.match(/(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){9,14}/);
  const linkedin = extractLinkedInFromText(text);
  const experienceYears = extractExperienceFromText(text);
  const skills = inferCandidateSkillsFromText(`${text} ${fileName}`);
  const currentRole = findLikelyRoleFromLines(lines) || inferCurrentRoleFromText(`${text} ${fileName}`);
  const location = findLikelyLocationFromLines(lines);
  const education = findLikelyEducationFromLines(lines);
  const currentCompany = findLikelyCompanyFromLines(lines);
  const name = findLikelyNameFromLines(lines, fileName);
  const profileSummary = buildResumeSummary(text, currentRole, skills, experienceYears);

  return {
    id: uid("cand"),
    name,
    email: emailMatch ? emailMatch[0] : "",
    phone: phoneMatch ? phoneMatch[0].replace(/\s+/g, " ").trim() : "",
    linkedin,
    skills,
    source: `Resume Upload (${fileName})`,
    recruiter: "Bulk Upload",
    stage: "Identified",
    jobId: "",
    createdAt: todayISO(),
    profileSummary,
    keywords: uniqueStringsLocal([...extractCatalogSkills(text), ...skills.map((item) => String(item).toLowerCase())]),
    experienceYears,
    currentRole,
    location,
    education,
    currentCompany,
    parsedData: {
      linkedin,
      originalResume: {
        fileName,
        fileType: getFileExtension(fileName).toUpperCase()
      }
    }
  };
}

function cleanResumeText(value) {
  return String(value || "")
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildResumeSummary(text, currentRole, skills, experienceYears) {
  const snippets = [
    currentRole ? `Role: ${currentRole}` : "",
    experienceYears != null ? `Experience: ${experienceYears} years` : "",
    Array.isArray(skills) && skills.length ? `Skills: ${skills.slice(0, 12).join(", ")}` : ""
  ].filter(Boolean);

  if (snippets.length) return snippets.join(" | ");
  return cleanResumeText(text).slice(0, 240);
}

function findLikelyNameFromLines(lines, fileName) {
  for (const line of (Array.isArray(lines) ? lines : []).slice(0, 14)) {
    if (/@/.test(line)) continue;
    if (/resume|curriculum|vitae|profile/i.test(line)) continue;
    if (line.length < 3 || line.length > 60) continue;
    const words = line.split(/\s+/g).filter(Boolean);
    if (words.length < 2 || words.length > 5) continue;
    if (words.some((word) => /\d/.test(word))) continue;
    return line;
  }

  return deriveCandidateNameFromFileName(fileName);
}

function findLikelyRoleFromLines(lines) {
  for (const line of (Array.isArray(lines) ? lines : []).slice(0, 30)) {
    const role = inferCurrentRoleFromText(line);
    if (role) return role;
  }
  return "";
}

function findLikelyLocationFromLines(lines) {
  const pattern = /\b([A-Za-z]{3,}(?:\s+[A-Za-z]{2,}){0,2},\s*[A-Za-z]{2,})\b/;
  for (const line of (Array.isArray(lines) ? lines : []).slice(0, 25)) {
    const match = line.match(pattern);
    if (match) return match[1].trim();
  }
  return "";
}

function findLikelyEducationFromLines(lines) {
  const pattern = /\b(B\.?Tech|M\.?Tech|BCA|MCA|MBA|BSc|MSc|Bachelor|Master|PhD)\b/i;
  for (const line of (Array.isArray(lines) ? lines : []).slice(0, 45)) {
    if (pattern.test(line)) return line.trim();
  }
  return "";
}

function findLikelyCompanyFromLines(lines) {
  const pattern = /(current company|present company|currently at|company)\s*[:\-]?\s*(.+)$/i;
  for (const line of (Array.isArray(lines) ? lines : []).slice(0, 40)) {
    const match = line.match(pattern);
    if (match && String(match[2] || "").trim()) return String(match[2]).trim();
  }
  return "";
}

function deriveCandidateNameFromFileName(fileName) {
  const raw = String(fileName || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return raw || "Unknown Candidate";
}

function candidateIdentityKey(candidate) {
  const email = String(candidate.email || "").trim().toLowerCase();
  const phone = String(candidate.phone || "").replace(/\D/g, "");
  const name = String(candidate.name || "").trim().toLowerCase();

  if (email) return `email:${email}`;
  if (phone) return `phone:${phone}`;
  if (name) return `id:${String(candidate.id || "").trim() || name}`;
  return `id:${String(candidate.id || uid("cand")).trim()}`;
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

function deriveNameFromEmail(email) {
  const clean = String(email || "").trim();
  if (!clean.includes("@")) return "";
  return clean
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitMultiDelimiter(value) {
  if (!value) return [];
  return String(value)
    .split(/[|,;/]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function tokenizeToTerms(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+.#/\s-]/g, " ")
    .split(/\s+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractCatalogSkills(text) {
  const lower = String(text || "").toLowerCase();
  return uniqueStringsLocal(AI_SKILL_CATALOG.filter((skill) => lower.includes(String(skill).toLowerCase())));
}

function extractSkillsFromFilename(text) {
  const lower = String(text || "").toLowerCase();
  return uniqueStringsLocal(
    FILENAME_SKILL_HINTS.filter((skill) => lower.includes(String(skill).toLowerCase())).map((item) => String(item))
  );
}

function inferCandidateSkillsFromText(text) {
  return uniqueStringsLocal([...extractCatalogSkills(text), ...extractSkillsFromFilename(text)]);
}

function extractExperienceFromText(text) {
  const match = String(text || "").match(/(\d+(?:\.\d+)?)\s*(?:\+)?\s*(?:years|year|yrs|yr)/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractLinkedInFromText(text) {
  const match = String(text || "").match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9%._/-]+/i);
  return normalizeLinkedInUrl(match?.[0] || "");
}

function uniqueStringsLocal(items) {
  const seen = new Set();
  const output = [];

  items.forEach((item) => {
    const clean = String(item || "").trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    output.push(clean);
  });

  return output;
}

function inferCurrentRoleFromText(value) {
  const text = String(value || "").toLowerCase();
  if (!text) return "";

  const directMatch = ROLE_HINTS.find((role) => text.includes(role));
  if (directMatch) return toTitleCase(directMatch);

  if (text.includes("engineer")) return "Software Engineer";
  if (text.includes("developer")) return "Software Developer";
  if (text.includes("recruit")) return "Recruiter";
  if (text.includes("designer")) return "Designer";
  if (text.includes("manager")) return "Manager";
  if (text.includes("analyst")) return "Analyst";

  return "";
}

function getCandidateCurrentRole(candidate) {
  const role = String(candidate?.currentRole || "").trim();
  if (role) return role;
  return inferCurrentRoleFromText(`${candidate?.profileSummary || ""} ${(candidate?.skills || []).join(" ")}`);
}

function roundTo(value, digits) {
  const factor = 10 ** Number(digits || 0);
  return Math.round(Number(value || 0) * factor) / factor;
}

function confidenceBadge(label) {
  const colorClass = label === "High" ? "green" : label === "Medium" ? "yellow" : "red";
  return `<span class="badge ${colorClass}">${escapeHtml(label)}</span>`;
}

function getConfidenceLabel(score, matchedMustHaveCount, mustHaveCount, experienceGapYears) {
  const mustHaveCoverage = mustHaveCount ? matchedMustHaveCount / mustHaveCount : 1;

  if (score >= 80 && mustHaveCoverage >= 0.65 && experienceGapYears <= 0) {
    return "High";
  }

  if (score >= 55 && mustHaveCoverage >= 0.35 && experienceGapYears <= 2) {
    return "Medium";
  }

  return "Low";
}

function buildConfidenceExplanation(input) {
  const {
    score,
    matchedTermsCount,
    requiredTermCount,
    matchedMustHaveCount,
    mustHaveCount,
    experienceGapYears
  } = input;

  const termLine = `Matched ${matchedTermsCount}/${requiredTermCount || 0} required terms`;
  const mustHaveLine =
    mustHaveCount > 0
      ? `${matchedMustHaveCount}/${mustHaveCount} must-have keywords covered`
      : "No explicit must-have keywords provided";
  const expLine =
    experienceGapYears > 0 ? `experience short by ${experienceGapYears} year(s)` : "experience requirement satisfied";

  return `${termLine}; ${mustHaveLine}; ${expLine}; confidence score ${score}%.`;
}

function toTitleCase(value) {
  return String(value || "")
    .split(/\s+/g)
    .map((word) => {
      if (!word) return "";
      if (word.includes(".")) return word.toUpperCase();
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(" ")
    .trim();
}

function openCandidateProfileDialog(candidateId) {
  const match = (ui.aiMatch.currentMatches || []).find((item) => String(item.candidate.id) === String(candidateId));
  if (!match) {
    alert("Candidate match details are not available. Re-run AI Match.");
    return;
  }

  const candidate = match.candidate;
  const breakdown = match.scoreBreakdown || {};
  const weights = breakdown.weights || { terms: 0.65, skills: 0.25, experience: 0.1 };
  const normalized = breakdown.normalized || { terms: 0, skills: 0, experience: 0 };
  const points = breakdown.weightedPoints || { terms: 0, skills: 0, experience: 0 };

  ensureCandidateProfileDialogMounted();
  el.candidateProfileTitle.textContent = `Candidate Profile: ${candidate.name}`;
  el.candidateProfileContent.innerHTML = `
    <section class="profile-block">
      <h4>Candidate Details</h4>
      <div class="profile-grid">
        <p><strong>Name:</strong> ${escapeHtml(candidate.name || "-")}</p>
        <p><strong>Email:</strong> ${escapeHtml(candidate.email || "-")}</p>
        <p><strong>Phone:</strong> ${escapeHtml(candidate.phone || "-")}</p>
        <p><strong>Current Role:</strong> ${escapeHtml(getCandidateCurrentRole(candidate) || "-")}</p>
        <p><strong>Experience:</strong> ${candidate.experienceYears == null ? "-" : `${candidate.experienceYears} yrs`}</p>
        <p><strong>Location:</strong> ${escapeHtml(candidate.location || "-")}</p>
        <p><strong>Current Company:</strong> ${escapeHtml(candidate.currentCompany || "-")}</p>
        <p><strong>Education:</strong> ${escapeHtml(candidate.education || "-")}</p>
        <p><strong>Best Fit Role:</strong> ${escapeHtml(match.bestJobTitle || "General Fit")}</p>
      </div>
      <p class="profile-summary"><strong>Summary:</strong> ${escapeHtml(candidate.profileSummary || candidate.source || "-")}</p>
      <p class="profile-summary"><strong>Skills:</strong> ${escapeHtml((candidate.skills || []).join(", ") || "-")}</p>
    </section>

    <section class="profile-block">
      <h4>Exact Scoring Breakdown</h4>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Component</th>
              <th>Weight</th>
              <th>Normalized Score</th>
              <th>Weighted Points</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Term Match</td>
              <td>${roundTo(weights.terms * 100, 1)}%</td>
              <td>${roundTo(normalized.terms, 1)}%</td>
              <td>${roundTo(points.terms, 1)}</td>
            </tr>
            <tr>
              <td>Core Skill Match</td>
              <td>${roundTo(weights.skills * 100, 1)}%</td>
              <td>${roundTo(normalized.skills, 1)}%</td>
              <td>${roundTo(points.skills, 1)}</td>
            </tr>
            <tr>
              <td>Experience Fit</td>
              <td>${roundTo(weights.experience * 100, 1)}%</td>
              <td>${roundTo(normalized.experience, 1)}%</td>
              <td>${roundTo(points.experience, 1)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="profile-summary"><strong>Total Score:</strong> ${match.score}% (${match.confidenceLabel} confidence)</p>
      <p class="profile-summary"><strong>Matched Terms:</strong> ${escapeHtml(match.matchedTerms.join(", ") || "-")}</p>
      <p class="profile-summary"><strong>Missing Must-Haves:</strong> ${escapeHtml(match.missingMustHaves.join(", ") || "None")}</p>
      <p class="profile-summary"><strong>Experience Gap:</strong> ${
        match.experienceGapYears <= 0 ? "No gap" : `${match.experienceGapYears} year(s)`
      }</p>
      <p class="profile-summary">${escapeHtml(match.explanation)}</p>
    </section>
  `;

  el.candidateProfileDialog.showModal();
}

function getFileExtension(fileName) {
  const value = String(fileName || "");
  const index = value.lastIndexOf(".");
  if (index === -1) return "";
  return value.slice(index + 1).toLowerCase();
}

function cleanText(value) {
  return String(value || "").trim();
}

function parseNullableNumber(value) {
  const raw = String(value == null ? "" : value).trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildApiUrl(routePath) {
  const base = ui.api.base.replace(/\/$/, "");
  const path = String(routePath || "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function mapApiCandidateToLocal(candidate) {
  const input = candidate || {};
  const roleText = String(input.currentRole || "");
  const profileSummary = String(input.profileSummary || "");
  const sourceRaw = String(input.source || "").trim();
  const providedSkills = Array.isArray(input.skills) ? input.skills.map(String) : splitComma(input.skills);
  const inferredSkills = inferCandidateSkillsFromText(
    `${input.name || ""} ${profileSummary} ${sourceRaw} ${roleText} ${
      Array.isArray(input.keywords) ? input.keywords.join(" ") : String(input.keywords || "")
    }`
  );
  const skills = uniqueStringsLocal(providedSkills.length ? providedSkills : inferredSkills);
  const skillText = skills.join(" ");
  const source = sourceRaw || (profileSummary.toLowerCase().includes("uploaded resume") ? "Resume Upload" : "Bulk Upload");
  const keywords = uniqueStringsLocal([
    ...(Array.isArray(input.keywords) ? input.keywords.map(String) : []),
    ...skills.map((item) => String(item).toLowerCase()),
    ...extractCatalogSkills(`${profileSummary} ${roleText}`)
  ]);
  const tracking = normalizeCandidateTracking(input);
  const linkedInUrl = getCandidateLinkedIn(input);
  const parsedData =
    input.parsedData && typeof input.parsedData === "object" && !Array.isArray(input.parsedData)
      ? { ...input.parsedData }
      : {};
  parsedData.tracking = { ...tracking };
  if (linkedInUrl) parsedData.linkedin = linkedInUrl;

  return {
    id: String(input.id || uid("cand")),
    name: String(input.name || "Unknown Candidate"),
    email: String(input.email || ""),
    phone: String(input.phone || ""),
    linkedin: linkedInUrl,
    skills,
    source,
    recruiter: String(input.recruiter || "Bulk Upload"),
    stage: PIPELINE_STAGES.includes(input.stage) ? input.stage : "Identified",
    jobId: String(input.jobId || ""),
    closureType: tracking.closureType,
    trackingStatus: tracking.trackingStatus,
    screenedAt: tracking.screenedAt,
    submittedAt: tracking.submittedAt,
    rejectedAt: tracking.rejectedAt,
    rejectionReason: tracking.rejectionReason,
    nextStep: tracking.nextStep,
    nextStepDate: tracking.nextStepDate,
    technicalRating: tracking.technicalRating,
    communicationRating: tracking.communicationRating,
    overallRating: tracking.overallRating,
    ratingNotes: tracking.ratingNotes,
    createdAt: String(input.createdAt || todayISO()),
    updatedAt: String(input.updatedAt || input.createdAt || todayISO()),
    experienceYears:
      typeof input.experienceYears === "number" && Number.isFinite(input.experienceYears)
        ? input.experienceYears
        : null,
    currentRole: roleText || inferCurrentRoleFromText(`${profileSummary} ${skillText}`),
    profileSummary,
    keywords,
    location: String(input.location || ""),
    education: String(input.education || ""),
    currentCompany: String(input.currentCompany || ""),
    resumeUrl: String(input.resumeUrl || ""),
    parsedData,
    status: normalizeCandidateStatus(input.status),
    deletedAt: input.deletedAt ? String(input.deletedAt) : null
  };
}

function applyNewCandidates(candidates) {
  const records = Array.isArray(candidates) ? candidates : [];
  if (!records.length) return;

  const existing = new Set(state.candidates.map((item) => candidateIdentityKey(item)));
  records.forEach((candidate) => {
    const normalized = mapApiCandidateToLocal(candidate);
    const key = candidateIdentityKey(normalized);
    if (existing.has(key)) return;
    existing.add(key);
    state.candidates.push(normalized);
  });
}

function findLocalDuplicateMatches(candidate, pool) {
  const email = String(candidate.email || "").trim().toLowerCase();
  const phone = String(candidate.phone || "").replace(/\D/g, "");

  return pool.filter((item) => {
    const sameEmail = email ? String(item.email || "").trim().toLowerCase() === email : false;
    const samePhone = phone ? String(item.phone || "").replace(/\D/g, "") === phone : false;
    return sameEmail || samePhone;
  });
}

function buildDuplicateReasonLocal(candidate, matches) {
  const email = String(candidate.email || "").trim().toLowerCase();
  const phone = String(candidate.phone || "").replace(/\D/g, "");

  const hasEmail = email ? matches.some((item) => String(item.email || "").trim().toLowerCase() === email) : false;
  const hasPhone = phone ? matches.some((item) => String(item.phone || "").replace(/\D/g, "") === phone) : false;

  if (hasEmail && hasPhone) return "Matched by email and phone";
  if (hasEmail) return "Matched by email";
  if (hasPhone) return "Matched by phone";
  return "Potential duplicate";
}

function mergeCandidateFields(primary, duplicate) {
  primary.name = primary.name || duplicate.name || "Unknown Candidate";
  primary.email = primary.email || duplicate.email || "";
  primary.phone = primary.phone || duplicate.phone || "";
  primary.source = primary.source || duplicate.source || "Bulk Upload";
  primary.recruiter = primary.recruiter || duplicate.recruiter || "Bulk Upload";
  primary.currentRole = primary.currentRole || duplicate.currentRole || "";
  primary.skills = splitMultiDelimiter([...(primary.skills || []), ...(duplicate.skills || [])].join(","));

  if (primary.experienceYears == null && duplicate.experienceYears != null) {
    primary.experienceYears = duplicate.experienceYears;
  } else if (primary.experienceYears != null && duplicate.experienceYears != null) {
    primary.experienceYears = Math.max(primary.experienceYears, duplicate.experienceYears);
  }
}

function removeDuplicateGroup(duplicateId) {
  const current = Array.isArray(state.bulkUpload?.duplicates) ? state.bulkUpload.duplicates : [];
  state.bulkUpload.duplicates = current.filter((group) => String(group?.duplicateCandidate?.id || "") !== String(duplicateId));
}

async function mergeDuplicateCandidate(primaryId, duplicateId) {
  try {
    if (ui.api.connected) {
      const response = await fetch(buildApiUrl(API_ROUTES.mergeDuplicate), {
        method: "POST",
        headers: getAuthHeaders({
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({
          primaryCandidateId: primaryId,
          duplicateCandidateId: duplicateId
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || "Merge failed");
      }

      const merged = mapApiCandidateToLocal(payload.mergedCandidate);
      const index = state.candidates.findIndex((item) => item.id === merged.id);
      if (index >= 0) {
        state.candidates[index] = { ...state.candidates[index], ...merged };
      } else {
        state.candidates.push(merged);
      }
    } else {
      const primary = findById(state.candidates, primaryId);
      const duplicateGroup = (state.bulkUpload?.duplicates || []).find(
        (group) => String(group?.duplicateCandidate?.id || "") === String(duplicateId)
      );
      const duplicate = duplicateGroup?.duplicateCandidate;
      if (!primary || !duplicate) {
        throw new Error("Duplicate group not found");
      }

      mergeCandidateFields(primary, duplicate);
    }

    removeDuplicateGroup(duplicateId);
    recordActivity("bulk-upload", `Duplicate merged into candidate ${primaryId}`);
    saveAndRender();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Could not merge duplicate candidate");
  }
}

async function ignoreDuplicateCandidate(duplicateId) {
  try {
    if (ui.api.connected) {
      const response = await fetch(buildApiUrl(API_ROUTES.ignoreDuplicate(duplicateId)), {
        method: "POST",
        headers: getAuthHeaders({ Accept: "application/json" })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error?.message || "Ignore duplicate failed");
      }
    }

    removeDuplicateGroup(duplicateId);
    recordActivity("bulk-upload", `Duplicate ignored: ${duplicateId}`);
    saveAndRender();
  } catch (error) {
    alert(error instanceof Error ? error.message : "Could not ignore duplicate candidate");
  }
}

async function refreshPendingDuplicatesFromBackend() {
  const now = Date.now();
  if (ui.duplicateSyncInFlight) return;
  if (now - ui.lastDuplicateSyncAt < 10000) return;

  ui.duplicateSyncInFlight = true;
  ui.lastDuplicateSyncAt = now;

  try {
    const response = await fetch(buildApiUrl(API_ROUTES.listDuplicates), {
      method: "GET",
      headers: getAuthHeaders({ Accept: "application/json" })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.success) {
      return;
    }

    const duplicates = Array.isArray(payload.duplicates)
      ? payload.duplicates.map((group) => ({
          duplicateCandidate: mapApiCandidateToLocal(group.duplicateCandidate || {}),
          matchedCandidates: Array.isArray(group.matchedCandidates)
            ? group.matchedCandidates.map((item) => mapApiCandidateToLocal(item))
            : [],
          reason: String(group.reason || "Potential duplicate")
        }))
      : [];

    state.bulkUpload.duplicates = duplicates;
    saveState(state);

    if (ui.activeSection === "bulk-upload") {
      renderSection();
    }
  } catch (_error) {
    // Silent: bulk-upload panel still works with local state.
  } finally {
    ui.duplicateSyncInFlight = false;
  }
}

function openCreateDialog() {
  if (ui.activeSection === "jobs") {
    ui.jobs.mode = "create";
    ui.jobs.draft = createJobDraft();
    renderSection();
    return;
  }

  const config = SECTION_CONFIG[ui.activeSection];
  const entity = config.entity;

  if (!entity || !FORM_SCHEMAS[entity]) return;

  if (entity === "users" && !canCurrentUserManageUsers()) {
    alert("Only CEO and Managing Director can create new users.");
    return;
  }

  ensureRecordDialogMounted();
  el.recordDialog.dataset.entity = entity;
  el.recordDialogTitle.textContent = `New ${singularLabel(config.title)}`;

  el.recordFields.innerHTML = FORM_SCHEMAS[entity]
    .map((field) => {
      const defaultValue = getCreateDialogDefaultValue(entity, field.name);
      if (field.type === "select") {
        return `
          <div class="dialog-field">
            <label for="dialog_${field.name}">${escapeHtml(field.label)}</label>
            <select id="dialog_${field.name}" name="${field.name}" ${field.required ? "required" : ""}>
              ${field.options
                .map(
                  (option) =>
                    `<option value="${escapeHtml(option)}" ${String(defaultValue) === String(option) ? "selected" : ""}>${escapeHtml(option)}</option>`
                )
                .join("")}
            </select>
          </div>
        `;
      }

      const type = field.type === "number" ? "number" : field.type;
      const attrs = [
        field.required ? "required" : "",
        field.placeholder ? `placeholder="${escapeHtml(field.placeholder)}"` : "",
        field.pattern ? `pattern="${escapeHtml(field.pattern)}"` : "",
        field.title ? `title="${escapeHtml(field.title)}"` : "",
        field.minLength ? `minlength="${escapeHtml(field.minLength)}"` : "",
        field.autocomplete ? `autocomplete="${escapeHtml(field.autocomplete)}"` : ""
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <div class="dialog-field">
          <label for="dialog_${field.name}">${escapeHtml(field.label)}</label>
          <input id="dialog_${field.name}" name="${field.name}" type="${type}" value="${escapeHtml(defaultValue)}" ${attrs} />
        </div>
      `;
    })
    .join("");

  el.recordDialog.showModal();
}

function getCreateDialogDefaultValue(entity, fieldName) {
  const currentUser = getCurrentUser();
  if (entity === "candidates") {
    if (fieldName === "recruiter") return currentUser?.name || currentUser?.email || "";
    if (fieldName === "source") return "Manual Entry";
    if (fieldName === "stage") return "Identified";
  }

  if (entity === "users" && fieldName === "status") return "Active";
  return "";
}

async function onSubmitRecord(event) {
  event.preventDefault();

  const entity = el.recordDialog.dataset.entity;
  if (!entity) return;

  const data = Object.fromEntries(new FormData(el.recordForm).entries());

  if (entity === "password-reset") {
    await submitPasswordDialog(data);
    return;
  }

  if (entity === "stage-movement") {
    await submitStageMovementDialog(data);
    return;
  }

  if (!FORM_SCHEMAS[entity]) return;

  if (entity === "users" && !canCurrentUserManageUsers()) {
    alert("Only CEO and Managing Director can create new users.");
    return;
  }

  if (entity === "candidates") {
    const currentUser = getCurrentUser();
    const uploadedBy = currentUser?.name || currentUser?.email || "Unknown User";
    const candidateInput = {
      email: String(data.email || "").trim(),
      phone: String(data.phone || "").trim()
    };
    const duplicates = findLocalDuplicateMatches(candidateInput, state.candidates);
    if (duplicates.length) {
      const proceed = confirm(
        `Potential duplicate found by email/phone: ${duplicates
          .slice(0, 3)
          .map((item) => item.name)
          .join(", ")}. Save this candidate anyway?`
      );
      if (!proceed) return;
    }

    const record = {
      id: uid("cand"),
      name: String(data.name || "").trim(),
      email: candidateInput.email,
      phone: candidateInput.phone,
      linkedin: "",
      skills: splitComma(data.skills),
      source: String(data.source || "").trim(),
      recruiter: String(data.recruiter || "").trim(),
      stage: String(data.stage || "Identified"),
      jobId: String(data.jobId || "").trim(),
      closureType: "FTE",
      trackingStatus: "Not Screened",
      screenedAt: "",
      submittedAt: "",
      rejectedAt: "",
      rejectionReason: "",
      nextStep: "Screen candidate",
      nextStepDate: "",
      technicalRating: null,
      communicationRating: null,
      overallRating: null,
      ratingNotes: "",
      createdAt: todayISO(),
      profileSummary: "",
      keywords: [],
      experienceYears: parseNullableNumber(data.experienceYears),
      currentRole: String(data.currentRole || "").trim(),
      location: String(data.location || "").trim(),
      education: "",
      currentCompany: String(data.currentCompany || "").trim(),
      resumeUrl: "",
      parsedData: {
        linkedin: "",
        uploadedBy,
        uploadedByUserId: currentUser?.id || "",
        uploadedAt: new Date().toISOString(),
        origin: "MANUAL_ENTRY",
        timeline: [
          {
            id: uid("evt"),
            eventType: "Candidate Created",
            candidateId: "",
            jobId: String(data.jobId || "").trim(),
            clientId: "",
            vendor: "",
            endClient: "",
            recruiter: String(data.recruiter || "").trim(),
            user: uploadedBy,
            timestamp: new Date().toISOString(),
            previousStage: "",
            currentStage: String(data.stage || "Identified"),
            remarks: "Manual profile created",
            attachments: []
          }
        ],
        feedbackHistory: [],
        submissions: [],
        tracking: {
          closureType: "FTE",
          trackingStatus: "Not Screened",
          screenedAt: "",
          submittedAt: "",
          rejectedAt: "",
          rejectionReason: "",
          nextStep: "Screen candidate",
          nextStepDate: "",
          technicalRating: null,
          communicationRating: null,
          overallRating: null,
          ratingNotes: ""
        }
      },
      status: "ACTIVE",
      deletedAt: null
    };
    record.parsedData.timeline[0].candidateId = record.id;

    if (!ui.api.connected) {
      alert("Candidate creation requires the backend database. Start the backend and try again; no local-only candidate was saved.");
      return;
    }

    let createdRecord = record;
    try {
      createdRecord = await createCandidateViaBackend(record);
    } catch (error) {
      if (error instanceof DuplicateCandidateError) {
        const proceed = confirm(
          `${error.message}: ${error.duplicates
            .slice(0, 3)
            .map((item) => item.name)
            .join(", ")}. Save this candidate anyway?`
        );
        if (!proceed) return;
        try {
          createdRecord = await createCandidateViaBackend(record, true);
        } catch (retryError) {
          alert(retryError instanceof Error ? retryError.message : "Could not create duplicate candidate.");
          return;
        }
      } else {
        ui.api.connected = false;
        ui.api.message = "Backend disconnected";
        renderApiStatus();
        alert(error instanceof Error ? error.message : "Candidate could not be saved to the database.");
        return;
      }
    }

    upsertCandidateInState(createdRecord);
    ui.candidates.selectedId = createdRecord.id;
    ui.candidates.editDraft = candidateDraftFromRecord(createdRecord);
    ui.candidates.inFlightQueryKey = "";
    ui.candidates.lastQueryKey = "";
    recordActivity("candidate", `Candidate created: ${createdRecord.name}`);
  }

  if (entity === "clients") {
    const record = {
      id: uid("cli"),
      name: String(data.name || "").trim(),
      industry: String(data.industry || "").trim(),
      owner: String(data.owner || "").trim(),
      createdAt: todayISO()
    };

    state.clients.push(record);
    recordActivity("client", `Client created: ${record.name}`);
  }

  if (entity === "jobs") {
    const requiredSkills = splitComma(data.requiredSkills);
    const rawLocations = splitMultiDelimiter(data.location || "");
    const locations = uniqueStringsLocal(rawLocations);
    const record = {
      id: uid("job"),
      title: String(data.title || "").trim(),
      jdText: "",
      clientId: String(data.clientId || "").trim(),
      locations,
      location: locations.join(", "),
      workMode: "Hybrid",
      jobType: "FTE",
      status: normalizeJobStatus(data.status || "Open"),
      openings: Number(data.openings || 1),
      expMin: "",
      expMax: "",
      currency: "INR",
      ctcMin: "",
      ctcMax: "",
      rateMin: "",
      rateMax: "",
      billingRateType: "Monthly",
      ctcNotDisclosed: false,
      requiredSkills: uniqueStringsLocal(requiredSkills),
      preferredSkills: [],
      createdAt: todayISO(),
      updatedAt: new Date().toISOString()
    };

    state.jobs.push(record);
    recordActivity("job", `Job created: ${record.title}`);
  }

  if (entity === "interviews") {
    const record = {
      id: uid("int"),
      candidateId: String(data.candidateId || "").trim(),
      jobId: String(data.jobId || "").trim(),
      round: String(data.round || "L1"),
      scheduledAt: String(data.scheduledAt || todayISO()),
      status: String(data.status || "Scheduled")
    };

    state.interviews.push(record);
    recordActivity("interview", `Interview scheduled for ${record.candidateId} (${record.round})`);
  }

  if (entity === "users") {
    const email = normalizeEmail(data.email);
    const role = normalizeUserRole(data.role);
    const password = String(data.password || "");

    if (!isAgodlyCompanyEmail(email)) {
      alert("User email must end with @agodly.com.");
      return;
    }

    if (state.users.some((user) => normalizeEmail(user.email) === email)) {
      alert("A user with this Agodly email already exists.");
      return;
    }

    if (password.length < 8) {
      alert("Password must be at least 8 characters.");
      return;
    }

    const record = {
      id: uid("usr"),
      name: String(data.name || "").trim(),
      email,
      phone: String(data.phone || "").trim(),
      role,
      status: normalizeUserStatus(data.status),
      team: String(data.team || "Recruiting").trim() || "Recruiting",
      manager: String(data.manager || "").trim(),
      monthlyTarget: normalizeMonthlyTarget(data.monthlyTarget, role),
      revenueTarget: normalizeRevenueTarget(data.revenueTarget),
      passwordConfigured: true,
      passwordSetAt: new Date().toISOString(),
      authProvider: "password",
      archivedAt: "",
      updatedAt: new Date().toISOString(),
      createdAt: todayISO()
    };

    state.users.push(record);
    recordActivity("users", `User created: ${record.name} (${record.role})`);
    el.recordForm?.reset();
    closeRecordDialog();
    try {
      // Sync first so the user exists server-side, then set its password (scrypt).
      await saveAndRenderSyncNow("User created and synced.");
      await apiSetUserPassword(record, password);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Password could not be saved on the server.");
    }
    return;
  }

  el.recordForm?.reset();
  closeRecordDialog();
  saveAndRender();
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `agodly-ats-${todayISO()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function importState(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || "{}"));
      state = normalizeState(parsed);
      recordActivity("system", "Dataset imported");
      saveAndRender();
    } catch {
      alert("Invalid JSON file. Use a previously exported Agodly ATS file.");
    } finally {
      event.target.value = "";
    }
  };
  reader.readAsText(file);
}

function saveAndRender() {
  saveState(state);
  render();
  scheduleBackendStateSync();
}

async function saveAndRenderSyncNow(successMessage = "Backend synced.") {
  saveState(state);
  render();

  const synced = await syncStateToBackend({ force: true });
  if (!synced && ui.api.connected) {
    alert("Database sync failed. The change was not confirmed by the backend; refresh from the server before continuing.");
    return false;
  }

  if (synced) {
    ui.api.connected = true;
    ui.api.message = successMessage;
    renderApiStatus();
  }

  return synced;
}

function loadAuthState() {
  const token = String(localStorage.getItem(AUTH_TOKEN_KEY) || "").trim();
  const user = parseStoredAuthUser(localStorage.getItem(AUTH_USER_KEY));
  return { token, user, isChecking: Boolean(token), loginInProgress: false };
}

function parseStoredAuthUser(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return normalizeAuthUser(parsed);
  } catch {
    return null;
  }
}

function normalizeAuthUser(user) {
  if (!user || typeof user !== "object") return null;
  const email = String(user.email || "").trim().toLowerCase();
  if (!email) return null;

  return {
    id: String(user.id || email),
    name: sanitizeLine(String(user.name || email.split("@")[0] || "User"), 80),
    email,
    role: normalizeUserRole(user.role)
  };
}

function persistAuthState() {
  if (auth.token && auth.user) {
    localStorage.setItem(AUTH_TOKEN_KEY, auth.token);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(auth.user));
    return;
  }

  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

function isAuthenticated() {
  return Boolean(!auth.isChecking && auth.token && auth.user);
}

function renderLoginState() {
  const locked = auth.isChecking || !isAuthenticated();

  if (locked) {
    ensureLoginScreenMounted();
  } else {
    unmountLoginScreen();
  }

  el.layout?.classList.toggle("is-auth-locked", locked);

  if (locked && el.loginEmail && !el.loginEmail.value) {
    el.loginEmail.value = auth.user?.email || "";
  }

  if (locked && el.loginSubmitBtn) {
    el.loginSubmitBtn.disabled = Boolean(auth.isChecking || auth.loginInProgress);
    el.loginSubmitBtn.textContent = auth.isChecking ? "Verifying..." : "Sign In";
  }
}

function getAuthHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }
  return headers;
}

// Passwords are hashed server-side (scrypt). We send the plaintext over HTTPS to
// the backend, which stores only the hash — the browser never persists or syncs
// a password hash.
async function apiSetUserPassword(user, plainPassword) {
  const response = await fetch(buildApiUrl(API_ROUTES.authPassword), {
    method: "POST",
    headers: getAuthHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
    body: JSON.stringify({ userId: user.id, email: user.email, newPassword: String(plainPassword || "") })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error?.message || "Password could not be saved on the server.");
  }
}

async function onLoginSubmit(event) {
  event.preventDefault();
  if (auth.loginInProgress) return;

  const email = String(el.loginEmail?.value || "").trim();
  const password = String(el.loginPassword?.value || "");

  if (!email || !password) {
    setLoginError("Enter email and password.");
    return;
  }

  auth.loginInProgress = true;
  setLoginError("");
  if (el.loginSubmitBtn) el.loginSubmitBtn.disabled = true;

  try {
    const response = await fetch(buildApiUrl(API_ROUTES.authLogin), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload?.success || !payload?.token || !payload?.user) {
      throw new Error(payload?.error?.message || "Login failed. Check credentials and backend status.");
    }

    auth.token = String(payload.token);
    auth.user = normalizeAuthUser(payload.user);
    auth.isChecking = false;
    if (!auth.user) {
      throw new Error("Login succeeded but user profile was invalid.");
    }

    state = emptyState();
    persistAuthState();
    ensureAuthenticatedUserInState();
    localStorage.setItem(CURRENT_USER_ID_KEY, auth.user.id);
    if (el.loginPassword) el.loginPassword.value = "";
    ui.api.connected = false;
    ui.api.message = "Checking backend and database...";
    renderApiStatus();
    await checkBackendHealth();
  } catch (error) {
    auth.token = "";
    auth.user = null;
    auth.isChecking = false;
    state = emptyState();
    persistAuthState();
    setLoginError(error instanceof Error ? error.message : "Login failed.");
    renderLoginState();
  } finally {
    auth.loginInProgress = false;
    if (el.loginSubmitBtn) el.loginSubmitBtn.disabled = false;
  }
}

function setLoginError(message) {
  if (el.loginError) {
    el.loginError.textContent = message;
  }
}

async function validateStoredSession() {
  if (!auth.token) {
    auth.isChecking = false;
    state = emptyState();
    renderLoginState();
    return;
  }

  auth.isChecking = true;
  renderLoginState();

  try {
    const response = await fetch(buildApiUrl(API_ROUTES.authMe), {
      method: "GET",
      headers: getAuthHeaders({ Accept: "application/json" })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload?.success || !payload?.user) {
      throw new Error("Stored session expired.");
    }

    auth.user = normalizeAuthUser(payload.user);
    auth.isChecking = false;
    state = emptyState();
    persistAuthState();
    ensureAuthenticatedUserInState();
  } catch {
    auth.token = "";
    auth.user = null;
    auth.isChecking = false;
    state = emptyState();
    persistAuthState();
  } finally {
    render();
  }
}

async function logoutCurrentUser() {
  const token = auth.token;
  auth.token = "";
  auth.user = null;
  auth.isChecking = false;
  state = emptyState();
  persistAuthState();
  render();

  if (!token || !ui.api.connected) return;

  try {
    await fetch(buildApiUrl(API_ROUTES.authLogout), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });
  } catch {
    // local logout has already completed
  }
}

function ensureAuthenticatedUserInState() {
  const user = auth.user;
  if (!user) return;

  const existing = state.users.find((item) => item.id === user.id || normalizeEmail(item.email) === normalizeEmail(user.email));
  if (existing) {
    existing.name = user.name;
    existing.email = user.email;
    existing.role = normalizeUserRole(user.role);
    existing.status = "Active";
    return;
  }

  state.users.unshift({
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizeUserRole(user.role),
    team: "Leadership",
    manager: "",
    monthlyTarget: normalizeMonthlyTarget(25, user.role),
    revenueTarget: normalizeRevenueTarget(0),
    status: "Active",
    createdAt: todayISO()
  });
}

async function checkBackendHealth() {
  ui.api.message = "Checking backend...";
  ui.api.connected = false;
  renderApiStatus();

  const url = buildApiUrl(API_ROUTES.readiness);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: getAuthHeaders({ Accept: "application/json" })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const payload = await response.json().catch(() => ({}));
    if (!payload?.success) {
      const issues = payload?.checks?.configuration?.issues;
      const issueText = Array.isArray(issues) && issues.length ? issues.join(" ") : "Database readiness check failed.";
      throw new Error(issueText);
    }
    ui.api.connected = true;
    ui.api.message = "Backend and database connected with valid session";
    ui.bootstrapError = "";
    ui.candidates.lastQueryKey = "";
    ui.candidates.inFlightQueryKey = "";
  } catch (error) {
    ui.api.connected = false;
    ui.api.message = "Backend/database unavailable";
    ui.bootstrapError = error instanceof Error ? error.message : "Database readiness check failed.";
    ui.candidates.inFlightQueryKey = "";
    ui.candidates.isLoading = false;
  }

  renderApiStatus();

  if (!ui.api.connected) {
    auth.isChecking = false;
    ui.bootstrapLoaded = false;
    render();
    return;
  }

  await validateStoredSession();
  if (!isAuthenticated()) {
    ui.bootstrapLoaded = false;
    return;
  }

  await hydrateStateFromBackend();
}

async function hydrateStateFromBackend(options = {}) {
  if (ui.isHydratingFromBackend) return;

  const background = Boolean(options.background);

  try {
    ui.isHydratingFromBackend = true;
    const response = await fetch(buildApiUrl(API_ROUTES.bootstrap), {
      method: "GET",
      headers: getAuthHeaders({ Accept: "application/json" })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload?.success || !payload?.data || typeof payload.data !== "object") {
      throw new Error(payload?.error?.message || `Bootstrap failed with HTTP ${response.status}`);
    }

    state = normalizeState(payload.data);
    ensureAuthenticatedUserInState();
    saveState(state);
    ui.bootstrapError = "";
    render({ preserveScroll: background });
    ui.bootstrapLoaded = true;
  } catch (error) {
    if (!background || !ui.bootstrapLoaded) {
      ui.bootstrapLoaded = false;
      ui.bootstrapError = error instanceof Error ? error.message : "Unable to load dashboard data";
      render({ preserveScroll: true });
    }
  } finally {
    ui.isHydratingFromBackend = false;
  }
}

function startSharedStateRefresh() {
  if (ui.sharedStateRefreshTimerId) return;

  ui.sharedStateRefreshTimerId = window.setInterval(() => {
    if (!document.hidden) void refreshSharedStateFromBackendIfIdle();
  }, SHARED_STATE_REFRESH_INTERVAL_MS);
}

async function refreshSharedStateFromBackendIfIdle() {
  if (
    !ui.api.connected ||
    !ui.bootstrapLoaded ||
    !isAuthenticated() ||
    ui.isHydratingFromBackend ||
    ui.backendSyncInFlight ||
    ui.backendSyncTimerId
  ) {
    return false;
  }

  await hydrateStateFromBackend({ background: true });
  return true;
}

function scheduleBackendStateSync() {
  if (!ui.api.connected || ui.isHydratingFromBackend || !isAuthenticated()) return;

  if (ui.backendSyncTimerId) {
    clearTimeout(ui.backendSyncTimerId);
  }

  ui.backendSyncTimerId = setTimeout(() => {
    ui.backendSyncTimerId = 0;
    void syncStateToBackend();
  }, 350);
}

async function syncStateToBackend(options = {}) {
  const force = Boolean(options.force);
  if (!ui.api.connected || ui.isHydratingFromBackend || !auth.token) return false;
  if (ui.backendSyncInFlight && !force) return false;

  if (ui.backendSyncTimerId) {
    clearTimeout(ui.backendSyncTimerId);
    ui.backendSyncTimerId = 0;
  }

  ui.backendSyncInFlight = true;
  try {
    const response = await fetch(buildApiUrl(API_ROUTES.bootstrapSync), {
      method: "POST",
      headers: getAuthHeaders({
        "Content-Type": "application/json"
      }),
      body: JSON.stringify(state)
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload?.error?.message || `Backend sync failed with HTTP ${response.status}`);
    }

    if (payload?.success && payload?.data && typeof payload.data === "object") {
      state = normalizeState(payload.data);
      ensureAuthenticatedUserInState();
      saveState(state);
      render({ preserveScroll: true });
    }

    return true;
  } catch {
    ui.api.message = "Backend sync failed";
    renderApiStatus();
    return false;
  } finally {
    ui.backendSyncInFlight = false;
  }
}

function countStateRecords(snapshot) {
  const data = snapshot && typeof snapshot === "object" ? snapshot : {};
  const keys = ["users", "candidates", "clients", "jobs", "interviews", "placements", "activities"];
  return keys.reduce((acc, key) => {
    const rows = Array.isArray(data[key]) ? data[key].length : 0;
    return acc + rows;
  }, 0);
}

function renderApiStatus() {
  el.apiDot?.classList.toggle("ok", ui.api.connected);
  el.apiDot?.classList.toggle("down", !ui.api.connected);
  if (el.apiStatus) el.apiStatus.textContent = ui.api.message;
  if (el.apiBaseText) el.apiBaseText.textContent = ui.api.base;
}

function emptyState() {
  return {
    bulkUpload: normalizeBulkUpload({}),
    users: [],
    candidates: [],
    clients: [],
    jobs: [],
    interviews: [],
    placements: [],
    activities: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return demoState();

    return normalizeState(JSON.parse(raw));
  } catch {
    return demoState();
  }
}

function saveState(value) {
  if (!isAuthenticated()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeStateForBrowserStorage(value)));
}

function sanitizeStateForBrowserStorage(value) {
  const snapshot = normalizeState(value);
  snapshot.users = snapshot.users.map((user) => {
    const sanitized = { ...user };
    delete sanitized.password;
    delete sanitized.passwordHash;
    sanitized.passwordConfigured = Boolean(user.passwordConfigured || user.passwordHash || user.password);
    return sanitized;
  });

  return snapshot;
}

function normalizeState(value) {
  const source = value && typeof value === "object" ? value : {};

  return {
    bulkUpload: normalizeBulkUpload(source.bulkUpload),
    users: normalizeUsers(source.users),
    candidates: normalizeCandidates(source.candidates),
    clients: normalizeClients(source.clients),
    jobs: normalizeJobs(source.jobs),
    interviews: normalizeInterviews(source.interviews),
    placements: normalizePlacements(source.placements),
    activities: normalizeActivities(source.activities)
  };
}

function normalizeBulkUpload(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    totalFiles: Number(source.totalFiles || 0),
    pending: Number(source.pending || 0),
    completed: Number(source.completed || 0),
    failed: Number(source.failed || 0),
    blockedCount: Number(source.blockedCount || 0),
    lastRunAt: String(source.lastRunAt || ""),
    results: Array.isArray(source.results)
      ? source.results
          .filter((item) => item && item.fileName)
          .map((item) => ({
            fileName: String(item.fileName),
            kind: String(item.kind || ""),
            status: String(item.status || "Completed"),
            added: Number(item.added || 0),
            blocked: Number(item.blocked || 0),
            message: String(item.message || "")
          }))
      : [],
    blockedDuplicates: Array.isArray(source.blockedDuplicates)
      ? source.blockedDuplicates
          .filter((candidate) => candidate && (candidate.email || candidate.phone))
          .map((candidate) => ({
            name: String(candidate.name || "Unknown"),
            email: String(candidate.email || ""),
            phone: String(candidate.phone || ""),
            reason: String(candidate.reason || "Blocked duplicate")
          }))
      : [],
    duplicates: Array.isArray(source.duplicates)
      ? source.duplicates
          .map((group) => ({
            duplicateCandidate: mapApiCandidateToLocal(group?.duplicateCandidate || {}),
            matchedCandidates: Array.isArray(group?.matchedCandidates)
              ? group.matchedCandidates.map((item) => mapApiCandidateToLocal(item))
              : [],
            reason: String(group?.reason || "Potential duplicate")
          }))
          .filter((group) => group.duplicateCandidate?.id)
      : [],
    candidateNotes: Array.isArray(source.candidateNotes)
      ? source.candidateNotes.map((item) => mapApiCandidateToLocal(item))
      : []
  };
}

function normalizeUsers(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && item.id && item.name)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name),
      email: String(item.email || ""),
      phone: String(item.phone || ""),
      role: normalizeUserRole(item.role),
      status: normalizeUserStatus(item.status),
      team: String(item.team || "Recruiting"),
      manager: String(item.manager || ""),
      monthlyTarget: Number(item.monthlyTarget || normalizeMonthlyTarget("", normalizeUserRole(item.role))),
      revenueTarget: normalizeRevenueTarget(item.revenueTarget),
      passwordHash: String(item.passwordHash || ""),
      passwordConfigured: Boolean(item.passwordConfigured || item.passwordHash || item.password),
      passwordSetAt: String(item.passwordSetAt || ""),
      authProvider: String(item.authProvider || (item.passwordHash ? "password" : "")),
      archivedAt: String(item.archivedAt || ""),
      updatedAt: String(item.updatedAt || ""),
      createdAt: String(item.createdAt || todayISO())
    }));
}

function normalizeCandidates(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && item.id && item.name)
    .map((item) => {
      const sourceRaw = String(item.source || "").trim();
      const profileSummary = String(item.profileSummary || "");
      const currentRoleRaw = String(item.currentRole || "");
      const tracking = normalizeCandidateTracking(item);
      const linkedInUrl = getCandidateLinkedIn(item);
      const storedSkills = Array.isArray(item.skills) ? item.skills.map(String) : splitComma(item.skills);
      const inferredSkills = inferCandidateSkillsFromText(
        `${item.name || ""} ${profileSummary} ${sourceRaw} ${currentRoleRaw} ${
          Array.isArray(item.keywords) ? item.keywords.join(" ") : String(item.keywords || "")
        }`
      );
      const skills = uniqueStringsLocal(storedSkills.length ? storedSkills : inferredSkills);
      const normalizedSource = sourceRaw || (profileSummary.toLowerCase().includes("uploaded resume") ? "Resume Upload" : "Bulk Upload");
      const derivedKeywords = uniqueStringsLocal([
        ...(Array.isArray(item.keywords) ? item.keywords.map(String) : []),
        ...skills.map((skill) => String(skill).toLowerCase()),
        ...extractCatalogSkills(`${profileSummary} ${currentRoleRaw}`)
      ]);

      const parsedData =
        item.parsedData && typeof item.parsedData === "object" && !Array.isArray(item.parsedData)
          ? { ...item.parsedData }
          : {};
      parsedData.tracking = { ...tracking };
      parsedData.stageHistory = normalizeStageHistory(parsedData.stageHistory);
      parsedData.timeline = normalizeTimelineEvents(parsedData.timeline);
      parsedData.feedbackHistory = normalizeFeedbackHistory(parsedData.feedbackHistory);
      parsedData.submissions = normalizeCandidateSubmissions(parsedData.submissions);
      if (linkedInUrl) parsedData.linkedin = linkedInUrl;

      return {
        id: String(item.id),
        name: String(item.name),
        email: String(item.email || ""),
        phone: String(item.phone || ""),
        linkedin: linkedInUrl,
        skills,
        source: normalizedSource,
        recruiter: String(item.recruiter || "Unassigned"),
        stage: PIPELINE_STAGES.includes(item.stage) ? item.stage : "Identified",
        jobId: String(item.jobId || ""),
        closureType: tracking.closureType,
        trackingStatus: tracking.trackingStatus,
        screenedAt: tracking.screenedAt,
        submittedAt: tracking.submittedAt,
        rejectedAt: tracking.rejectedAt,
        rejectionReason: tracking.rejectionReason,
        nextStep: tracking.nextStep,
        nextStepDate: tracking.nextStepDate,
        technicalRating: tracking.technicalRating,
        communicationRating: tracking.communicationRating,
        overallRating: tracking.overallRating,
        ratingNotes: tracking.ratingNotes,
        createdAt: String(item.createdAt || todayISO()),
        currentRole: currentRoleRaw || inferCurrentRoleFromText(`${profileSummary} ${skills.join(" ")}`),
        profileSummary,
        keywords: derivedKeywords,
        experienceYears:
          typeof item.experienceYears === "number" && Number.isFinite(item.experienceYears)
            ? item.experienceYears
            : null,
        location: String(item.location || ""),
        education: String(item.education || ""),
        currentCompany: String(item.currentCompany || ""),
        resumeUrl: String(item.resumeUrl || ""),
        parsedData,
        status: normalizeCandidateStatus(item.status),
        deletedAt: item.deletedAt ? String(item.deletedAt) : null
      };
    });
}

function normalizeClients(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && item.id && item.name)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name),
      industry: String(item.industry || ""),
      owner: String(item.owner || ""),
      createdAt: String(item.createdAt || todayISO())
    }));
}

function normalizeJobs(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && item.id && item.title)
    .map((item) => {
      const rawLocations = Array.isArray(item.locations) ? item.locations : splitMultiDelimiter(item.location || "");
      const locations = uniqueStringsLocal(rawLocations);
      const requiredSkills = Array.isArray(item.requiredSkills) ? item.requiredSkills.map(String) : splitComma(item.requiredSkills);
      const preferredSkills = Array.isArray(item.preferredSkills) ? item.preferredSkills.map(String) : splitComma(item.preferredSkills);

      return {
        id: String(item.id),
        referenceNo: String(item.referenceNo || ""),
        title: String(item.title),
        jdText: String(item.jdText || item.description || ""),
        clientId: String(item.clientId || ""),
        locations,
        location: locations.join(", "),
        workMode: normalizeWorkModeLabel(item.workMode),
        remoteScope: String(item.remoteScope || ""),
        country: String(item.country || ""),
        state: String(item.state || ""),
        city: String(item.city || ""),
        primaryTimeZone: String(item.primaryTimeZone || ""),
        supportedTimeZones: uniqueStringsLocal(Array.isArray(item.supportedTimeZones) ? item.supportedTimeZones.map(String) : splitMultiDelimiter(item.supportedTimeZones || "")),
        workingHours: String(item.workingHours || ""),
        minTimeZoneOverlap: item.minTimeZoneOverlap == null || item.minTimeZoneOverlap === "" ? "" : Number(item.minTimeZoneOverlap),
        jobType: normalizeJobType(item.jobType),
        status: normalizeJobStatus(item.status),
        statusReason: String(item.statusReason || ""),
        priority: String(item.priority || "NORMAL").toUpperCase(),
        ownerUserId: String(item.ownerUserId || ""),
        assignedRecruiterId: String(item.assignedRecruiterId || ""),
        openings: Number(item.openings || 1),
        expMin: item.expMin == null || item.expMin === "" ? "" : Number(item.expMin),
        expMax: item.expMax == null || item.expMax === "" ? "" : Number(item.expMax),
        currency: String(item.currency || "INR"),
        ctcMin: item.ctcMin == null || item.ctcMin === "" ? "" : Number(item.ctcMin),
        ctcMax: item.ctcMax == null || item.ctcMax === "" ? "" : Number(item.ctcMax),
        rateMin: item.rateMin == null || item.rateMin === "" ? "" : Number(item.rateMin),
        rateMax: item.rateMax == null || item.rateMax === "" ? "" : Number(item.rateMax),
        billingRateType: normalizeBillingRateType(item.billingRateType),
        ctcNotDisclosed: Boolean(item.ctcNotDisclosed),
        requiredSkills: uniqueStringsLocal(requiredSkills),
        preferredSkills: uniqueStringsLocal(preferredSkills),
        openedAt: String(item.openedAt || ""),
        targetClosureAt: String(item.targetClosureAt || ""),
        closedAt: String(item.closedAt || ""),
        archivedAt: String(item.archivedAt || ""),
        createdAt: String(item.createdAt || todayISO()),
        updatedAt: String(item.updatedAt || "")
      };
    });
}

function normalizeInterviews(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && item.id)
    .map((item) => ({
      id: String(item.id),
      candidateId: String(item.candidateId || ""),
      jobId: String(item.jobId || ""),
      round: String(item.round || "L1"),
      scheduledAt: String(item.scheduledAt || todayISO()),
      status: String(item.status || "Scheduled")
    }));
}

function normalizePlacements(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && item.id)
    .map((item) => ({
      id: String(item.id),
      candidateId: String(item.candidateId || ""),
      jobId: String(item.jobId || ""),
      recruiter: String(item.recruiter || "Unassigned"),
      revenue: Number(item.revenue || 0),
      cost: normalizeMoneyValue(item.cost),
      margin:
        item.margin == null || item.margin === ""
          ? Number(item.revenue || 0) - normalizeMoneyValue(item.cost)
          : Number(item.margin || 0),
      date: String(item.date || todayISO())
    }));
}

function normalizeActivities(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item) => item && item.id)
    .map((item) => ({
      id: String(item.id),
      type: String(item.type || "system"),
      module: String(item.module || item.type || "system"),
      action: String(item.action || item.type || "system"),
      message: String(item.message || ""),
      actorName: String(item.actorName || ""),
      actorEmail: String(item.actorEmail || ""),
      actorRole: String(item.actorRole || ""),
      details: item.details && typeof item.details === "object" && !Array.isArray(item.details) ? { ...item.details } : {},
      timestamp: String(item.timestamp || new Date().toISOString())
    }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function getActivityActor() {
  const user = getCurrentUser();
  return {
    name: String(user?.name || "System"),
    email: String(user?.email || ""),
    role: String(user?.role || "")
  };
}

function recordActivity(type, message, details = {}) {
  const actor = getActivityActor();
  const safeDetails = details && typeof details === "object" && !Array.isArray(details) ? { ...details } : {};
  state.activities.unshift({
    id: uid("act"),
    type,
    module: String(safeDetails.module || type || "system"),
    action: String(safeDetails.action || type || "system"),
    message,
    actorName: actor.name,
    actorEmail: actor.email,
    actorRole: actor.role,
    details: safeDetails,
    timestamp: new Date().toISOString()
  });
  state.activities = state.activities.slice(0, 500);
}

function getDemoCandidateTracking(candidate) {
  const stage = candidate.stage || "Identified";
  const tracking = {
    closureType: candidate.id === "cand-004" ? "Contractual" : "FTE",
    trackingStatus: normalizeTrackingStatus("", stage),
    screenedAt: stageRank(stage) >= stageRank("Qualified") ? daysAgo(18) : "",
    submittedAt: stageRank(stage) >= stageRank("Submitted") ? daysAgo(12) : "",
    rejectedAt: stage === "Dropped" ? daysAgo(4) : "",
    rejectionReason: stage === "Dropped" ? "Rejected after manager review" : "",
    nextStep: stage === "Identified" ? "Screen candidate" : stage === "Offer" ? "Offer approval" : stage === "Onboarded" ? "Closure completed" : "Manager follow-up",
    nextStepDate: stage === "Onboarded" || stage === "Dropped" ? "" : daysAgo(-3),
    technicalRating: stageRank(stage) >= stageRank("Interview") ? 8 : null,
    communicationRating: stageRank(stage) >= stageRank("Interview") ? 7.5 : null,
    overallRating: stageRank(stage) >= stageRank("Interview") ? 8 : null,
    ratingNotes: stageRank(stage) >= stageRank("Interview") ? "Good manager feedback; proceed with next stage." : ""
  };

  return {
    ...tracking,
    parsedData: { tracking }
  };
}

function demoState() {
  const bulkUpload = {
    totalFiles: 0,
    pending: 0,
    completed: 0,
    failed: 0,
    lastRunAt: "",
    results: [],
    duplicates: [],
    candidateNotes: []
  };

  const users = [
    {
      id: "usr-001",
      name: "Rakesh Patil",
      email: "admin@agodly.com",
      phone: "+91 98765 43210",
      role: "Managing Director",
      status: "Active",
      team: "Leadership",
      manager: "",
      monthlyTarget: 0,
      revenueTarget: 0,
      createdAt: daysAgo(180)
    },
    {
      id: "usr-002",
      name: "Maya Thompson",
      email: "maya@agodly.com",
      phone: "+91 90000 12345",
      role: "Recruiter",
      status: "Active",
      team: "Technology Hiring",
      manager: "Rakesh Patil",
      monthlyTarget: 25,
      revenueTarget: 250000,
      createdAt: daysAgo(95)
    },
    {
      id: "usr-003",
      name: "Ravi Mehta",
      email: "ravi@agodly.com",
      phone: "+91 90000 23456",
      role: "Recruiter",
      status: "Active",
      team: "Technology Hiring",
      manager: "Rakesh Patil",
      monthlyTarget: 40,
      revenueTarget: 400000,
      createdAt: daysAgo(88)
    },
    {
      id: "usr-004",
      name: "Anika Shah",
      email: "anika@agodly.com",
      phone: "+91 90000 34567",
      role: "Recruiter",
      status: "Inactive",
      team: "Interview Panel",
      manager: "Rakesh Patil",
      monthlyTarget: 12,
      revenueTarget: 150000,
      createdAt: daysAgo(37)
    }
  ];

  const clients = [
    { id: "cli-001", name: "Agodly Infotech LLP", industry: "Technology", owner: "Rakesh Patil", createdAt: daysAgo(110) },
    { id: "cli-002", name: "Northline Retail", industry: "Retail", owner: "Maya Thompson", createdAt: daysAgo(74) },
    { id: "cli-003", name: "Viron Health", industry: "Healthcare", owner: "Arun Iyer", createdAt: daysAgo(45) }
  ];

  const jobs = [
    {
      id: "job-001",
      title: "Senior Backend Engineer",
      clientId: "cli-001",
      location: "Austin, TX",
      status: "Open",
      openings: 2,
      jobType: "FTE",
      currency: "INR",
      ctcMin: 18,
      ctcMax: 28,
      ctcNotDisclosed: false,
      requiredSkills: ["node.js", "typescript", "postgresql", "aws"],
      createdAt: daysAgo(51)
    },
    {
      id: "job-002",
      title: "Talent Acquisition Specialist",
      clientId: "cli-001",
      location: "Remote",
      status: "Open",
      openings: 1,
      jobType: "C2H",
      currency: "INR",
      rateMin: 120000,
      rateMax: 180000,
      billingRateType: "Monthly",
      ctcNotDisclosed: false,
      requiredSkills: ["sourcing", "stakeholder management", "ats"],
      createdAt: daysAgo(35)
    },
    {
      id: "job-003",
      title: "Product Designer",
      clientId: "cli-002",
      location: "San Francisco, CA",
      status: "Paused",
      openings: 1,
      jobType: "C2C",
      currency: "USD",
      rateMin: 45,
      rateMax: 65,
      billingRateType: "Hourly",
      ctcNotDisclosed: false,
      requiredSkills: ["figma", "design systems", "user research"],
      createdAt: daysAgo(78)
    },
    {
      id: "job-004",
      title: "DevOps Engineer",
      clientId: "cli-003",
      location: "Seattle, WA",
      status: "Open",
      openings: 1,
      jobType: "FTE",
      currency: "INR",
      ctcMin: 20,
      ctcMax: 32,
      ctcNotDisclosed: false,
      requiredSkills: ["kubernetes", "terraform", "aws", "python"],
      createdAt: daysAgo(24)
    }
  ];

  const candidates = [
    {
      id: "cand-001",
      name: "Nina Patel",
      email: "nina.patel@example.com",
      phone: "+1 415 555 0179",
      skills: ["node.js", "typescript", "postgresql", "aws"],
      source: "LinkedIn",
      recruiter: "Maya Thompson",
      stage: "Interview",
      jobId: "job-001",
      createdAt: daysAgo(23)
    },
    {
      id: "cand-002",
      name: "Daniel Cho",
      email: "daniel.cho@example.com",
      phone: "+1 206 555 0132",
      skills: ["sourcing", "ats", "communication"],
      source: "Referral",
      recruiter: "Ravi Mehta",
      stage: "Qualified",
      jobId: "job-002",
      createdAt: daysAgo(19)
    },
    {
      id: "cand-003",
      name: "Olivia Bennett",
      email: "olivia.bennett@example.com",
      phone: "+1 646 555 0198",
      skills: ["figma", "design systems", "user research"],
      source: "Website",
      recruiter: "Maya Thompson",
      stage: "Submitted",
      jobId: "job-003",
      createdAt: daysAgo(42)
    },
    {
      id: "cand-004",
      name: "Arjun Malhotra",
      email: "arjun.malhotra@example.com",
      phone: "+1 917 555 0122",
      skills: ["kubernetes", "terraform", "aws", "python"],
      source: "LinkedIn",
      recruiter: "Anika Shah",
      stage: "Offer",
      jobId: "job-004",
      createdAt: daysAgo(14)
    },
    {
      id: "cand-005",
      name: "Sara Miller",
      email: "sara.miller@example.com",
      phone: "+1 332 555 0190",
      skills: ["node.js", "typescript", "microservices"],
      source: "Referral",
      recruiter: "Ravi Mehta",
      stage: "Onboarded",
      jobId: "job-001",
      createdAt: daysAgo(61)
    },
    {
      id: "cand-006",
      name: "Noah James",
      email: "noah.james@example.com",
      phone: "+1 818 555 0127",
      skills: ["react", "typescript", "figma"],
      source: "LinkedIn",
      recruiter: "Anika Shah",
      stage: "Dropped",
      jobId: "job-003",
      createdAt: daysAgo(31)
    },
    {
      id: "cand-007",
      name: "Kiara Singh",
      email: "kiara.singh@example.com",
      phone: "+1 202 555 0181",
      skills: ["sourcing", "negotiation", "analytics"],
      source: "Naukri",
      recruiter: "Maya Thompson",
      stage: "Identified",
      jobId: "job-002",
      createdAt: daysAgo(5)
    }
  ];

  const candidatesWithDetails = candidates.map((candidate) => ({
    ...candidate,
    profileSummary: `${candidate.name} profile sourced via ${candidate.source}`,
    keywords: extractCatalogSkills(`${candidate.skills.join(" ")} ${candidate.source}`),
    experienceYears: null,
    currentRole: inferCurrentRoleFromText(candidate.skills.join(" ")),
    location: "",
    education: "",
    currentCompany: "",
    ...getDemoCandidateTracking(candidate)
  }));

  const interviews = [
    {
      id: "int-001",
      candidateId: "cand-001",
      jobId: "job-001",
      round: "L2",
      scheduledAt: daysAgo(-2),
      status: "Scheduled"
    },
    {
      id: "int-002",
      candidateId: "cand-004",
      jobId: "job-004",
      round: "Client",
      scheduledAt: daysAgo(4),
      status: "Completed"
    },
    {
      id: "int-003",
      candidateId: "cand-002",
      jobId: "job-002",
      round: "L1",
      scheduledAt: daysAgo(-1),
      status: "Scheduled"
    }
  ];

  const placements = [
    {
      id: "plc-001",
      candidateId: "cand-005",
      jobId: "job-001",
      recruiter: "Ravi Mehta",
      revenue: 9000,
      cost: 2500,
      margin: 6500,
      date: daysAgo(8)
    }
  ];

  const activities = [
    {
      id: "act-001",
      type: "system",
      message: "Demo dataset initialized",
      timestamp: new Date().toISOString()
    },
    {
      id: "act-002",
      type: "pipeline",
      message: "Arjun Malhotra moved to Offer",
      timestamp: new Date(Date.now() - 1000 * 60 * 35).toISOString()
    },
    {
      id: "act-003",
      type: "users",
      message: "User created: Anika Shah (Recruiter)",
      timestamp: new Date(Date.now() - 1000 * 60 * 130).toISOString()
    }
  ];

  return { bulkUpload, users, candidates: candidatesWithDetails, clients, jobs, interviews, placements, activities };
}

function findById(collection, id) {
  return collection.find((item) => item.id === id);
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function splitComma(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function daysAgo(numberOfDays) {
  const base = new Date();
  base.setDate(base.getDate() - numberOfDays);
  return base.toISOString().split("T")[0];
}

function daysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;

  const ms = endDate.getTime() - startDate.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function isCurrentMonth(dateText) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
}

function isCurrentYear(dateText) {
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return false;

  return date.getFullYear() === new Date().getFullYear();
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function singularLabel(value) {
  if (value.endsWith("s")) return value.slice(0, -1);
  return value;
}

function sanitizeLine(value, maxLength = 120) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
