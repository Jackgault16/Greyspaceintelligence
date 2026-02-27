const blocks = document.querySelectorAll(".about-block");

function revealBlocks() {
    const trigger = window.innerHeight * 0.75;

    blocks.forEach(block => {
        const top = block.getBoundingClientRect().top;
        if (top < trigger) {
            block.classList.add("visible");
        }
    });
}

window.addEventListener("scroll", revealBlocks);
window.addEventListener("load", revealBlocks);