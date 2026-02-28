/* ============================================================
   GLOBAL MENU + NAVIGATION
   ============================================================ */

function initMenu() {
    const menuButton = document.getElementById("menuButton");
    const sideMenu = document.getElementById("sideMenu");
    const closeMenu = document.getElementById("closeMenu");
    const menuOverlay = document.getElementById("menuOverlay");

    if (!menuButton || !sideMenu || !closeMenu || !menuOverlay) return;
    if (menuButton.dataset.menuBound === "1") return;

    const openMenu = () => {
        sideMenu.classList.add("open");
        menuOverlay.classList.add("visible");
    };

    const closeMenuPanel = () => {
        sideMenu.classList.remove("open");
        menuOverlay.classList.remove("visible");
    };

    menuButton.addEventListener("click", openMenu);
    closeMenu.addEventListener("click", closeMenuPanel);
    menuOverlay.addEventListener("click", closeMenuPanel);

    menuButton.dataset.menuBound = "1";
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initMenu);
} else {
    initMenu();
}
