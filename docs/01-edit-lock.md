# 1. 역할·상태 기반 편집 잠금

## 문제

일반결재 앱에서 **모든 승인이 끝난 뒤에도 기안자가 수정 기능으로 금액과 내용을 바꿀 수 있었다.**
결재가 끝난 문서의 금액이 사후에 바뀔 수 있다는 뜻이라, 악용되면 통제가 무너진다.

요구는 이랬다. *기안자는 금액을 수정할 수 없고, 다음 승인자는 수정할 수 있게 한다.*

## 설계 — 한 겹으로 막지 않는다

수정 버튼을 숨기는 것만으로는 부족하다. URL을 직접 치면 편집 화면에 들어갈 수 있고,
편집 화면을 막아도 API로 저장할 수 있다. 그래서 **세 지점에 같은 판정을 건다.**

```
app.record.detail.show   → 수정 버튼을 감춘다        (보이지 않게)
app.record.edit.show     → 편집 화면 진입을 막는다    (들어오지 못하게)
app.record.edit.submit   → 저장을 거부한다            (저장되지 못하게)
```

판정 기준은 세 가지다.

| 조건 | 판정 |
|---|---|
| `Status`가 완료 계열(`Approved`/`Completed`/`Canceled`/`Rejected`) | 누구도 수정 불가 |
| 로그인 사용자 = `Created_by` (기안자) | 수정 불가 |
| 로그인 사용자 ∈ `Assignee` (현재 결재 담당자) | **수정 가능** |
| 그 외 제3자 | 수정 불가 |

## 구현에서 신경 쓴 것

**기본은 잠금, 예외가 해제다.**

```js
lockAll(record);                       // 일단 전 필드 disabled
if (assignees.includes(user)) {
  unlockAll(record);                   // 현재 담당자만 푼다
  showBanner("현재 승인 단계입니다. 검토 후 저장해주세요.", "warning");
  return event;
}
```

필드를 하나씩 지정해 잠그면 **나중에 앱에 필드가 추가됐을 때 그 필드가 열린 채로 남는다.**
전부 잠그고 예외를 여는 방향이라야 새 필드가 기본적으로 안전한 쪽에 놓인다.

**`Created_by`는 형태가 두 가지다.**

```js
if (Array.isArray(createdBy.value)) {
  return createdBy.value.length > 0 ? createdBy.value[0].code : null;
}
return createdBy.value.code || null;
```

앱 설정에 따라 배열로도 단일 객체로도 온다. 한쪽만 가정하면 조용히 `null`이 되어
**기안자 판정이 통째로 빠진다** — 오류가 나지 않아서 더 위험하다.

**차단은 이유를 말하고 되돌린다.**

`return false`만 하면 사용자는 빈 화면에서 왜 막혔는지 모른다.
모달로 사유를 띄우고 확인을 누르면 상세 화면으로 돌려보낸다.

```js
showBannerAndRedirect("기안자는 수정이 불가능합니다.", "error", url);
return false;
```

헤더 배너를 붙일 자리는 Kintone 버전에 따라 API가 다르므로 두 경로를 모두 시도한다.

```js
try { el = kintone.app.record.getHeaderMenuSpaceElement(); } catch (e) {}
if (!el) { try { el = kintone.app.getHeaderMenuSpaceElement(); } catch (e) {} }
if (!el) return;
```

## 남은 한계

**Kintone 관리자는 어떤 설정으로도 조회를 막을 수 없다.** 플랫폼 제약이다.
회계 담당자 전용 카테고리를 만들어 달라는 요구가 있었지만,
관리자에게 안 보이게 하는 것은 불가능하다고 회신했다.
접근 통제가 필요하면 앱을 분리하고 관리자 자체를 나누는 수밖에 없다.
