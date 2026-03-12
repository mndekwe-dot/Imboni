/**
 * IMBONI EDUCATION CONNECTS - Sidebar Component
 * Injects the correct sidebar for each portal and auto-highlights the active page.
 *
 * Usage in HTML:
 *   <aside class="sidebar" data-role="teacher"></aside>   <!-- Teacher portal -->
 *   <aside class="sidebar" data-role="parent"></aside>    <!-- Parent portal  -->
 *   <aside class="sidebar" data-role="dos"></aside>       <!-- DOS portal     -->
 *
 *   For the shared account page:
 *   <aside class="sidebar" data-role="auto"></aside>
 *   Link to it with: account.html?role=teacher  /  account.html?role=dos  /  account.html
 */

(function () {
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  // Determine role: from data-role attribute, or from ?role= URL param (for shared account page)
  let role = sidebar.dataset.role;
  if (!role || role === "auto") {
    const params = new URLSearchParams(window.location.search);
    role = params.get("role") || "parent";
  }

  // Current page filename (without query string) for active-link detection
  const currentPage =
    window.location.pathname.split("/").pop() || "index.html";

  // ─────────────────────────────────────────────
  // SIDEBAR TEMPLATES
  // ─────────────────────────────────────────────

  const templates = {
    // ── Teacher Portal ─────────────────────────
    teacher: `
      <header class="sidebar-logo">
        <div class="logo-wrapper">
          <div class="sidebar-logo-icon">
            <img src="../images/imboni-logo.png" alt="Imboni Logo" />
          </div>
          <span class="sidebar-logo-text">Imboni</span>
        </div>
        <button class="toggle sidebar-toggle" aria-label="Toggle sidebar">
          <span class="material-symbols-rounded">chevron_left</span>
        </button>
      </header>

      <div class="sidebar-user-profile">
        <div class="sidebar-user-avatar">
          <img src="../images/imboni-logo.png" alt="User Avatar" />
        </div>
        <div class="sidebar-user-info">
          <h3 class="sidebar-user-name">Grace Mwangi</h3>
          <p class="sidebar-user-role">Teacher</p>
        </div>
      </div>

      <nav class="sidebar-nav">
        <ul class="nav-list primary-nav">
          <li>
            <a href="teacher.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">dashboard</span>
              <span>Dashboard</span>
            </a>
          </li>
          <li>
            <a href="teacher-classes.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">book</span>
              <span>My Classes</span>
            </a>
          </li>
          <li>
            <a href="teacher-students.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">people</span>
              <span>Students</span>
            </a>
          </li>
          <li>
            <a href="attendance.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">fact_check</span>
              <span>Attendance</span>
            </a>
          </li>
          <li>
            <a href="results.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">school</span>
              <span>Results</span>
            </a>
          </li>
          <li>
            <a href="announcements.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">announcement</span>
              <span>Announcements</span>
            </a>
          </li>
          <li>
            <a href="teacher-messages.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">chat</span>
              <span>Messages</span>
            </a>
          </li>
        </ul>
        <ul class="nav-list secondary-nav">
          <li>
            <a href="../Parent/account.html?role=teacher" class="sidebar-nav-item">
              <span class="material-symbols-rounded">account_circle</span>
              <span>Account</span>
            </a>
          </li>
          <li>
            <a href="../index.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">logout</span>
              <span>Logout</span>
            </a>
          </li>
        </ul>
      </nav>
    `,

    // ── Parent Portal ───────────────────────────
    parent: `
      <header class="sidebar-logo">
        <div class="logo-wrapper">
          <div class="sidebar-logo-icon">
            <img src="../images/imboni-logo.png" alt="Imboni Logo" />
          </div>
          <span class="sidebar-logo-text">Imboni</span>
        </div>
        <button class="toggle sidebar-toggle" aria-label="Toggle sidebar">
          <span class="material-symbols-rounded">chevron_left</span>
        </button>
        <button class="toggle menu-toggle" aria-label="Open menu">
          <span class="material-symbols-rounded">menu</span>
        </button>
      </header>

      <div class="sidebar-user-profile">
        <div class="sidebar-user-avatar">
          <img src="../images/imboni-logo.png" alt="User Avatar" />
        </div>
        <div class="sidebar-user-info">
          <h3 class="sidebar-user-name">Grace Mwangi</h3>
          <p class="sidebar-user-role">Parent</p>
        </div>
      </div>

      <nav class="sidebar-nav">
        <ul class="nav-list primary-nav">
          <li>
            <a href="parent.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">dashboard</span>
              <span>Dashboard</span>
            </a>
          </li>
          <li>
            <a href="my-children.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">family_history</span>
              <span>My Children</span>
            </a>
          </li>
          <li>
            <a href="parent-results.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">assessment</span>
              <span>Results</span>
            </a>
          </li>
          <li>
            <a href="parent-attendance.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">people</span>
              <span>Attendance</span>
            </a>
          </li>
          <li>
            <a href="parent-behavior.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">person</span>
              <span>Behaviour</span>
            </a>
          </li>
          <li>
            <a href="parent-announcements.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">announcement</span>
              <span>Announcements</span>
            </a>
          </li>
        </ul>
        <ul class="nav-list secondary-nav">
          <li>
            <a href="account.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">account_circle</span>
              <span>Account</span>
            </a>
          </li>
          <li>
            <a href="../index.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">logout</span>
              <span>Logout</span>
            </a>
          </li>
        </ul>
      </nav>
    `,

    // ── Director of Studies Portal ──────────────
    dos: `
      <header class="sidebar-logo">
        <div class="logo-wrapper">
          <div class="sidebar-logo-icon">
            <img src="../images/imboni-logo.png" alt="Imboni Logo" />
          </div>
          <span class="sidebar-logo-text">Imboni</span>
        </div>
        <button class="toggle sidebar-toggle" aria-label="Toggle sidebar">
          <span class="material-symbols-rounded">chevron_left</span>
        </button>
      </header>

      <div class="sidebar-user-profile">
        <div class="sidebar-user-avatar">
          <img src="../images/imboni-logo.png" alt="User Avatar" />
        </div>
        <div class="sidebar-user-info">
          <h3 class="sidebar-user-name">Grace Mwangi</h3>
          <p class="sidebar-user-role">Director of Studies</p>
        </div>
      </div>

      <nav class="sidebar-nav">
        <ul class="nav-list primary-nav">
          <li>
            <a href="dos.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">dashboard</span>
              <span>Dashboard</span>
            </a>
          </li>
          <li>
            <a href="dos-analytics.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">bar_chart</span>
              <span>Analytics</span>
            </a>
          </li>
          <li>
            <a href="dos-results-approval.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">check_circle</span>
              <span>Results Approval</span>
            </a>
          </li>
          <li>
            <a href="dos-teachers.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">person</span>
              <span>Teachers</span>
            </a>
          </li>
          <li>
            <a href="dos-students.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">group</span>
              <span>Students</span>
            </a>
          </li>
          <li>
            <a href="dos-attendance.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">fact_check</span>
              <span>Attendance</span>
            </a>
          </li>
          <li>
            <a href="dos-exam-schedule.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">calendar_today</span>
              <span>Exams Schedule</span>
            </a>
          </li>
          <li>
            <a href="dos-announcement.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">announcement</span>
              <span>Announcements</span>
            </a>
          </li>
          <li>
            <a href="dos-message.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">chat</span>
              <span>Messages</span>
            </a>
          </li>
        </ul>
        <ul class="nav-list secondary-nav">
          <li>
            <a href="../Parent/account.html?role=dos" class="sidebar-nav-item">
              <span class="material-symbols-rounded">account_circle</span>
              <span>Account</span>
            </a>
          </li>
          <li>
            <a href="../index.html" class="sidebar-nav-item">
              <span class="material-symbols-rounded">logout</span>
              <span>Logout</span>
            </a>
          </li>
        </ul>
      </nav>
    `,
  };

  // Inject the sidebar HTML
  sidebar.innerHTML = templates[role] || "";

  // ─────────────────────────────────────────────
  // AUTO-HIGHLIGHT ACTIVE LINK
  // Strips query params from href before comparing so account.html?role=teacher
  // correctly matches when currentPage is "account.html"
  // ─────────────────────────────────────────────
  sidebar.querySelectorAll(".sidebar-nav-item").forEach(function (link) {
    const href = link.getAttribute("href") || "";
    const hrefPage = href.split("?")[0].split("/").pop();
    if (hrefPage && hrefPage === currentPage) {
      link.classList.add("active");
    }
  });
})();
