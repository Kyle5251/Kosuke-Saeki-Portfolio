(function () {
  "use strict";

  // 公開前にこの値を true にすると、編集モードの機能自体が無効化されます。
  var SITE_LOCKED = false;

  if (SITE_LOCKED) return;

  var TEXT_SELECTOR =
    ".page-header h1, .profile-summary__text h1, .profile-summary__text p, " +
    ".detail-section h2, .detail-section p, .detail-section li, .nav-card__label";
  var IMG_SELECTOR =
    ".banner img, .profile-summary__photo img, .detail-section img.section-thumb, " +
    ".detail-section .photo-digest img, .profile-summary__photo img, .photo-grid img";
  var BG_SELECTOR = ".nav-card--photo";

  var pageKey = location.pathname;
  var onKey = "editModeOn";

  function isEditOn() {
    var v = localStorage.getItem(onKey);
    return v === null ? true : v === "1";
  }

  function setEditOn(v) {
    localStorage.setItem(onKey, v ? "1" : "0");
  }

  function storageKey(type, index) {
    return "edit:" + type + ":" + pageKey + ":" + index;
  }

  function restore() {
    var texts = document.querySelectorAll(TEXT_SELECTOR);
    texts.forEach(function (el, i) {
      var saved = localStorage.getItem(storageKey("text", i));
      if (saved !== null) el.textContent = saved;
    });

    var imgs = document.querySelectorAll(IMG_SELECTOR);
    imgs.forEach(function (el, i) {
      var saved = localStorage.getItem(storageKey("img", i));
      if (saved !== null) el.src = saved;
    });

    var bgs = document.querySelectorAll(BG_SELECTOR);
    bgs.forEach(function (el, i) {
      var saved = localStorage.getItem(storageKey("bg", i));
      if (saved !== null) el.style.backgroundImage = "url('" + saved + "')";
    });
  }

  function resizeImageFile(file, maxDim, quality, callback) {
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        var w = Math.round(img.width * scale);
        var h = Math.round(img.height * scale);
        var canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  var fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/*";
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);

  var pendingTarget = null;

  fileInput.addEventListener("change", function () {
    if (!fileInput.files || !fileInput.files[0] || !pendingTarget) return;
    resizeImageFile(fileInput.files[0], 900, 0.85, function (dataUrl) {
      var type = pendingTarget.dataset.editType;
      var idx = pendingTarget.dataset.editIndex;
      if (type === "bg") {
        pendingTarget.el.style.backgroundImage = "url('" + dataUrl + "')";
      } else {
        pendingTarget.el.src = dataUrl;
      }
      localStorage.setItem(storageKey(type, idx), dataUrl);
      pendingTarget = null;
      fileInput.value = "";
    });
  });

  function applyEditability() {
    var on = isEditOn();
    document.body.classList.toggle("edit-mode-active", on);

    var texts = document.querySelectorAll(TEXT_SELECTOR);
    texts.forEach(function (el) {
      el.contentEditable = on ? "true" : "false";
    });

    var imgs = document.querySelectorAll(IMG_SELECTOR);
    imgs.forEach(function (el, i) {
      el.dataset.editType = "img";
      el.dataset.editIndex = i;
      el.style.cursor = on ? "pointer" : "";
    });

    var bgs = document.querySelectorAll(BG_SELECTOR);
    bgs.forEach(function (el, i) {
      el.dataset.editType = "bg";
      el.dataset.editIndex = i;
    });
  }

  function attachTextSaveHandlers() {
    var texts = document.querySelectorAll(TEXT_SELECTOR);
    texts.forEach(function (el, i) {
      el.addEventListener("blur", function () {
        if (!isEditOn()) return;
        localStorage.setItem(storageKey("text", i), el.textContent);
      });
    });
  }

  function attachImageClickHandlers() {
    document.addEventListener("click", function (e) {
      if (!isEditOn()) return;
      var target = e.target.closest(IMG_SELECTOR + ", " + BG_SELECTOR);
      if (!target) return;
      e.preventDefault();
      pendingTarget = { el: target };
      var isBg = target.classList.contains("nav-card--photo");
      pendingTarget.dataset = {
        editType: isBg ? "bg" : "img",
        editIndex: target.dataset.editIndex,
      };
      pendingTarget.el.dataset.editType = isBg ? "bg" : "img";
      fileInput.click();
    });
  }

  function buildPanel() {
    var panel = document.createElement("div");
    panel.className = "edit-panel";
    panel.innerHTML =
      '<span class="edit-panel__label">編集モード</span>' +
      '<button type="button" data-action="toggle"></button>' +
      '<button type="button" data-action="export">保存(ダウンロード)</button>' +
      '<button type="button" data-action="reset">リセット</button>';
    document.body.appendChild(panel);

    var toggleBtn = panel.querySelector('[data-action="toggle"]');

    function refreshToggleLabel() {
      toggleBtn.textContent = isEditOn() ? "ON" : "OFF";
    }
    refreshToggleLabel();

    toggleBtn.addEventListener("click", function () {
      setEditOn(!isEditOn());
      applyEditability();
      refreshToggleLabel();
    });

    panel.querySelector('[data-action="export"]').addEventListener("click", function () {
      var clone = document.documentElement.cloneNode(true);
      var editPanel = clone.querySelector(".edit-panel");
      if (editPanel) editPanel.remove();
      var script = clone.querySelector('script[src="edit-mode.js"]');
      if (script) script.remove();
      var html = "<!doctype html>\n" + clone.outerHTML;
      var blob = new Blob([html], { type: "text/html" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (pageKey.replace(/^\//, "") || "index.html").replace(/\/$/, "index.html");
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    panel.querySelector('[data-action="reset"]').addEventListener("click", function () {
      if (!confirm("このページの編集内容をすべて元に戻しますか？")) return;
      var keys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k.indexOf("edit:") === 0 && k.indexOf(":" + pageKey + ":") > -1) keys.push(k);
      }
      keys.forEach(function (k) {
        localStorage.removeItem(k);
      });
      location.reload();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    restore();
    applyEditability();
    attachTextSaveHandlers();
    attachImageClickHandlers();
    buildPanel();
  });
})();
