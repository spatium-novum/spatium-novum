(function () {
  "use strict";

  var forms = document.querySelectorAll("[data-newsletter-form]");
  if (!forms.length || !window.fetch || !window.FormData || !window.URLSearchParams) {
    return;
  }

  forms.forEach(function (form) {
    form.addEventListener("submit", function (event) {
      if (!form.checkValidity()) {
        event.preventDefault();
        form.reportValidity();
        return;
      }

      event.preventDefault();
      var button = form.querySelector("[data-newsletter-submit]");
      var status = form.querySelector("[data-newsletter-status]");
      var success = form.parentElement.querySelector("[data-newsletter-success]");
      var originalLabel = button.textContent;
      var body = new URLSearchParams();

      new FormData(form).forEach(function (value, key) {
        if (typeof value === "string") {
          body.append(key, value);
        }
      });

      button.disabled = true;
      button.textContent = "Sending…";
      status.textContent = "";
      status.removeAttribute("data-state");

      fetch(form.action, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        cache: "no-store",
        referrerPolicy: "no-referrer",
        body: body
      }).then(function (response) {
        if (!response.ok) {
          throw new Error("MailerLite returned an HTTP error");
        }
        return response.json();
      }).then(function (payload) {
        if (!payload || payload.success !== true) {
          throw new Error("MailerLite rejected the subscription");
        }
        form.hidden = true;
        success.hidden = false;
        success.focus();
      }).catch(function () {
        button.disabled = false;
        button.textContent = originalLabel;
        status.setAttribute("data-state", "error");
        status.textContent = "The form could not connect. Use the MailerLite signup link below.";
        var fallback = form.querySelector("[data-newsletter-fallback]");
        if (fallback) {
          fallback.hidden = false;
        }
      });
    });
  });
}());
