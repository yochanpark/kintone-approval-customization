# 3. 여러 앱에 쓰는 편집 잠금, Excel 가져오기 값 유실

## 편집 잠금을 모든 결재 앱에 — 필드 구조가 앱마다 다르다

편집 잠금([1. 편집 잠금](01-edit-lock.md))을 일반결재 외 다른 결재 앱에도 넣어야 했다.
완료 상태 목록은 같았지만 **승인자를 담는 필드가 앱마다 달랐다** — 사용자 선택 필드인 앱,
이름을 텍스트로 적는 앱, 처리 담당자만 쓰는 앱이 섞여 있었다.

| 처음 | 바꾼 것 |
|---|---|
| 승인자 필드를 코드에 하드코딩한 매핑 | 앱마다 `CONFIG`만 채우면 되게 |
| 필드 코드 `Status` · `Created_by` | 시스템 필드 `$status` · `$creator` (앱마다 필드 코드가 달라도 같음) |
| 현재 담당자만 편집 | 그 건의 **모든 승인 담당자**가 편집 가능하게(요구 변경) |

```js
// 요지 — 실제 코드는 배너·모달·이벤트 등록까지 포함한다
const CONFIG = {
  COMPLETED_STATUSES: ["Approved", "Completed", "Canceled", "Rejected"],
  ALL_ASSIGNEE_FIELDS: ["first_assignee", "second_assignee", "third_assignee"],
  EDIT_BUTTON_CLASS: "<앱 화면에서 확인한 수정 버튼 클래스>",
};

// 필드 형식마다 비교 방법이 다르다
function isUserAnAssignee(record, user) {
  return CONFIG.ALL_ASSIGNEE_FIELDS.some((code) => {
    const f = record[code];
    if (!f) return false;
    if (f.type === "USER_SELECT" || f.type === "STATUS_ASSIGNEE")
      return f.value.some((u) => u.code === user.code);     // 코드로 비교
    if (f.type === "SINGLE_LINE_TEXT")
      return f.value === user.name;                         // 이름으로 비교(피할 수 없는 앱이 있다)
    return false;
  });
}
```

- 현재 처리 담당자 필드는 형식(`STATUS_ASSIGNEE`)으로 **자동 탐지**한다 — 앱마다 필드 코드가 달라서
- 저장 시점(`submit`)에 서버 기준으로 **한 번 더 판정**한다 — 화면에서 열린 채 상태가 바뀐 경우까지
- 막을 때는 일정 시간 뒤 자동 이동이 아니라 **확인 버튼을 눌러야** 이동하는 모달 — 사용자가 이유를 읽게
- 외부 분석에서 제안된 `record.assignees`는 Kintone API에 없는 속성이었다 — 필드 형식 탐지로 대신했다

### 앱마다 CONFIG를 채우는 콘솔 도구

새 앱에 넣을 때마다 필드 코드를 화면에서 찾지 않도록, 앱 화면 콘솔에 붙여 넣으면
**상태 값, 현재 담당자 코드, 작성자 코드, 수정 버튼 클래스**를 출력하고 바로 복사할 수 있는 `CONFIG` 블록을 만들어 주는 스크립트를 따로 두었다.

## Excel 첨부에서 읽은 값이 저장하면 사라진다

결재 앱 하나는 Excel 파일을 첨부하면 정해진 셀(병합된 G2)의 참조번호를 읽어 텍스트 필드에 자동으로 넣는다.
화면에는 값이 들어가는데 **저장하면 비어 있었다.**

로그를 단계마다 찍어 범위를 좁혔다.

```
[읽기]  G2 셀 값          → 정상
[SET]   필드에 값 설정      → 정상 (type: SINGLE_LINE_TEXT)
[FINAL] 저장 직전 레코드    → 정상
저장 후 레코드              → 빈 값
```

코드가 넣은 값은 저장 직전까지 맞았다. 앱에 설치된 **부분 일치 검색 플러그인**이 저장 과정에서
같은 필드를 검색용으로 다시 써서 값을 덮고 있었다. 이 필드는 검색에 꼭 필요해서 플러그인에서 뺄 수 없었다.

우회: 읽은 값을 클로저 변수와 `sessionStorage`에 함께 보관하고(저장 중 페이지가 바뀌어도 남게),
**저장 성공 이벤트에서 REST API로 첨부 필드와 함께 다시 기록**하게 했다.

```js
// 요지
kintone.events.on("app.record.create.submit.success", async (event) => {
  const value = savedRefNo || sessionStorage.getItem("refNo") || "";
  await client.record.updateRecord({
    app: event.appId,
    id: event.recordId || event.record.$id.value,
    record: { [ATTACHMENT_FIELD]: { value: attachments }, [REF_NO_FIELD]: { value } },
  });
  sessionStorage.removeItem("refNo");
  return event;
});
```

> 교훈: 코드가 넣은 값이 저장 뒤에 바뀌면, 코드보다 **같은 필드를 건드리는 플러그인·자동 계산**을 먼저 의심한다.
