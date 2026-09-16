(function () {
  "use strict";

  // =============================
  // 설정
  // =============================

  const COMPLETED_STATUSES = ["Approved", "Completed", "Canceled", "Rejected"];

  // =============================
  // 공통 함수
  // =============================

  function lockAll(record) {
    Object.keys(record).forEach(function (field) {
      if (record[field] && typeof record[field].disabled !== "undefined") {
        record[field].disabled = true;
      }
    });
  }

  function unlockAll(record) {
    Object.keys(record).forEach(function (field) {
      if (record[field] && typeof record[field].disabled !== "undefined") {
        record[field].disabled = false;
      }
    });
  }

  function getAssigneeCodes(record) {
    var assignee = record["Assignee"];
    if (!assignee || !assignee.value) return [];
    return assignee.value.map(function (a) { return a.code; });
  }

  function getApplicantCode(record) {
    var createdBy = record["Created_by"];
    if (!createdBy || !createdBy.value) return null;
    if (Array.isArray(createdBy.value)) {
      return createdBy.value.length > 0 ? createdBy.value[0].code : null;
    }
    return createdBy.value.code || null;
  }

  // 확인 버튼을 눌러야 이동하는 모달 배너
  function showBannerAndRedirect(message, type, url) {
    var old = document.querySelector(".custom-msg-overlay");
    if (old) old.remove();

    var styles = {
      error:   { bg: "#ffecec", color: "#d93025", border: "2px solid #d93025", btnBg: "#d93025" },
      warning: { bg: "#fff8e1", color: "#f57c00", border: "2px solid #f57c00", btnBg: "#f57c00" },
      info:    { bg: "#e8f4fd", color: "#1565c0", border: "2px solid #1565c0", btnBg: "#1565c0" }
    };
    var s = styles[type] || styles["error"];

    // 어두운 배경 오버레이
    var overlay = document.createElement("div");
    overlay.className = "custom-msg-overlay";
    overlay.style.position   = "fixed";
    overlay.style.top        = "0";
    overlay.style.left       = "0";
    overlay.style.width      = "100%";
    overlay.style.height     = "100%";
    overlay.style.background = "rgba(0,0,0,0.5)";
    overlay.style.zIndex     = "99998";
    document.body.appendChild(overlay);

    // 메시지 박스
    var box = document.createElement("div");
    box.style.position     = "fixed";
    box.style.top          = "50%";
    box.style.left         = "50%";
    box.style.transform    = "translate(-50%, -50%)";
    box.style.zIndex       = "99999";
    box.style.background   = s.bg;
    box.style.color        = s.color;
    box.style.border       = s.border;
    box.style.padding      = "40px 48px";
    box.style.borderRadius = "12px";
    box.style.fontWeight   = "700";
    box.style.fontSize     = "22px";
    box.style.textAlign    = "center";
    box.style.boxShadow    = "0 8px 32px rgba(0,0,0,0.25)";
    box.style.minWidth     = "420px";
    box.style.lineHeight   = "1.6";

    // 메시지 텍스트
    var msg = document.createElement("p");
    msg.textContent      = message;
    msg.style.margin     = "0 0 28px 0";
    box.appendChild(msg);

    // 확인 버튼
    var btn = document.createElement("button");
    btn.textContent          = "확인";
    btn.style.background     = s.btnBg;
    btn.style.color          = "#fff";
    btn.style.border         = "none";
    btn.style.padding        = "14px 48px";
    btn.style.borderRadius   = "8px";
    btn.style.fontSize       = "18px";
    btn.style.fontWeight     = "700";
    btn.style.cursor         = "pointer";
    btn.style.letterSpacing  = "1px";
    btn.addEventListener("click", function () {
      overlay.remove();
      box.remove();
      window.location.href = url;
    });
    box.appendChild(btn);

    document.body.appendChild(box);
  }

  // 수정 화면 헤더 배너 (승인자 안내용)
  function showBanner(message, type) {
    var el = null;
    try { el = kintone.app.record.getHeaderMenuSpaceElement(); } catch (e) {}
    if (!el) {
      try { el = kintone.app.getHeaderMenuSpaceElement(); } catch (e) {}
    }
    if (!el) return;

    var old = el.querySelector(".custom-msg");
    if (old) old.remove();

    var styles = {
      error:   { bg: "#ffecec", color: "#d93025", border: "2px solid #d93025" },
      warning: { bg: "#fff8e1", color: "#f57c00", border: "2px solid #f57c00" },
      info:    { bg: "#e8f4fd", color: "#1565c0", border: "2px solid #1565c0" }
    };
    var s = styles[type] || styles["warning"];

    var div = document.createElement("div");
    div.className          = "custom-msg";
    div.textContent        = message;
    div.style.background   = s.bg;
    div.style.color        = s.color;
    div.style.border       = s.border;
    div.style.padding      = "16px 24px";
    div.style.margin       = "12px 0";
    div.style.borderRadius = "8px";
    div.style.fontWeight   = "700";
    div.style.fontSize     = "20px";
    div.style.lineHeight   = "1.6";
    el.appendChild(div);
  }

  // =============================
  // 상세 화면 — 수정 버튼 숨기기
  // =============================
  kintone.events.on("app.record.detail.show", function (event) {
    var user      = kintone.getLoginUser().code;
    var record    = event.record;
    var status    = record["Status"].value;
    var applicant = getApplicantCode(record);
    var assignees = getAssigneeCodes(record);

    var isCompleted = COMPLETED_STATUSES.includes(status);
    var isApplicant = user === applicant;
    var isApprover  = assignees.includes(user);

    if (isApplicant || isCompleted || !isApprover) {
      var editBtn = document.querySelector(".gaia-argoui-app-menu-edit");
      if (editBtn) editBtn.style.display = "none";
    }

    return event;
  });

  // =============================
  // 수정 화면
  // =============================
  kintone.events.on("app.record.edit.show", function (event) {
    var record    = event.record;
    var user      = kintone.getLoginUser().code;
    var status    = record["Status"].value;
    var applicant = getApplicantCode(record);
    var assignees = getAssigneeCodes(record);
    var appId     = kintone.app.getId();
    var recordId  = event.recordId;
    var url       = "/k/" + appId + "/show#record=" + recordId;

    // 완료 상태 → 모달 배너 + 확인 후 이동
    if (COMPLETED_STATUSES.includes(status)) {
      showBannerAndRedirect("이 문서는 완료되어 수정할 수 없습니다.", "error", url);
      return false;
    }

    // 기안자 → 모달 배너 + 확인 후 이동
    if (user === applicant) {
      showBannerAndRedirect("기안자는 수정이 불가능합니다.", "error", url);
      return false;
    }

    // 기본 전체 잠금
    lockAll(record);

    // 현재 담당자(Assignee) → 잠금 해제 + 헤더 안내 배너
    if (assignees.includes(user)) {
      unlockAll(record);
      showBanner("현재 승인 단계입니다. 검토 후 저장해주세요.", "warning");
      return event;
    }

    // 제3자 → 모달 배너 + 확인 후 이동
    showBannerAndRedirect("수정 권한이 없습니다.", "error", url);
    return false;
  });

  // =============================
  // 저장 시 이중 차단
  // =============================
  kintone.events.on("app.record.edit.submit", function (event) {
    var record    = event.record;
    var user      = kintone.getLoginUser().code;
    var status    = record["Status"].value;
    var applicant = getApplicantCode(record);
    var assignees = getAssigneeCodes(record);

    if (user === applicant) {
      event.error = "기안자는 수정이 불가능합니다.";
      return event;
    }

    if (COMPLETED_STATUSES.includes(status)) {
      event.error = "이 문서는 완료되어 수정할 수 없습니다.";
      return event;
    }

    if (!assignees.includes(user)) {
      event.error = "수정 권한이 없습니다.";
      return event;
    }

    return event;
  });

})();