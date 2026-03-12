/**
 * IMBONI EDUCATION CONNECTS - Dashboard JavaScript
 * Handles sidebar navigation, tabs, and interactive components
 */

// ===============================================
// SIDEBAR FUNCTIONALITY
// ===============================================

const sidebar = document.querySelector(".sidebar");
const sidebarToggle = document.querySelector(".sidebar-toggle");
const menuToggle = document.querySelector(".menu-toggle");
const mobileMenuBtn = document.querySelector(".mobile-menu-btn");
const sidebarOverlay = document.querySelector(".sidebar-overlay");

/**
 * Toggle mobile sidebar (off-canvas)
 */
function toggleMobileSidebar() {
  if (!sidebar) return;

  const isActive = sidebar.classList.contains("active");

  if (isActive) {
    closeMobileSidebar();
  } else {
    openMobileSidebar();
  }
}

/**
 * Open mobile sidebar
 */
function openMobileSidebar() {
  if (!sidebar) return;

  sidebar.classList.add("active");
  if (sidebarOverlay) {
    sidebarOverlay.classList.add("active");
  }
  document.body.style.overflow = "hidden"; // Prevent body scroll

  // Update menu toggle icon if it exists
  if (menuToggle) {
    const icon = menuToggle.querySelector("span");
    if (icon) {
      icon.textContent = "close";
    }
  }
}

/**
 * Close mobile sidebar
 */
function closeMobileSidebar() {
  if (!sidebar) return;

  sidebar.classList.remove("active");
  if (sidebarOverlay) {
    sidebarOverlay.classList.remove("active");
  }
  document.body.style.overflow = "";

  // Update menu toggle icon if it exists
  if (menuToggle) {
    const icon = menuToggle.querySelector("span");
    if (icon) {
      icon.textContent = "menu";
    }
  }
}

// Mobile menu button click handler (in header)
if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener("click", function(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleMobileSidebar();
  });
}

// Menu toggle button click handler (inside sidebar)
if (menuToggle) {
  menuToggle.addEventListener("click", function(e) {
    e.preventDefault();
    e.stopPropagation();
    toggleMobileSidebar();
  });
}

// Sidebar overlay click handler
if (sidebarOverlay) {
  sidebarOverlay.addEventListener("click", function(e) {
    e.preventDefault();
    e.stopPropagation();
    closeMobileSidebar();
  });
}

// Close sidebar on escape key
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeMobileSidebar();
  }
});

// Desktop sidebar toggle (horizontal collapse)
if (sidebarToggle) {
  sidebarToggle.addEventListener("click", function(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Only work on desktop
    if (window.innerWidth >= 1024) {
      sidebar.classList.toggle("collapsed");

      // Update toggle icon
      const toggleIcon = sidebarToggle.querySelector("span");
      if (toggleIcon) {
        const isCollapsed = sidebar.classList.contains("collapsed");
        toggleIcon.style.transform = isCollapsed ? "rotate(180deg)" : "";
      }
    }
  });
}

// ===============================================
// TAB SWITCHING
// ===============================================

/**
 * Switch between tabs
 * @param {string} tabName - The name of the tab to show
 * @param {Event} event - The click event
 */
function showTab(tabName, event) {
  if (event) {
    event.preventDefault();
  }

  // Hide all tab contents
  const allTabs = document.querySelectorAll(".tabs-content");
  allTabs.forEach((tab) => {
    tab.classList.remove("active");
  });

  // Remove active class from all triggers
  const allTriggers = document.querySelectorAll(".tabs-trigger");
  allTriggers.forEach((trigger) => {
    trigger.classList.remove("active");
  });

  // Show selected tab
  const selectedTab = document.getElementById(`${tabName}-tab`);
  if (selectedTab) {
    selectedTab.classList.add("active");
  }

  // Add active class to clicked trigger
  if (event && event.target) {
    const trigger = event.target.closest(".tabs-trigger");
    if (trigger) {
      trigger.classList.add("active");
    }
  }
}

// ===============================================
// DATE DISPLAY
// ===============================================

function updateDateDisplay() {
  const dateDisplay = document.querySelector(".date-display");
  if (dateDisplay) {
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const currentDate = new Date().toLocaleDateString("en-US", options);
    dateDisplay.textContent = currentDate;
  }
}

// ===============================================
// PROGRESS BAR ANIMATION
// ===============================================

function animateProgress() {
  const progressBars = document.querySelectorAll(".progress-bar");
  progressBars.forEach((bar) => {
    const targetWidth = bar.getAttribute("data-value");
    if (targetWidth) {
      bar.style.width = targetWidth + "%";
    }
  });
}

// ===============================================
// SMOOTH SCROLL
// ===============================================

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    const href = this.getAttribute("href");
    if (href !== "#") {
      e.preventDefault();
      const target = document.querySelector(href);
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }
  });
});

// ===============================================
// NOTIFICATION BADGE
// ===============================================

function updateNotificationBadge() {
  const badge = document.querySelector(".notification-badge");
  if (badge) {
    // In a real app, this would fetch from an API
    // For now, we just show/hide based on a data attribute
    const hasNotifications =
      document.body.getAttribute("data-has-notifications") === "true";
    badge.style.display = hasNotifications ? "flex" : "none";
  }
}

// ===============================================
// INITIALIZATION
// ===============================================

document.addEventListener("DOMContentLoaded", function () {
  console.log("Dashboard loaded successfully");

  // Update date display
  updateDateDisplay();

  // Animate progress bars
  animateProgress();

  // Update notification badge
  updateNotificationBadge();

  // Ensure sidebar is closed on page load (mobile)
  if (window.innerWidth < 1024) {
    closeMobileSidebar();
  }

  // Handle responsive sidebar on resize
  let resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      // Close mobile sidebar on resize to desktop
      if (window.innerWidth >= 1024) {
        closeMobileSidebar();
        // Remove collapsed class if was set
        sidebar.classList.remove("collapsed");
      }
    }, 250);
  });
});

// ===============================================
// UTILITY FUNCTIONS
// ===============================================

/**
 * Format number with thousand separators
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Debounce function for performance
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
