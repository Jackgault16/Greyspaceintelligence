/* ============================================================
   GLOBAL MENU + NAVIGATION
   ============================================================ */

const menuButton = document.getElementById("menuButton");
const sideMenu = document.getElementById("sideMenu");
const closeMenu = document.getElementById("closeMenu");
const menuOverlay = document.getElementById("menuOverlay");

function openMenu() {
    if (!sideMenu || !menuOverlay) return;
    sideMenu.classList.add("open");
    menuOverlay.classList.add("visible");
}

function closeMenuPanel() {
    if (!sideMenu || !menuOverlay) return;
    sideMenu.classList.remove("open");
    menuOverlay.classList.remove("visible");
}

if (menuButton) menuButton.addEventListener("click", openMenu);
if (closeMenu) closeMenu.addEventListener("click", closeMenuPanel);
if (menuOverlay) menuOverlay.addEventListener("click", closeMenuPanel);

