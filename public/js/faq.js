(function () {
  const triggers = document.querySelectorAll(".faq-card-trigger");
  if (!triggers.length) return;

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const card = trigger.closest(".faq-card");
      const panel = card?.querySelector(".faq-card-panel");
      if (!panel) return;

      const isOpen = trigger.getAttribute("aria-expanded") === "true";

      trigger.setAttribute("aria-expanded", String(!isOpen));
      panel.hidden = isOpen;
      card.classList.toggle("is-open", !isOpen);
    });
  });
})();
