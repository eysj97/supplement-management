(function () {
    "use strict";

    // 이 스크립트는 초록색 영역(주간 캘린더 + 영양소 캡슐 그래프)과
    // "오늘의 영양제" 빈 상태 마스코트 애니메이션을 담당합니다.
    // 나머지 화면은 여전히 정적 HTML/CSS입니다.

    // 모바일 브라우저는 100dvh를 지원 안 하거나(구형 브라우저) 값이 살짝 어긋나는
    // 경우가 있어서, 실제 보이는 높이를 JS로 직접 재서 --vh100 변수에 저장해둠.
    // 카카오톡 등 인앱 브라우저는 자기 UI(주소창/하단 바)가 자리잡는 타이밍이
    // 늦어서 처음 잰 값이 최종 값과 다를 수 있어, visualViewport를 우선 쓰고
    // 로드 직후 한동안은 반복해서 다시 재는 방식으로 보정함
    // navigator.standalone은 iOS Safari에만 있는 값이라 iOS standalone만 정확히
    // 구분해낼 수 있음. 아래 screen.height 보정(iOS 전용 버그 대응)은 반드시 iOS에서만
    // 걸리게 함 — 안드로이드(예: 갤럭시 폴드)는 반대로 screen.height가 실제 보이는
    // 영역보다 더 크게 나와서(시스템 UI 포함) 이 보정을 그대로 적용하면 헤더가 아래로
    // 밀리고 네비가 잘리는 정반대 버그가 생겼었음
    const isIosStandalone = () => window.navigator.standalone === true;

    function getRealViewportHeight() {
        // 실기기 디버그로 확인된 사실: iOS 홈 화면 아이콘(standalone) 모드는 기기에
        // 따라 innerHeight/visualViewport/100dvh가 전부 실제 화면보다 작게(하단 홈
        // 인디케이터 영역만큼) 보고되고, 이건 타이밍 문제가 아니라 그 값 자체가 그렇게
        // 나오는 것이라 dvh를 믿어도 소용없음. screen.height는 이런 뷰포트 계산과
        // 무관하게 기기의 실제 화면 크기를 알려주므로 iOS standalone에서는 이 값을 씀
        if (isIosStandalone() && typeof screen === "object" && screen && screen.height > 0 && screen.width > 0) {
            return Math.max(screen.width, screen.height);
        }
        // 일반 브라우저 탭/인앱 브라우저는 여러 방법으로 잰 값 중 가장 작은 값을 씀 -
        // 실제보다 크게 재면(일부 인앱 브라우저/웹뷰에서 발생) 세로 기준으로 확대되면서
        // 하단 네비 아래에 빈 공간이 남는 문제가 생기는데, 작은 값을 쓰면 그 반대(약간
        // 덜 채움)라 배경색으로 자연스럽게 가릴 수 있는 안전한 쪽으로 치우침
        const candidates = [
            window.visualViewport && window.visualViewport.height,
            window.innerHeight,
            document.documentElement && document.documentElement.clientHeight,
        ].filter((v) => typeof v === "number" && v > 0);
        return candidates.length ? Math.min(...candidates) : 800;
    }

    // 100dvh를 지원하는 브라우저는 실제 화면 높이를 정확히 계산해주므로 그대로 믿는 게
    // 더 정확함. 예외는 iOS standalone뿐이라(위 버그), 그 경우에만 JS로 직접 재서 덮어씀.
    // 안드로이드 standalone(갤럭시 폴드 등)은 dvh를 그대로 믿는 일반 경로를 탐.
    const supportsDvh = window.CSS && CSS.supports && CSS.supports("height", "100dvh");

    function updateViewportHeightVar() {
        if (supportsDvh && !isIosStandalone()) return;
        document.documentElement.style.setProperty("--vh100", getRealViewportHeight() + "px");
    }
    updateViewportHeightVar();
    window.addEventListener("resize", updateViewportHeightVar);
    window.addEventListener("orientationchange", updateViewportHeightVar);
    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", updateViewportHeightVar);
        window.visualViewport.addEventListener("scroll", updateViewportHeightVar);
    }

    // 화면 비율이 안 맞아 .top 양옆에 여백이 생길 때, 그 여백을 실제 헤더(초록)/
    // 본문(흰색) 높이에 맞춰 구간별로 칠해서 이어지는 배경처럼 보이게 함. 하단 네비는
    // 이제 화면 가장자리에 붙지 않고 떠 있는 카드라 별도 배경 구간이 필요 없음.
    // 탭마다 헤더 높이가 달라서(건강상태 탭은 달력이 없어 더 짧음) 탭 전환 때도 다시 계산함.
    // 마우스 쓰는 데스크톱(카드 미리보기 모드)에서는 이 구간별 배경 대신 CSS에 정의된
    // 고정 회색을 그대로 써야 해서, 거기서는 인라인 스타일을 아예 건드리지 않고 비워둠
    // (var()를 그라데이션 위치 값으로 쓰면 일부 브라우저에서 아예 안 그려지는 문제가 있어
    // CSS 변수 대신 계산된 그라데이션 문자열을 직접 넣는 방식으로 되돌림)
    const isDesktopCardMode = () => window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    function updateScreenBackdrop() {
        const backdrop = document.getElementById("screen-backdrop");
        const header = document.querySelector(".header");
        if (!backdrop || !header) return;

        if (isDesktopCardMode()) {
            backdrop.style.background = "";
            return;
        }

        // 홈 탭은 헤더 아래로 초록색 캡슐 그래프(.boxGrap)가 이어지므로, 그 부분까지
        // 초록 구간에 포함시킴(다른 탭은 헤더에서 바로 흰 배경이라 header만 보면 됨)
        let greenBottom = header.getBoundingClientRect().bottom;
        const boxGrap = document.querySelector(".panel-home .boxGrap");
        if (boxGrap && boxGrap.offsetParent !== null) {
            greenBottom = Math.max(greenBottom, boxGrap.getBoundingClientRect().bottom);
        }

        const vh = getRealViewportHeight();
        if (vh <= 0) return;

        const headerPct = Math.max(0, Math.min(100, (greenBottom / vh) * 100));

        backdrop.style.background = `linear-gradient(to bottom, var(--primary) 0 ${headerPct}%, var(--bg) ${headerPct}% 100%)`;
    }

    function refreshViewportSizing() {
        updateViewportHeightVar();
        updateScreenBackdrop();
    }
    window.addEventListener("load", refreshViewportSizing);
    window.addEventListener("resize", refreshViewportSizing);
    window.addEventListener("orientationchange", refreshViewportSizing);
    document.querySelectorAll(".menu-radio").forEach((radio) => radio.addEventListener("change", updateScreenBackdrop));

    // 카카오톡/네이버 등 인앱 브라우저는 자체 UI가 자리잡는 데 시간이 걸려서
    // 로드 직후 크기가 계속 바뀌는 경우가 많아, 처음 2초 동안은 자주 다시 재봄
    let sizingRetries = 0;
    const sizingRetryTimer = setInterval(() => {
        refreshViewportSizing();
        sizingRetries += 1;
        if (sizingRetries >= 10) clearInterval(sizingRetryTimer);
    }, 200);

    const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

    // 캡슐 그래프의 각 영양소 막대 정보 (클릭 시 뜨는 설명 팝업에 사용)
    const NUTRIENT_SOURCES = [
        {
            key: "vitaminD",
            label: "비타민D",
            info: "칼슘 흡수를 도와 뼈와 치아 건강을 지키고, 면역 기능<br> 조절에도 관여해요. 햇빛을 받으면 피부에서 합성되기 때문에 실내 활동이 많으면 부족해지기 쉬워요.",
        },
        {
            key: "omega3",
            label: "오메가3",
            info: "혈행 개선과 혈중 중성지방 감소에 도움을 줄 수 있고,<br> 두뇌·눈 건강과도 관련이 깊은 필수 지방산이에요.",
        },
        {
            key: "magnesium",
            label: "마그네슘",
            info: "근육과 신경이 정상적으로 움직이도록 돕고<br> 에너지 대사에 관여해요. 부족하면 쉽게 피로하거나<br> 눈꺼풀이 떨릴 수 있어요.",
        },
        {
            key: "vitaminB12",
            label: "비타민B12",
            info: "적혈구를 만들고 신경 기능을 유지하는 데 필요해요.<br> 채식 위주 식단에서는 부족해지기 쉬운 영양소예요.",
        },
        {
            key: "probiotics",
            label: "프로바이오틱스",
            info: "장내 유익균을 늘려 장 건강과 배변 활동에 도움을 줄 수 있고,<br> 면역 기능 유지에도 관여해요.",
        },
        {
            key: "folatE",
            label: "엽산",
            info: "세포 분열과 혈액 생성에 필요한 비타민B군의 하나로, 특히 임신 중 태아 발달에 중요한 역할을 해요.",
        },
    ];

    // 건강상태 탭 과대/부족 카드에 쓰는 성분별 안내 문구
    const NUTRITION_HINTS = {
        vitaminD: { low: "부족하면 뼈가 약해지고 면역력이 떨어질 수 있어요.", over: "과다 섭취 시 고칼슘혈증 등 부작용이 있을 수 있어요." },
        omega3: { low: "부족하면 혈행 개선 효과를 충분히 기대하기 어려워요.", over: "과다 섭취 시 출혈 위험이 높아질 수 있어요." },
        magnesium: { low: "부족하면 근육 경련이나 피로감이 심해질 수 있어요.", over: "과다 섭취 시 설사나 복통이 있을 수 있어요." },
        vitaminB12: { low: "부족하면 빈혈이나 신경계 이상이 생길 수 있어요.", over: "과다 섭취해도 대부분 배출되지만 드물게 피부 트러블이 있을 수 있어요." },
        probiotics: { low: "부족하면 장내 유익균이 줄어 배변 활동이나 장 건강이 나빠질 수 있어요.", over: "과다 섭취 시 일시적으로 복부 팽만감이나 가스가 생길 수 있어요." },
        folatE: { low: "부족하면 빈혈이나 태아 발달에 영향을 줄 수 있어요.", over: "과다 섭취 시 비타민B12 결핍이 가려지거나 위장장애가 나타날 수 있어요." },
    };

    // ---------- 증상/상태별 추천 영양제 (데모용 샘플 데이터) ----------
    const RECOMMENDATIONS = {
        피로: ["비타민B군", "마그네슘"],
        감기: ["비타민C", "아연"],
        몸살: ["비타민C", "마그네슘"],
        소화불량: ["프로바이오틱스", "소화효소제"],
        음주: ["밀크시슬", "비타민B군"],
        불면: ["마그네슘", "테아닌"],
        "관절 통증": ["오메가3", "글루코사민"],
    };

    // ---------- 같이 복용하면 주의가 필요한 영양소 조합 ----------
    // 오늘 두 성분을 모두 체크(복용)하면 팝업으로 안내함. 의학적 진단이 아니라
    // 일반적으로 알려진 주의사항 안내이며, 항상 전문가 상담을 권함
    const INTERACTION_PAIRS = [
        {
            a: "엽산",
            b: "비타민B12",
            note: "엽산을 고용량으로 먹으면 비타민B12 부족 증상이 가려질 수 있어요. 두 가지를 함께 드신다면 비타민B12도 충분한지 같이 챙겨보는 게 좋아요.",
        },
        {
            a: "비타민A",
            b: "멀티비타민",
            note: "멀티비타민에도 비타민A가 포함된 경우가 많아요. 비타민A 제품과 함께 드시면 하루 섭취량이 필요 이상으로 많아질 수 있으니 각 제품의 함유량을 확인해보세요.",
        },
        {
            a: "마그네슘",
            b: "비타민A",
            note: "이런 조합은 흔치 않지만, 여러 영양제를 한꺼번에 드실 때는 성분이 겹치지 않는지 한 번씩 확인해보는 게 좋아요.",
        },
    ];

    function findInteractionWarning(categoriesA, categoriesB) {
        for (const pair of INTERACTION_PAIRS) {
            const aHas = categoriesA.includes(pair.a) && categoriesB.includes(pair.b);
            const bHas = categoriesA.includes(pair.b) && categoriesB.includes(pair.a);
            if (aHas || bHas) return pair;
        }
        return null;
    }

    function showInteractionWarningModal(nameA, nameB, note) {
        const host = document.querySelector(".top") || document.body;
        const overlay = document.createElement("div");
        overlay.className = "push-permission-overlay";
        overlay.innerHTML = `
            <div class="push-permission-sheet">
                <div class="push-permission-icon">⚠️</div>
                <h3>${escapeHtml(nameA)} + ${escapeHtml(nameB)}</h3>
                <p>${escapeHtml(note)} 정확한 복용 방법은 의사·약사와 상담하세요.</p>
                <div class="push-permission-sheet-actions">
                    <button type="button" data-action="push-allow">확인했어요</button>
                </div>
            </div>
        `;
        host.appendChild(overlay);
        overlay.querySelector("[data-action='push-allow']").addEventListener("click", () => overlay.remove());
    }

    // ---------- 주간 캘린더: 가로 스크롤로 날짜 이동, 가운데 온 날짜가 자동 선택됨 ----------
    const CALENDAR_RANGE = 14; // 오늘 기준 앞뒤로 렌더링할 일수

    function findCenteredDay(weekEl) {
        const containerRect = weekEl.getBoundingClientRect();
        const containerCenter = containerRect.left + containerRect.width / 2;
        let closest = null;
        let closestDist = Infinity;
        weekEl.querySelectorAll(".calendar-day").forEach((day) => {
            const r = day.getBoundingClientRect();
            const center = r.left + r.width / 2;
            const dist = Math.abs(center - containerCenter);
            if (dist < closestDist) {
                closestDist = dist;
                closest = day;
            }
        });
        return closest;
    }

    function updateCalendarSelection(centerOffset) {
        const weekEl = document.querySelector(".calendar-week");
        const captionEl = document.querySelector(".calendar-date-caption");
        if (!weekEl || !captionEl) return;

        weekEl.querySelectorAll(".calendar-day").forEach((day) => {
            const offset = Number(day.dataset.offset);
            const dist = Math.abs(offset - centerOffset);
            day.classList.remove("selected");
            if (dist === 0) {
                day.classList.add("selected");
                day.style.opacity = "";
                day.style.filter = "";
            } else {
                // 오늘 기준 "이번 주"(앞3일~뒤3일)의 가장자리(dist 3)가 가장 흐리고,
                // 그 지점을 기준으로 더 멀어질수록(=다음/이전 주로 넘어갈수록) 다시 선명해짐
                const fold = dist <= 3 ? dist : Math.max(0, 6 - dist);
                const opacity = Math.max(0.35, 0.95 - fold * 0.18);
                const blur = fold >= 3 ? 1.5 : 0;
                day.style.opacity = String(opacity);
                day.style.filter = blur > 0 ? `blur(${blur}px)` : "";
            }
        });

        const centerDate = new Date();
        centerDate.setDate(centerDate.getDate() + centerOffset);
        captionEl.textContent = `${centerDate.getMonth() + 1}월 ${centerDate.getDate()}일 (${DAY_LABELS[centerDate.getDay()]})`;
    }

    function renderCalendar() {
        const weekEl = document.querySelector(".calendar-week");
        if (!weekEl) return;

        const today = new Date();
        weekEl.innerHTML = "";

        for (let offset = -CALENDAR_RANGE; offset <= CALENDAR_RANGE; offset++) {
            const d = new Date(today);
            d.setDate(d.getDate() + offset);

            const span = document.createElement("span");
            span.className = "calendar-day";
            span.dataset.offset = String(offset);
            span.textContent = offset === 0 ? "오늘" : DAY_LABELS[d.getDay()];
            weekEl.appendChild(span);
        }

        updateCalendarSelection(0);

        // 오늘 칸이 화면 가운데 오도록 초기 스크롤 위치를 맞춤
        requestAnimationFrame(() => {
            const todayEl = weekEl.querySelector('[data-offset="0"]');
            if (todayEl) {
                weekEl.scrollLeft = todayEl.offsetLeft - weekEl.clientWidth / 2 + todayEl.clientWidth / 2;
            }
        });

        // 스크롤 중 가운데로 온 날짜를 실시간으로 선택/캡션 갱신
        let scrollTicking = false;
        const syncCenteredDay = () => {
            const centered = findCenteredDay(weekEl);
            if (centered) updateCalendarSelection(Number(centered.dataset.offset));
        };
        weekEl.addEventListener("scroll", () => {
            if (scrollTicking) return;
            scrollTicking = true;
            requestAnimationFrame(() => {
                scrollTicking = false;
                syncCenteredDay();
            });
        });
        // 관성 스크롤 + scroll-snap 조합에서는 마지막 scroll 이벤트가 스냅이 완전히
        // 자리잡기 전에 멈출 수 있어서, 스크롤이 진짜로 끝난 시점에 한 번 더 보정함
        weekEl.addEventListener("scrollend", syncCenteredDay);

        // 터치/트랙패드 없이 마우스로만 쓰는 환경에서도 좌우로 끌어서 스크롤 가능하게
        let isDragging = false;
        let dragStartX = 0;
        let dragStartScrollLeft = 0;
        weekEl.addEventListener("mousedown", (e) => {
            isDragging = true;
            weekEl.classList.add("dragging");
            dragStartX = e.pageX;
            dragStartScrollLeft = weekEl.scrollLeft;
        });
        window.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            e.preventDefault();
            weekEl.scrollLeft = dragStartScrollLeft - (e.pageX - dragStartX);
        });
        window.addEventListener("mouseup", () => {
            isDragging = false;
            weekEl.classList.remove("dragging");
        });

        // 세로 마우스 휠도 좌우 스크롤로 변환
        weekEl.addEventListener(
            "wheel",
            (e) => {
                if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
                e.preventDefault();
                weekEl.scrollLeft += e.deltaY;
            },
            { passive: false }
        );
    }

    // ---------- 영양소 캡슐 클릭 시 해당 영양소 역할 설명 팝업 ----------
    function showNutrientInfo(source) {
        const host = document.querySelector(".top") || document.body;
        const existing = host.querySelector(".nutrient-info-overlay");
        if (existing) existing.remove();

        const overlay = document.createElement("div");
        overlay.className = "nutrient-info-overlay";
        overlay.innerHTML =
            '<div class="nutrient-info-sheet">' +
            "<h3>" + source.label + "</h3>" +
            "<p>" + source.info + "</p>" +
            '<button type="button" data-close>확인</button>' +
            "</div>";
        host.appendChild(overlay);

        overlay.addEventListener("click", (e) => {
            if (e.target === overlay || e.target.closest("[data-close]")) overlay.remove();
        });
    }

    function handleBoxGrapClick(e) {
        const line = e.target.closest(".lineBasic");
        if (!line) return;
        const fillEl = line.querySelector(".nutrient-fill");
        if (!fillEl) return;
        const source = NUTRIENT_SOURCES.find((nu) => fillEl.classList.contains(nu.key));
        if (source) showNutrientInfo(source);
    }

    // ---------- 홈 마스코트: 오늘 복용 체크한 영양제 개수에 따라 다른 이미지 세트에서 랜덤으로 표시 ----------
    // 하나도 안 먹었을 때 7~9 / 1개 먹었을 때 4~6 / 2개 이상 먹었을 때 1~3
    // (홈에 들어갈 때마다 같은 세트 안에서 무작위로 고르고, 체크 상태가 바뀌어 세트가 달라질 때만 다시 고름)
    const MASCOT_IMAGES_BY_TAKEN = [
        ["images/logo-waiting7.png", "images/logo-waiting8.png", "images/logo-waiting9.png"],
        ["images/logo-waiting4.png", "images/logo-waiting5.png", "images/logo-waiting6.png"],
        ["images/logo-waiting1.png", "images/logo-waiting2.png", "images/logo-waiting3.png"],
    ];

    // 정해진 시각 알림(푸시)에 쓰는 시간대별 3장 세트 (7-13시 / 13-17시 / 17-7시)
    const WAITING_IMAGE_GROUPS = [
        { start: 7, end: 13, files: ["images/logo-waiting1.png", "images/logo-waiting2.png", "images/logo-waiting3.png"] },
        { start: 13, end: 17, files: ["images/logo-waiting4.png", "images/logo-waiting5.png", "images/logo-waiting6.png"] },
        { start: 17, end: 7, files: ["images/logo-waiting7.png", "images/logo-waiting8.png", "images/logo-waiting9.png"] },
    ];

    function pickMascot(force) {
        const img = document.getElementById("waiting-mascot");
        if (!img) return;
        const taken = document.querySelectorAll(".today-item .today-check.checked").length;
        const files = MASCOT_IMAGES_BY_TAKEN[Math.min(taken, MASCOT_IMAGES_BY_TAKEN.length - 1)];
        if (!force && files.includes(img.getAttribute("src"))) return;
        img.src = files[Math.floor(Math.random() * files.length)];
    }

    function showRandomWaitingMascot() {
        pickMascot(true);
    }

    function updateWaitingMascot() {
        pickMascot(false);
    }

    // ---------- 정해진 시각에 "영양제를 복용하세요" 알림 ----------
    // 브라우저 알림(Notification) 기능을 사용하며, 이 탭이 열려 있을 때만 동작함.
    // OS 설정에 따라 잠금화면에도 표시될 수 있지만, 탭이 닫혀 있으면 절대 뜨지 않음.
    const REMINDER_TIMES = [
        { hour: 7, minute: 30, groupIndex: 0, files: WAITING_IMAGE_GROUPS[0].files },
        { hour: 13, minute: 0, groupIndex: 1, files: WAITING_IMAGE_GROUPS[1].files },
        { hour: 20, minute: 0, groupIndex: 2, files: WAITING_IMAGE_GROUPS[2].files },
    ];
    const REMINDER_FIRED_KEY_PREFIX = "pt_reminder_fired_";

    function localDateKey(d) {
        return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
    }

    function fireReminderNotification(files) {
        if (!("Notification" in window)) return;
        const image = files[Math.floor(Math.random() * files.length)];

        const show = () => {
            new Notification("영양제를 복용하세요", {
                body: "지금 복용할 시간이에요.",
                icon: image,
                image: image,
            });
        };

        if (Notification.permission === "granted") {
            show();
        } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((permission) => {
                if (permission === "granted") show();
            });
        }
    }

    function checkReminders() {
        const now = new Date();
        const dateKey = localDateKey(now);

        REMINDER_TIMES.forEach((reminder, index) => {
            if (now.getHours() !== reminder.hour || now.getMinutes() !== reminder.minute) return;

            const firedKey = REMINDER_FIRED_KEY_PREFIX + index + "_" + dateKey;
            if (localStorage.getItem(firedKey)) return;
            localStorage.setItem(firedKey, "1");

            fireReminderNotification(reminder.files);
        });
    }

    // ---------- 서버 푸시 알림: 앱이 완전히 꺼져 있어도, 잠금화면이나 다른 앱을 쓰는 중에도
    // 정해진 시각(7시 30분/13시/20시)에 팝업이 뜨게 함. /api/subscribe + /api/schedule-general-reminders
    // (QStash 예약) + /api/send-push가 필요하며, 서버 쪽 환경변수가 아직 없으면 조용히 실패함 ----------
    const VAPID_PUBLIC_KEY = "BAgdgYIaumwswYV92cBWCkR4hM7zTYvLbojqCdD0l96fEddgDbzHvtHstW5ZW4KezW3zpx-ToAvAYs5N723xRkU";
    const PUSH_USER_ID_KEY = "geongangja_push_user_id";
    const PUSH_SCHEDULED_KEY = "geongangja_general_push_scheduled_v2";

    function getOrCreatePushUserId() {
        let id = localStorage.getItem(PUSH_USER_ID_KEY);
        if (!id) {
            id = "u_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
            localStorage.setItem(PUSH_USER_ID_KEY, id);
        }
        return id;
    }

    function urlBase64ToUint8Array(base64String) {
        const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
        const rawData = atob(base64);
        return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
    }

    // 잠금화면 알림까지 받으려면 서버에 구독 등록 + 예약이 모두 성공해야 하므로,
    // 실패해도 조용히 넘어가고(탭이 열려있을 때 뜨는 로컬 알림은 이미 별도로 동작함) 콘솔에만 남김
    async function setupGeneralServerPushReminders() {
        try {
            if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
            const registration = await navigator.serviceWorker.ready;

            const serverKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
            let subscription = await registration.pushManager.getSubscription();
            // 예전에 다른 서버 키로 만든 구독이 남아 있으면 지금 서버 키로는 알림이 거부되므로 지우고 새로 만듦
            if (subscription && subscription.options && subscription.options.applicationServerKey) {
                const saved = new Uint8Array(subscription.options.applicationServerKey);
                const same = saved.length === serverKey.length && saved.every((b, i) => b === serverKey[i]);
                if (!same) {
                    await subscription.unsubscribe();
                    subscription = null;
                }
            }
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: serverKey,
                });
            }

            const userId = getOrCreatePushUserId();

            await fetch("/api/subscribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, subscription }),
            }).then((r) => {
                if (!r.ok) throw new Error("subscribe failed");
            });

            await fetch("/api/schedule-general-reminders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userId,
                    times: REMINDER_TIMES.map((r) => ({ hour: r.hour, minute: r.minute, groupIndex: r.groupIndex })),
                }),
            }).then((r) => {
                if (!r.ok) throw new Error("schedule failed");
            });

            localStorage.setItem(PUSH_SCHEDULED_KEY, "1");
            return true;
        } catch (err) {
            console.warn("잠금화면 알림 설정에 실패했어요(서버 설정이 아직 안 됐을 수 있어요):", err);
            return false;
        }
    }

    // 처음 접속했을 때 딱 한 번만 팝업으로 알림 허용 여부를 물어봄(배너로 계속 떠있지 않게)
    const PUSH_ASKED_KEY = "geongangja_push_asked_v1";

    function maybeShowPushPermissionModal() {
        if (localStorage.getItem(PUSH_ASKED_KEY)) return;
        if (!("Notification" in window) || Notification.permission !== "default") return;

        const host = document.querySelector(".top") || document.body;
        const overlay = document.createElement("div");
        overlay.className = "push-permission-overlay";
        overlay.innerHTML = `
            <div class="push-permission-sheet">
                <div class="push-permission-icon">🔔</div>
                <h3>복용 알림을 받아보시겠어요?</h3>
                <p>앱을 켜두지 않아도, 잠금화면에서 정해진 시간에 영양제 복용 알림을 받을 수 있어요.</p>
                <div class="push-permission-sheet-actions">
                    <button type="button" data-action="push-allow">알림 받기</button>
                    <button type="button" data-action="push-dismiss">다음에 할게요</button>
                </div>
            </div>
        `;
        host.appendChild(overlay);

        const close = () => overlay.remove();

        overlay.querySelector('[data-action="push-allow"]').addEventListener("click", () => {
            Notification.requestPermission().then((permission) => {
                localStorage.setItem(PUSH_ASKED_KEY, "1");
                close();
                if (permission === "granted") setupGeneralServerPushReminders();
            });
        });
        overlay.querySelector('[data-action="push-dismiss"]').addEventListener("click", () => {
            localStorage.setItem(PUSH_ASKED_KEY, "1");
            close();
        });
    }

    // ---------- 첫 실행 가이드 투어: 실제 앱 화면을 하나씩 짚어가며 말풍선으로 설명 ----------
    // 처음 접속했을 때 한 번만 자동으로 시작되고, 이후에는 건강상태 탭의 "앱 사용 방법 다시 보기"로
    // 다시 볼 수 있음. 알림 허용 팝업과 겹치지 않도록, 자동으로 시작된 경우엔 투어가 끝난 뒤에
    // 그 팝업을 이어서 띄움
    const ONBOARDING_DONE_KEY = "geongangja_tour_done_v1";

    // target이 없으면 화면 전체를 어둡게 하고 가운데에 말풍선만 보여줌(인사 단계).
    // target이 여러 개면(배열) 그 요소들을 모두 감싸는 하나의 영역을 강조함.
    // tab: 이 단계에서 보여줄 탭 / fab: 가운데 + 버튼 메뉴를 펼친 채로 보여줄지 여부
    const TOUR_STEPS = [
        {
            tab: "home",
            mascot: "images/logo-waiting1.png",
            title: "건강자 사용법을 알려드릴게요",
            desc: "실제 화면을 하나씩 짚어가며 설명해 드려요.<br>금방 끝나요!",
        },
        {
            tab: "home",
            target: ".panel-home .boxGrap",
            title: "오늘 챙긴 영양소",
            desc: "먹은 영양제의 영양소가 권장량의 몇 %인지 막대로 보여줘요.<br>막대를 누르면 영양소 설명도 볼 수 있어요.",
        },
        {
            tab: "home",
            target: ".today",
            title: "오늘의 영양제",
            desc: "오늘 먹을 영양제가 여기에 모여요. 먹고 나면 <b>✓</b>를 눌러 기록하세요.<br>추가한 항목은 꾹 눌러서 뺄 수 있어요.",
        },
        {
            tab: "home",
            target: ".tryBox",
            title: "추천 받기",
            desc: "지금 상태(피로, 감기, 불면 등)를 누르면 도움이 될 영양소가 든 <b>내 영양제</b>를 찾아줘요.<br>+ 버튼으로 오늘의 영양제에 바로 담을 수 있어요.",
        },
        {
            tab: "home",
            fab: true,
            target: ["#nav-fab-btn", "#nav-fab-scan", "#nav-fab-search"],
            round: true,
            title: "＋ 버튼으로 추가하기",
            desc: "누르면 두 가지가 펼쳐져요.<br><b>스캔</b> — 제품·성분표 사진을 찍어 영양제 등록<br><b>돋보기</b> — 등록한 영양제 중 오늘 먹을 것 추가",
        },
        {
            tab: "medicines",
            target: ".panel-medicines .medicine-tile",
            title: "내 영양제",
            desc: "등록한 영양제가 여기에 모여요.<br>누르면 성분 함량, 복용 방법, 재고를 볼 수 있어요.",
        },
        {
            tab: "nutrition",
            target: ".panel-nutrition .card",
            title: "주간 영양 현황",
            desc: "복용 체크한 기록을 바탕으로<br>이번 주에 챙긴 영양소를 캡슐 그래프로 보여줘요.",
        },
        {
            tab: "nutrition",
            target: [".nutri-rate-title", "#nutri-ring-grid"],
            title: "한 달 영양소 복용 비율",
            desc: "영양소별로 이번 달 필요량 중 얼마나 채웠는지 링으로 보여줘요. 위의 %는 전체 평균이에요.<br>100%를 넘으면 <b>과대섭취</b>, 50%보다 낮으면 <b>섭취부족</b>으로 아래에 따로 알려드려요.",
        },
        {
            tab: "nutrition",
            target: [".push-toggle-row > span", "#push-toggle"],
            title: "복용 알림",
            desc: "켜 두면 앱을 닫아도<br>잠금화면으로 복용 알림을 보내드려요.",
        },
        {
            tab: "nutrition",
            target: [".sync-row-title", ".sync-row-actions"],
            title: "다른 기기와 동기화",
            desc: "기기를 바꾸거나 다른 기기에서도 쓰고 싶을 때 사용해요.<br>① 원래 쓰던 기기에서 <b>코드 만들기</b> → 6자리 코드 발급 (10분간 유효)<br>② 새 기기에서 <b>코드 입력하기</b> → 코드 입력<br>사진은 옮겨지지 않고, 새 기기의 영양제 목록·오늘 기록은 가져온 데이터로 바뀌어요.",
        },
        {
            tab: "shop",
            target: ".store-header",
            title: "스토어",
            desc: "다이소몰에서 판매 중인 영양제를 둘러볼 수 있어요.<br>상품을 누르면 다이소몰로 연결돼요.<br>다이소와 무관한 비공식 서비스예요.",
        },
    ];

    const TOUR_TABS = ["home", "medicines", "nutrition", "shop"];

    function tourSwitchTab(name) {
        const radio = document.getElementById("menu-" + name);
        if (radio && !radio.checked) {
            radio.checked = true;
            radio.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    function openOnboarding(onClose) {
        const host = document.querySelector(".top") || document.body;
        const existing = host.querySelector(".tour-overlay");
        if (existing) existing.remove();

        const fabWrap = document.getElementById("nav-fab-wrap");
        const viewEl = document.querySelector(".view");
        const homeScrollEl = document.querySelector(".home-scroll");
        const startTab = TOUR_TABS.find((t) => {
            const r = document.getElementById("menu-" + t);
            return r && r.checked;
        }) || "home";
        const savedScroll = { view: viewEl ? viewEl.scrollTop : 0, home: homeScrollEl ? homeScrollEl.scrollTop : 0 };

        const overlay = document.createElement("div");
        overlay.className = "tour-overlay tour-instant";
        overlay.setAttribute("role", "dialog");
        overlay.setAttribute("aria-modal", "true");
        overlay.setAttribute("aria-label", "앱 사용 방법");
        overlay.innerHTML = `
            <div class="tour-spot"></div>
            <div class="tour-bubble">
                <span class="tour-arrow"></span>
                <img class="tour-mascot" alt="" hidden>
                <h3 class="tour-title"></h3>
                <p class="tour-desc"></p>
                <div class="tour-footer">
                    <button type="button" class="tour-skip">건너뛰기</button>
                    <span class="tour-count"></span>
                    <button type="button" class="tour-next">다음</button>
                </div>
            </div>
        `;
        host.appendChild(overlay);

        const spot = overlay.querySelector(".tour-spot");
        const bubble = overlay.querySelector(".tour-bubble");
        const arrow = overlay.querySelector(".tour-arrow");
        const mascotEl = overlay.querySelector(".tour-mascot");
        const titleEl = overlay.querySelector(".tour-title");
        const descEl = overlay.querySelector(".tour-desc");
        const countEl = overlay.querySelector(".tour-count");
        const skipBtn = overlay.querySelector(".tour-skip");
        const nextBtn = overlay.querySelector(".tour-next");

        const lastIndex = TOUR_STEPS.length - 1;
        const MARGIN = 16;
        let index = 0;
        let token = 0; // 단계가 빠르게 바뀔 때 늦게 끝난 이전 단계의 배치가 덮어쓰지 않게 함
        let closed = false;

        // .top은 화면에 맞춰 transform: scale로 축소/확대돼 있어서, getBoundingClientRect() 값은
        // 화면(축소된) 좌표이고 overlay의 left/top은 축소 전 좌표임. 그 비율로 환산해줌
        function toLocalRect(rect) {
            const hostRect = host.getBoundingClientRect();
            const scale = hostRect.width / host.offsetWidth || 1;
            return {
                left: (rect.left - hostRect.left) / scale,
                top: (rect.top - hostRect.top) / scale,
                width: rect.width / scale,
                height: rect.height / scale,
                scale,
            };
        }

        // 대상이 스크롤 영역(홈 하단 목록 / 각 탭 본문) 안에서 가려져 있으면 그 스크롤만 움직여 보이게 함.
        // scrollIntoView는 overflow:hidden인 .top까지 밀어버릴 수 있어서 쓰지 않음
        function ensureVisible(el) {
            const container = el.closest(".home-scroll, .view");
            if (!container) return;
            const scale = host.getBoundingClientRect().width / host.offsetWidth || 1;
            const c = container.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            // 하단 60~100px은 떠 있는 네비가 가리는 영역이라 그만큼은 보이는 영역에서 뺌
            const navSafe = 100 * scale;
            const topEdge = c.top + 8 * scale;
            const bottomEdge = c.bottom - navSafe;
            if (r.top >= topEdge && r.bottom <= bottomEdge) return;
            container.scrollTop += (r.top - (c.top + 24 * scale)) / scale;
        }

        function unionRect(els) {
            let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
            els.forEach((el) => {
                const r = el.getBoundingClientRect();
                left = Math.min(left, r.left);
                top = Math.min(top, r.top);
                right = Math.max(right, r.right);
                bottom = Math.max(bottom, r.bottom);
            });
            return { left, top, width: right - left, height: bottom - top };
        }

        function layout(step, els) {
            const W = host.offsetWidth;
            const H = host.offsetHeight;

            bubble.style.width = Math.min(300, W - MARGIN * 2) + "px";
            const bw = bubble.offsetWidth;
            const bh = bubble.offsetHeight;

            if (!els) {
                spot.style.left = W / 2 + "px";
                spot.style.top = H / 2 + "px";
                spot.style.width = "0px";
                spot.style.height = "0px";
                bubble.style.left = (W - bw) / 2 + "px";
                bubble.style.top = (H - bh) / 2 + "px";
                arrow.style.display = "none";
                return;
            }

            const PAD = 6;
            const t = toLocalRect(unionRect(els));
            const box = { left: t.left - PAD, top: t.top - PAD, width: t.width + PAD * 2, height: t.height + PAD * 2 };
            spot.style.left = box.left + "px";
            spot.style.top = box.top + "px";
            spot.style.width = box.width + "px";
            spot.style.height = box.height + "px";
            spot.style.borderRadius = step.round ? "32px" : "14px";

            // 대상 아래에 자리가 있으면 아래에, 아니면 위에, 둘 다 좁으면 더 넓은 쪽에 놓음
            const GAP = 14;
            const belowTop = box.top + box.height + GAP;
            const aboveTop = box.top - GAP - bh;
            let placeBelow;
            if (belowTop + bh <= H - MARGIN) placeBelow = true;
            else if (aboveTop >= MARGIN) placeBelow = false;
            else placeBelow = H - (box.top + box.height) >= box.top;
            const top = Math.max(MARGIN, Math.min(placeBelow ? belowTop : aboveTop, H - bh - MARGIN));

            const centerX = box.left + box.width / 2;
            const left = Math.max(MARGIN, Math.min(centerX - bw / 2, W - bw - MARGIN));
            bubble.style.left = left + "px";
            bubble.style.top = top + "px";

            arrow.style.display = "block";
            arrow.style.left = Math.max(22, Math.min(centerX - left, bw - 22)) + "px";
            arrow.classList.toggle("tour-arrow-up", placeBelow); // 말풍선이 아래일 땐 화살표가 위쪽 가장자리에
            arrow.classList.toggle("tour-arrow-down", !placeBelow);
        }

        const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

        async function showStep(i) {
            const myToken = ++token;
            index = i;
            const step = TOUR_STEPS[i];

            nextBtn.disabled = true;
            if (step.tab) tourSwitchTab(step.tab);
            if (fabWrap) fabWrap.classList.toggle("open", !!step.fab);

            let els = null;
            if (step.target) {
                els = [].concat(step.target).map((sel) => document.querySelector(sel)).filter(Boolean);
                // 대상이 없거나 화면에 안 그려져 있으면(예: 데이터가 없는 경우) 그 단계는 건너뜀
                if (!els.length || els.some((el) => el.offsetParent === null && !el.getClientRects().length)) {
                    if (i < lastIndex) return showStep(i + 1);
                    return close();
                }
                if (!step.fab) ensureVisible(els[0]);
            }

            titleEl.textContent = step.title;
            descEl.innerHTML = step.desc;
            mascotEl.hidden = !step.mascot;
            if (step.mascot) mascotEl.src = step.mascot;
            countEl.textContent = `${i + 1} / ${TOUR_STEPS.length}`;
            nextBtn.textContent = i === lastIndex ? "시작하기" : "다음";
            skipBtn.style.visibility = i === lastIndex ? "hidden" : "visible";

            // 탭 전환/+ 메뉴 펼침 애니메이션이 끝나 최종 위치가 잡힌 뒤에 재야 정확함
            await wait(step.fab ? 300 : 80);
            if (closed || myToken !== token) return;

            layout(step, els);
            if (overlay.classList.contains("tour-instant")) {
                void overlay.offsetWidth; // 애니메이션 없이 위치가 먼저 확정되도록 강제로 반영한 뒤 켬
                overlay.classList.remove("tour-instant");
            }
            nextBtn.disabled = false;
        }

        function close() {
            if (closed) return;
            closed = true;
            token += 1;
            window.removeEventListener("resize", onResize);
            localStorage.setItem(ONBOARDING_DONE_KEY, "1");
            if (fabWrap) fabWrap.classList.remove("open");
            overlay.remove();
            tourSwitchTab(startTab);
            if (viewEl) viewEl.scrollTop = savedScroll.view;
            if (homeScrollEl) homeScrollEl.scrollTop = savedScroll.home;
            if (onClose) onClose();
        }

        function onResize() {
            if (!closed) showStep(index);
        }
        window.addEventListener("resize", onResize);

        // 앱에는 "+ 메뉴 바깥을 누르면 접기" 클릭 핸들러가 document에 걸려 있어서, 투어 버튼 클릭이
        // 밖으로 전파되면 방금 펼친 + 메뉴가 곧바로 접혀버림
        overlay.addEventListener("click", (e) => e.stopPropagation());

        skipBtn.addEventListener("click", close);
        nextBtn.addEventListener("click", () => {
            if (index >= lastIndex) close();
            else showStep(index + 1);
        });

        showStep(0);
    }

    function maybeShowOnboarding() {
        // 주소 뒤에 ?tour 를 붙이면(예: index.html?tour) 이미 본 기기에서도 투어를 다시 시작함
        const forced = new URLSearchParams(window.location.search).has("tour");
        if (!forced && localStorage.getItem(ONBOARDING_DONE_KEY)) {
            maybeShowPushPermissionModal();
            return;
        }
        openOnboarding(maybeShowPushPermissionModal);
    }

    function wireOnboardingReplay() {
        const btn = document.getElementById("onboarding-replay-btn");
        if (btn) btn.addEventListener("click", () => openOnboarding());
    }

    // 서버에 예약해둔 QStash 스케줄과 구독 정보를 모두 지워서 알림을 완전히 끔
    async function disableGeneralServerPushReminders() {
        localStorage.removeItem(PUSH_SCHEDULED_KEY);
        try {
            const userId = localStorage.getItem(PUSH_USER_ID_KEY);
            if (!userId) return;
            await fetch("/api/unsubscribe-reminders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId }),
            });
        } catch (err) {
            console.warn("알림 해제 요청에 실패했어요:", err);
        }
    }

    // 건강상태 탭 맨 아래 "잠금화면 복용 알림" 토글
    function wirePushToggle() {
        const toggle = document.getElementById("push-toggle");
        if (!toggle) return;

        const isOn = () =>
            "Notification" in window && Notification.permission === "granted" && !!localStorage.getItem(PUSH_SCHEDULED_KEY);

        toggle.setAttribute("aria-checked", String(isOn()));

        toggle.addEventListener("click", () => {
            if (!("Notification" in window)) {
                alert("이 브라우저는 알림 기능을 지원하지 않아요.");
                return;
            }

            const nowOn = toggle.getAttribute("aria-checked") === "true";
            if (nowOn) {
                toggle.setAttribute("aria-checked", "false");
                disableGeneralServerPushReminders();
                return;
            }

            if (Notification.permission === "denied") {
                alert("알림이 차단되어 있어요. 브라우저 설정에서 이 사이트의 알림 권한을 허용해주세요.");
                return;
            }

            const grantAndEnable = () => {
                localStorage.setItem(PUSH_ASKED_KEY, "1");
                setupGeneralServerPushReminders().then((ok) => {
                    toggle.setAttribute("aria-checked", String(!!ok));
                });
            };

            if (Notification.permission === "granted") {
                grantAndEnable();
            } else {
                Notification.requestPermission().then((permission) => {
                    if (permission === "granted") grantAndEnable();
                    else toggle.setAttribute("aria-checked", "false");
                });
            }
        });
    }

    // ---------- 다른 기기와 데이터 동기화: 사진은 용량이 커서 제외하고,
    // 영양제 목록/오늘의 기록 텍스트 데이터만 서버(Upstash Redis)를 거쳐 옮김.
    // 6자리 코드로 10분 동안만 주고받을 수 있음 ----------
    function readLocalJson(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function wireSyncButtons() {
        const pushBtn = document.getElementById("sync-push-btn");
        const pullBtn = document.getElementById("sync-pull-btn");
        if (!pushBtn || !pullBtn) return;

        pushBtn.addEventListener("click", async () => {
            pushBtn.disabled = true;
            pushBtn.textContent = "만드는 중...";
            try {
                const userId = getOrCreatePushUserId();
                const medicines = readLocalJson(MEDICINES_STORAGE_KEY);
                const today = readLocalJson(TODAY_STORAGE_KEY);

                const res = await fetch("/api/sync-push", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId, medicines, today }),
                });
                const data = await res.json();
                if (!res.ok || !data.code) throw new Error(data.error || "코드 발급에 실패했어요.");

                alert(`동기화 코드: ${data.code}\n\n다른 기기의 건강상태 탭에서 "코드 입력하기"를 누르고 이 번호를 입력해주세요. 10분 동안만 유효해요.`);
            } catch (err) {
                alert("코드 발급에 실패했어요: " + (err.message || err));
            } finally {
                pushBtn.disabled = false;
                pushBtn.textContent = "코드 만들기";
            }
        });

        pullBtn.addEventListener("click", async () => {
            const code = window.prompt("다른 기기에서 받은 6자리 동기화 코드를 입력해주세요.");
            if (!code) return;

            if (!confirm("지금 이 기기에 저장된 영양제 목록과 오늘의 기록이 가져온 데이터로 바뀌어요. 계속할까요?")) return;

            pullBtn.disabled = true;
            pullBtn.textContent = "가져오는 중...";
            try {
                const res = await fetch("/api/sync-pull", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code: code.trim() }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "코드를 확인할 수 없어요.");

                localStorage.setItem(MEDICINES_STORAGE_KEY, JSON.stringify(data.medicines || []));
                localStorage.setItem(TODAY_STORAGE_KEY, JSON.stringify(data.today || []));
                localStorage.setItem(PUSH_USER_ID_KEY, data.userId);

                alert("동기화가 완료됐어요. 화면을 새로 불러올게요.");
                window.location.reload();
            } catch (err) {
                alert("동기화에 실패했어요: " + (err.message || err));
            } finally {
                pullBtn.disabled = false;
                pullBtn.textContent = "코드 입력하기";
            }
        });
    }

    // ---------- 영양제 등록: 사진 촬영(제품 전체 / 성분표) → 상세정보 입력 ----------
    function escapeHtml(str) {
        return String(str || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    }

    let capturedPhotos = { product: null, label: null }; // { file, url }
    let draftQty = 30;

    function closeCaptureOverlay() {
        const el = document.getElementById("capture-overlay");
        if (el) el.remove();
    }

    function closeDetailOverlay() {
        const el = document.getElementById("detail-overlay");
        if (el) el.remove();
    }

    function resetCapturedPhotos() {
        Object.values(capturedPhotos).forEach((p) => p && URL.revokeObjectURL(p.url));
        capturedPhotos = { product: null, label: null };
    }

    function openCaptureOverlay() {
        closeCaptureOverlay();
        closeDetailOverlay();
        const host = document.querySelector(".top") || document.body;

        const overlay = document.createElement("div");
        overlay.className = "capture-overlay";
        overlay.id = "capture-overlay";
        overlay.innerHTML = `
            <div class="capture-sheet">
                <div class="capture-header">
                    <span>영양제 등록</span>
                    <button type="button" class="capture-close" data-close>✕</button>
                </div>
                <p class="capture-hint">영양제 사진을 촬영해 주세요</p>
                <div class="capture-slot-row">
                    ${["product", "label"]
                        .map(
                            (key) => `
                    <label class="capture-slot${capturedPhotos[key] ? " filled" : ""}" data-slot="${key}">
                        <input type="file" accept="image/*" capture="environment" hidden>
                        <div class="capture-slot-inner">
                            ${
                                capturedPhotos[key]
                                    ? `<img src="${capturedPhotos[key].url}" alt=""><span class="capture-retake">다시 촬영</span>`
                                    : `<span class="capture-icon">📷</span><span class="capture-label">${key === "product" ? "제품 전체 사진" : "영양 성분표 사진"}</span>`
                            }
                        </div>
                    </label>`
                        )
                        .join("")}
                </div>
                <button type="button" class="capture-next" data-action="capture-next" ${capturedPhotos.product && capturedPhotos.label ? "" : "disabled"}>다음</button>
            </div>
        `;
        host.appendChild(overlay);

        function updateNextEnabled() {
            overlay.querySelector(".capture-next").disabled = !(capturedPhotos.product && capturedPhotos.label);
        }

        overlay.querySelectorAll(".capture-slot").forEach((slot) => {
            const key = slot.dataset.slot;
            const input = slot.querySelector("input[type=file]");
            input.addEventListener("change", () => {
                const file = input.files && input.files[0];
                if (!file) return;
                if (capturedPhotos[key]) URL.revokeObjectURL(capturedPhotos[key].url);
                const url = URL.createObjectURL(file);
                capturedPhotos[key] = { file, url };
                slot.classList.add("filled");
                slot.querySelector(".capture-slot-inner").innerHTML = `<img src="${url}" alt=""><span class="capture-retake">다시 촬영</span>`;
                updateNextEnabled();
            });
        });

        overlay.querySelector("[data-close]").addEventListener("click", () => {
            resetCapturedPhotos();
            closeCaptureOverlay();
        });

        overlay.querySelector('[data-action="capture-next"]').addEventListener("click", () => {
            closeCaptureOverlay();
            openDetailOverlay();
        });
    }

    function openDetailOverlay() {
        if (!capturedPhotos.product || !capturedPhotos.label) return;
        closeDetailOverlay();
        const host = document.querySelector(".top") || document.body;
        draftQty = 30;

        const overlay = document.createElement("div");
        overlay.className = "detail-overlay";
        overlay.id = "detail-overlay";
        overlay.innerHTML = `
            <div class="detail-sheet">
                <div class="detail-hero">
                    <button type="button" class="detail-icon-btn detail-back" data-action="detail-back"><img class="detail-back-icon" src="images/icon-return.png" alt="뒤로"></button>
                    <button type="button" class="detail-icon-btn detail-close" data-close>✕</button>
                    <img class="detail-hero-image" id="detail-hero-image" src="${capturedPhotos.product.url}" alt="">
                    <div class="detail-thumbs">
                        <button type="button" class="detail-thumb active" data-thumb="product"><img src="${capturedPhotos.product.url}" alt=""></button>
                        <button type="button" class="detail-thumb" data-thumb="label"><img src="${capturedPhotos.label.url}" alt=""></button>
                    </div>
                </div>
                <form class="detail-body" id="detail-form">
                    <input type="text" class="detail-name-input" id="d-name" placeholder="제품명을 입력하세요" required>
                    <div class="detail-sub-row">
                        <span>1회</span>
                        <input type="text" class="detail-sub-input" id="d-dosage" value="1" inputmode="numeric">
                        <select id="d-unit">
                            <option>정</option>
                            <option>캡슐</option>
                            <option>ml</option>
                            <option>포</option>
                        </select>
                        <span>복용</span>
                    </div>

                    <div class="detail-qty-row">
                        <div class="detail-qty-label">현재 재고</div>
                        <div class="inv-qty-control">
                            <button type="button" class="qty-btn" data-action="d-dec">－</button>
                            <span class="qty-value" id="d-qty-value">30</span>
                            <button type="button" class="qty-btn" data-action="d-inc">＋</button>
                        </div>
                    </div>

                    <div class="ocr-scan-status" id="ocr-scan-status">성분표 사진을 스캔해서 자동으로 채워볼게요...</div>
                    <input type="text" class="detail-category-input" id="d-category" placeholder="카테고리 (예: 비타민, 오메가3)">
                    <input type="number" class="detail-category-input" id="d-percent" min="0" max="999" placeholder="하루 권장량 대비 % (예: 100)">
                    <input type="text" class="detail-category-input" id="d-amount" placeholder="실제 함유량 (예: 500mg)">
                    <textarea class="detail-desc-textarea" id="d-memo" placeholder="복용 방법이나 메모를 적어보세요"></textarea>

                    <button type="submit" class="detail-submit">내 영양제에 등록</button>
                </form>
            </div>
        `;
        host.appendChild(overlay);
        runLabelAutoScan(overlay);

        overlay.querySelectorAll(".detail-thumb").forEach((thumb) => {
            thumb.addEventListener("click", () => {
                overlay.querySelectorAll(".detail-thumb").forEach((t) => t.classList.remove("active"));
                thumb.classList.add("active");
                overlay.querySelector("#detail-hero-image").src = capturedPhotos[thumb.dataset.thumb].url;
            });
        });

        overlay.querySelector(".detail-back").addEventListener("click", () => {
            closeDetailOverlay();
            openCaptureOverlay();
        });

        overlay.querySelector("[data-close]").addEventListener("click", () => {
            resetCapturedPhotos();
            closeDetailOverlay();
        });

        overlay.querySelector('[data-action="d-dec"]').addEventListener("click", () => {
            draftQty = Math.max(0, draftQty - 1);
            overlay.querySelector("#d-qty-value").textContent = draftQty;
        });
        overlay.querySelector('[data-action="d-inc"]').addEventListener("click", () => {
            draftQty += 1;
            overlay.querySelector("#d-qty-value").textContent = draftQty;
        });

        overlay.querySelector("#detail-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = overlay.querySelector("#d-name").value.trim();
            if (!name) return;
            const category = overlay.querySelector("#d-category").value.trim();
            const dosage = overlay.querySelector("#d-dosage").value.trim() || "1";
            const unit = overlay.querySelector("#d-unit").value;
            const percent = overlay.querySelector("#d-percent").value.trim();
            const amount = overlay.querySelector("#d-amount").value.trim();
            const memo = overlay.querySelector("#d-memo").value.trim();

            // localStorage에 계속 남을 수 있도록 blob URL 대신 data URL(base64)로 변환
            const [photoDataUrl, labelDataUrl] = await Promise.all([
                fileToDataURL(capturedPhotos.product.file),
                fileToDataURL(capturedPhotos.label.file),
            ]);

            addMedicineCard({
                name,
                category,
                dosage,
                unit,
                quantity: draftQty,
                percent,
                amount,
                memo,
                photoUrl: photoDataUrl,
                labelPhotoUrl: labelDataUrl,
            });
            saveMedicinesToStorage();

            resetCapturedPhotos();
            closeDetailOverlay();
        });
    }

    function fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // ---------- 성분표 사진 자동 스캔(OCR): Tesseract.js로 글자를 읽어서
    // 카테고리/퍼센트/함유량 입력칸을 미리 채워줌. 인식이 틀릴 수 있어서
    // 항상 사용자가 확인하고 고칠 수 있는 입력칸에 채우기만 함 ----------
    // fuzzy:true인 키워드만 한 글자 정도 다르게 읽혀도 찾아냄. 비타민A/C/D처럼 글자 하나로만
    // 구분되는 단어는 fuzzy를 켜면 서로 오인식되기 쉬워서 정확히 일치할 때만 인정함(fuzzy:false)
    const OCR_NUTRIENT_KEYWORDS = [
        { kw: "비타민D", label: "비타민D", fuzzy: false },
        { kw: "비타민 D", label: "비타민D", fuzzy: false },
        { kw: "비타민B12", label: "비타민B12", fuzzy: false },
        { kw: "비타민 B12", label: "비타민B12", fuzzy: false },
        { kw: "비타민A", label: "비타민A", fuzzy: false },
        { kw: "비타민 A", label: "비타민A", fuzzy: false },
        { kw: "비타민C", label: "비타민C", fuzzy: false },
        { kw: "비타민 C", label: "비타민C", fuzzy: false },
        { kw: "오메가3", label: "오메가3", fuzzy: true },
        { kw: "오메가 3", label: "오메가3", fuzzy: true },
        { kw: "마그네슘", label: "마그네슘", fuzzy: true },
        { kw: "프로바이오틱스", label: "프로바이오틱스", fuzzy: true },
        { kw: "유산균", label: "프로바이오틱스", fuzzy: true },
        { kw: "엽산", label: "엽산", fuzzy: false },
        { kw: "밀크씨슬", label: "밀크씨슬", fuzzy: true },
        { kw: "실리마린", label: "밀크씨슬", fuzzy: true },
        { kw: "블랙마카", label: "블랙마카", fuzzy: true },
        { kw: "마카", label: "블랙마카", fuzzy: false },
        { kw: "멀티비타민", label: "멀티비타민", fuzzy: true },
        { kw: "아연", label: "아연", fuzzy: false },
        { kw: "칼슘", label: "칼슘", fuzzy: false },
        { kw: "철분", label: "철분", fuzzy: false },
        { kw: "루테인", label: "루테인", fuzzy: true },
        { kw: "콜라겐", label: "콜라겐", fuzzy: true },
    ];

    // 사진 인식 특성상 글자가 종종 틀리게 읽혀서("마그네슘" → "마그베숄" 등)
    // fuzzy가 켜진 키워드는 한 글자 정도 다른 것까지 허용해 찾아냄
    function levenshteinDistance(a, b) {
        const dp = [];
        for (let i = 0; i <= a.length; i++) dp.push([i]);
        for (let j = 1; j <= b.length; j++) dp[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                dp[i][j] =
                    a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
            }
        }
        return dp[a.length][b.length];
    }

    function containsKeyword(cleanedText, keyword, fuzzy) {
        const kw = keyword.replace(/[^가-힣a-zA-Z0-9]/g, "");
        if (!fuzzy || kw.length < 4) return cleanedText.indexOf(kw) !== -1;
        const maxDist = 1;
        for (let i = 0; i <= cleanedText.length - kw.length; i++) {
            if (levenshteinDistance(cleanedText.slice(i, i + kw.length), kw) <= maxDist) return true;
        }
        return false;
    }

    // 퍼센트/함유량 숫자는 성분표 표 안에 여러 개가 섞여 있어서(1회 섭취량, 총 내용량 등)
    // 어떤 숫자가 어떤 성분 것인지 사진만으로 정확히 짝짓기 어려움 - 잘못된 숫자를
    // 자신 있게 채워주는 것보다 카테고리(성분명)만 찾아주고 숫자는 직접 입력하게 둠
    function guessNutrientInfoFromText(text) {
        if (!text) return { category: "" };
        const cleanedText = text.replace(/[^가-힣a-zA-Z0-9]/g, "");

        const foundLabels = [];
        OCR_NUTRIENT_KEYWORDS.forEach(({ kw, label, fuzzy }) => {
            if (!containsKeyword(cleanedText, kw, fuzzy)) return;
            if (!foundLabels.includes(label)) foundLabels.push(label);
        });

        return { category: foundLabels.join(",") };
    }

    // 작은 글씨가 많은 성분표 사진은 확대만 해도 Tesseract 인식률이 올라가서
    // 인식 전에 캔버스로 2배 확대함 (색/대비를 억지로 바꾸면 라벨 디자인에 따라
    // 오히려 글자가 배경에 묻혀버리는 경우가 있어 확대만 함)
    function preprocessImageForOCR(file) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const scale = 2;
                const canvas = document.createElement("canvas");
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                const ctx = canvas.getContext("2d");
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob((blob) => resolve(blob || file), "image/png");
                URL.revokeObjectURL(img.src);
            };
            img.onerror = () => resolve(file);
            img.src = URL.createObjectURL(file);
        });
    }

    async function runLabelAutoScan(overlay) {
        const statusEl = overlay.querySelector("#ocr-scan-status");
        const categoryInput = overlay.querySelector("#d-category");
        if (!statusEl || !capturedPhotos.label) return;

        if (typeof Tesseract === "undefined") {
            statusEl.textContent = "자동 스캔을 불러오지 못했어요. 직접 입력해주세요.";
            statusEl.classList.add("ocr-scan-status-fail");
            setTimeout(() => statusEl.remove(), 2500);
            return;
        }

        statusEl.classList.add("scanning");
        categoryInput.disabled = true;

        try {
            const processedImage = await preprocessImageForOCR(capturedPhotos.label.file);
            const {
                data: { text },
            } = await Tesseract.recognize(processedImage, "kor+eng");

            if (!overlay.isConnected) return; // 스캔 중 사용자가 창을 닫은 경우

            const guess = guessNutrientInfoFromText(text);
            if (guess.category) categoryInput.value = guess.category;

            statusEl.classList.remove("scanning");
            if (guess.category) {
                statusEl.textContent = "성분표에서 이 성분을 찾았어요. 퍼센트·함유량은 직접 입력해주세요.";
            } else {
                statusEl.textContent = "자동으로 알아보지 못했어요. 직접 입력해주세요.";
                statusEl.classList.add("ocr-scan-status-fail");
            }
        } catch (err) {
            if (!overlay.isConnected) return;
            statusEl.textContent = "자동 스캔에 실패했어요. 직접 입력해주세요.";
            statusEl.classList.remove("scanning");
            statusEl.classList.add("ocr-scan-status-fail");
        } finally {
            if (overlay.isConnected) categoryInput.disabled = false;
        }
    }

    const TILE_BG_CLASSES = ["tile-bg-1", "tile-bg-2", "tile-bg-3"];

    function addMedicineCard({ name, category, dosage, unit, quantity, percent, amount, memo, photoUrl, labelPhotoUrl }) {
        const panel = document.querySelector(".panel-medicines");
        if (!panel) return;
        let grid = panel.querySelector(".medicine-grid");
        if (!grid) {
            grid = document.createElement("div");
            grid.className = "medicine-grid";
            panel.appendChild(grid);
        }

        const label = category || name;
        const bgClass = TILE_BG_CLASSES[grid.children.length % TILE_BG_CLASSES.length];

        const tile = document.createElement("div");
        tile.className = "medicine-tile";
        tile.dataset.name = name;
        tile.dataset.category = category || "";
        tile.dataset.dosage = dosage || "1";
        tile.dataset.unit = unit || "";
        tile.dataset.qty = quantity != null ? quantity : 0;
        tile.dataset.percent = percent || "";
        tile.dataset.amount = amount || "";
        tile.dataset.memo = memo || "";
        tile.dataset.labelPhoto = labelPhotoUrl || "";
        tile.innerHTML = `
            <div class="medicine-tile-photo ${photoUrl ? "" : bgClass}">
                ${photoUrl ? `<img src="${photoUrl}" alt="${escapeHtml(name)}">` : `<span class="medicine-tile-placeholder">💊</span>`}
            </div>
            <div class="medicine-tile-label">${escapeHtml(label)}</div>
        `;
        grid.appendChild(tile);
        updateMedicineCount();
    }

    // ---------- 내 영양제: localStorage에 저장/복원 ----------
    const MEDICINES_STORAGE_KEY = "geongangja_medicines_v3";

    function saveMedicinesToStorage() {
        const tiles = Array.from(document.querySelectorAll(".medicine-tile"));
        const data = tiles.map((t) => {
            const img = t.querySelector(".medicine-tile-photo img");
            return {
                name: t.dataset.name || "",
                category: t.dataset.category || "",
                dosage: t.dataset.dosage || "",
                unit: t.dataset.unit || "",
                qty: t.dataset.qty || "0",
                percent: t.dataset.percent || "",
                amount: t.dataset.amount || "",
                memo: t.dataset.memo || "",
                photoUrl: img ? img.src : "",
                labelPhoto: t.dataset.labelPhoto || "",
            };
        });
        try {
            localStorage.setItem(MEDICINES_STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            // 저장 용량 초과 등은 데모 앱 특성상 조용히 무시
        }
    }

    // 페이지 로드 시 1회 호출: localStorage에 저장된 게 있으면 그걸로 그리드를 다시 그리고,
    // 없으면(첫 방문) 지금 정적 HTML에 있는 타일들을 그대로 저장해서 앞으로도 유지되게 함
    function restoreMedicinesFromStorage() {
        let saved = null;
        try {
            const raw = localStorage.getItem(MEDICINES_STORAGE_KEY);
            saved = raw ? JSON.parse(raw) : null;
        } catch (e) {
            saved = null;
        }

        if (!saved) {
            saveMedicinesToStorage();
            updateMedicineCount();
            return;
        }

        const panel = document.querySelector(".panel-medicines");
        const grid = panel ? panel.querySelector(".medicine-grid") : null;

        // localStorage에 예전에 저장해둔 값이 새 기본 데이터(HTML)보다 정보가 부족할 수 있어서
        // (예: 나중에 퍼센트/함유량을 새로 채워넣은 제품), 이름이 같은 기본 타일을 찾아
        // 저장된 값에 빠진 필드만 채워 넣음. 사용자가 직접 고친 값은 그대로 유지됨
        const defaultsByName = {};
        if (grid) {
            grid.querySelectorAll(".medicine-tile").forEach((t) => {
                const img = t.querySelector(".medicine-tile-photo img");
                defaultsByName[t.dataset.name] = {
                    category: t.dataset.category || "",
                    percent: t.dataset.percent || "",
                    amount: t.dataset.amount || "",
                    memo: t.dataset.memo || "",
                    photoUrl: img ? img.src : "",
                    labelPhoto: t.dataset.labelPhoto || "",
                };
            });
        }
        if (grid) grid.innerHTML = "";

        saved.forEach((m) => {
            const def = defaultsByName[m.name];
            const category = m.category || (def ? def.category : "");
            const percent = m.percent || (def ? def.percent : "");
            const amount = m.amount || (def ? def.amount : "");
            const memo = m.memo || (def ? def.memo : "");
            // 사진(base64)은 기기 간 동기화 시 용량 문제로 제외되므로, 기본 제품이면
            // 정적 HTML에 있는 사진으로 채워 넣음(직접 촬영한 사진은 그대로 유지됨)
            const photoUrl = m.photoUrl || (def ? def.photoUrl : "");
            const labelPhoto = m.labelPhoto || (def ? def.labelPhoto : "");

            addMedicineCard({
                name: m.name,
                category,
                dosage: m.dosage,
                unit: m.unit,
                quantity: Number(m.qty) || 0,
                percent,
                amount,
                memo,
                photoUrl,
                labelPhotoUrl: labelPhoto,
            });
        });

        saveMedicinesToStorage();
        updateMedicineCount();
    }

    function deleteMedicineTile(tile) {
        const name = tile.dataset.name || "";
        if (!confirm(`'${name}'을(를) 삭제할까요? 등록된 사진과 정보가 모두 사라져요.`)) return false;
        tile.remove();
        updateMedicineCount();
        saveMedicinesToStorage();
        return true;
    }

    function updateMedicineCount() {
        const panel = document.querySelector(".panel-medicines");
        if (!panel) return;
        const countEl = panel.querySelector(".section-title");
        const count = panel.querySelectorAll(".medicine-tile").length;
        if (countEl) countEl.textContent = `내 영양제 (${count})`;
        // 등록된 영양제가 하나도 없으면 안내 문구를 보여줌
        const emptyEl = panel.querySelector(".medicine-empty");
        if (emptyEl) emptyEl.hidden = count > 0;
    }

    // ---------- 내 영양제 타일 클릭 → 상세페이지(hims 스타일) ----------
    function openMedicineDetailView(tile) {
        closeCaptureOverlay();
        closeDetailOverlay();
        const host = document.querySelector(".top") || document.body;

        const name = tile.dataset.name || "";
        const category = tile.dataset.category || "";
        const amount = tile.dataset.amount || "";
        const dosage = tile.dataset.dosage || "1";
        const unit = tile.dataset.unit || "";
        const expiry = tile.dataset.expiry || "";
        const memo = tile.dataset.memo || "";
        const labelPhoto = tile.dataset.labelPhoto || "";
        let qty = Number(tile.dataset.qty || 0);

        const photoImg = tile.querySelector(".medicine-tile-photo img");
        const photoUrl = photoImg ? photoImg.src : "";

        const heroPhoto = photoUrl || labelPhoto;

        const overlay = document.createElement("div");
        overlay.className = "detail-overlay";
        overlay.id = "detail-overlay";
        overlay.innerHTML = `
            <div class="detail-sheet">
                <div class="detail-hero">
                    <button type="button" class="detail-icon-btn detail-back" data-close><img class="detail-back-icon" src="images/icon-return.png" alt="뒤로"></button>
                    ${
                        heroPhoto
                            ? `<img class="detail-hero-image" id="detail-view-hero-image" src="${heroPhoto}" alt="${escapeHtml(name)}">`
                            : `<span class="detail-hero-placeholder">💊</span>`
                    }
                    ${
                        photoUrl && labelPhoto
                            ? `<div class="detail-thumbs">
                                <button type="button" class="detail-thumb active" data-thumb-src="${photoUrl}">
                                    <img src="${photoUrl}" alt="">
                                </button>
                                <button type="button" class="detail-thumb" data-thumb-src="${labelPhoto}">
                                    <img src="${labelPhoto}" alt="">
                                </button>
                               </div>`
                            : ""
                    }
                </div>
                <div class="detail-body">
                    <h2 class="detail-view-name">${escapeHtml(name)}</h2>
                    <div class="detail-category-badges">
                        ${parseAmountList(category, amount)
                            .map(
                                ({ label, amount: amt }, i) => `
                                <button type="button" class="detail-category-badge${amt ? "" : " no-amount"}" data-action="edit-amount" data-index="${i}">
                                    ${escapeHtml(label)}${amt ? ` <span class="badge-amount">${escapeHtml(amt)}</span>` : ` <span class="badge-add-amount">함량 입력</span>`}
                                </button>`
                            )
                            .join("")}
                    </div>

                    <div class="detail-field-label">복용 방법</div>
                    <div class="detail-sub-row"><span>1회 ${escapeHtml(dosage)}${escapeHtml(unit)} 복용</span></div>

                    <div class="detail-field-label">유통기한</div>
                    <button type="button" class="detail-sub-row detail-expiry-row" data-action="edit-expiry">
                        <span>${expiry ? escapeHtml(expiry) : '<span class="badge-add-amount">유통기한 입력</span>'}</span>
                    </button>

                    <div class="detail-qty-row boxed">
                        <div class="detail-qty-label">재고</div>
                        <div class="inv-qty-control">
                            <button type="button" class="qty-btn" data-action="v-dec">－</button>
                            <span class="qty-value" id="v-qty-value">${qty}</span>
                            <button type="button" class="qty-btn" data-action="v-inc">＋</button>
                        </div>
                    </div>

                    ${
                        memo
                            ? `<div class="detail-view-memo">
                                   <div class="detail-view-memo-title">기타 안내사항</div>
                                   <p>${escapeHtml(memo)}</p>
                               </div>`
                            : ""
                    }

                    <button type="button" class="detail-delete-btn" data-action="delete-medicine">이 영양제 삭제</button>
                </div>
            </div>
        `;
        host.appendChild(overlay);

        overlay.querySelectorAll(".detail-thumb").forEach((thumb) => {
            thumb.addEventListener("click", () => {
                overlay.querySelectorAll(".detail-thumb").forEach((t) => t.classList.remove("active"));
                thumb.classList.add("active");
                overlay.querySelector("#detail-view-hero-image").src = thumb.dataset.thumbSrc;
            });
        });

        overlay.querySelector("[data-close]").addEventListener("click", closeDetailOverlay);
        overlay.querySelector('[data-action="v-dec"]').addEventListener("click", () => {
            qty = Math.max(0, qty - 1);
            overlay.querySelector("#v-qty-value").textContent = qty;
            tile.dataset.qty = qty;
            saveMedicinesToStorage();
        });
        overlay.querySelector('[data-action="v-inc"]').addEventListener("click", () => {
            qty += 1;
            overlay.querySelector("#v-qty-value").textContent = qty;
            tile.dataset.qty = qty;
            saveMedicinesToStorage();
        });
        overlay.querySelector('[data-action="delete-medicine"]').addEventListener("click", () => {
            if (deleteMedicineTile(tile)) closeDetailOverlay();
        });

        overlay.querySelectorAll('[data-action="edit-amount"]').forEach((badge) => {
            badge.addEventListener("click", () => {
                const idx = Number(badge.dataset.index);
                const labels = (tile.dataset.category || "").split(",").map((s) => s.trim()).filter(Boolean);
                const amounts = (tile.dataset.amount || "").split(",").map((s) => s.trim());
                while (amounts.length < labels.length) amounts.push("");
                const input = window.prompt(`${labels[idx]} 함유량을 입력해주세요 (예: 500mg)`, amounts[idx] || "");
                if (input === null) return;
                amounts[idx] = input.trim();
                tile.dataset.amount = amounts.join(",");
                saveMedicinesToStorage();
                openMedicineDetailView(tile);
            });
        });

        overlay.querySelector('[data-action="edit-expiry"]').addEventListener("click", () => {
            const input = window.prompt("유통기한을 입력해주세요 (예: 2027-03-15)", tile.dataset.expiry || "");
            if (input === null) return;
            tile.dataset.expiry = input.trim();
            saveMedicinesToStorage();
            openMedicineDetailView(tile);
        });
    }

    // ---------- 오늘의 영양제: + 버튼 → 내 영양제 목록에서 골라 오늘 목록에 추가 ----------
    // 복용 체크 시 해당 영양소의 헤더 아래 섭취 그래프(boxGrap)를 채워줌
    // "마그네슘,비타민D" + "100,100" 처럼 콤마로 나열된 여러 성분을 병렬 목록으로 해석
    function parseNutrientList(categoryStr, percentStr) {
        const labels = (categoryStr || "").split(",").map((s) => s.trim()).filter(Boolean);
        const percents = (percentStr || "").split(",").map((s) => s.trim());
        return labels.map((label, i) => ({ label, percent: Number(percents[i]) || 0 }));
    }

    function parseAmountList(categoryStr, amountStr) {
        const labels = (categoryStr || "").split(",").map((s) => s.trim()).filter(Boolean);
        const amounts = (amountStr || "").split(",").map((s) => s.trim());
        return labels.map((label, i) => ({ label, amount: amounts[i] || "" }));
    }

    // 홈 탭 캡슐 그래프는 "오늘 체크한 항목들의 %RDA"를 그대로 보여줘야 체크할 때마다
    // 바로 채워지는 느낌이 나서 원래 percent를 그대로 씀. 건강상태 탭 위쪽의 인라인
    // 그래프는 일주일(월~일) 치 기준이라 percent를 7로 나눠서 하루 체크만으로
    // 주간 그래프가 100%를 넘지 않게 함. "이번달 복용율" 쪽은 refreshNutritionAnalysis에서
    // 따로 월 일수로 나눠서 처리함
    const WEEK_DAYS = 7;

    function daysInCurrentMonth() {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    }

    function applyNutrientIntake(categoryStr, percentStr, add) {
        parseNutrientList(categoryStr, percentStr).forEach(({ label, percent }) => {
            if (!percent) return;
            const source = NUTRIENT_SOURCES.find((nu) => nu.label === label);
            if (!source) return;
            const signedDaily = add ? percent : -percent;
            const signedWeekly = signedDaily / WEEK_DAYS;

            document.querySelectorAll(`.boxGrap:not(.boxGrap-inline) .nutrient-fill.${source.key}`).forEach((fillEl) => {
                const current = parseFloat(fillEl.style.height) || 0;
                fillEl.style.height = `${Math.max(0, current + signedDaily)}%`;
            });
            document.querySelectorAll(`.boxGrap-inline .nutrient-fill.${source.key}`).forEach((fillEl) => {
                const current = parseFloat(fillEl.style.height) || 0;
                fillEl.style.height = `${Math.max(0, current + signedWeekly)}%`;
            });
        });
        refreshNutritionAnalysis();
    }

    // 건강상태 탭의 링 그래프/과대·부족 리스트를 실제 캡슐 그래프 값 기준으로 다시 그림
    function refreshNutritionAnalysis() {
        const grid = document.getElementById("nutri-ring-grid");
        if (!grid) return;

        let total = 0;
        const overItems = [];
        const lowItems = [];
        const monthDays = daysInCurrentMonth();

        NUTRIENT_SOURCES.forEach((nu) => {
            // 월간 계산은 하루치 원본 값이 필요하므로 7일 기준으로 이미 나뉜 인라인
            // 그래프가 아니라 홈 탭의 원본 캡슐 그래프 값을 기준으로 함
            const fillEl = document.querySelector(`.boxGrap:not(.boxGrap-inline) .nutrient-fill.${nu.key}`);
            const dailyPct = fillEl ? parseFloat(fillEl.style.height) || 0 : 0;
            // 하루치 %RDA(dailyPct)를 그대로 쓰면 하루만 체크해도 월간 그래프가 100%를
            // 넘어버리므로, 이번 달 일수로 나눠서 "이번 달 전체 필요량 중 며칠치를
            // 채웠는지"로 환산함
            const pct = dailyPct / monthDays;
            total += pct;

            const box = grid.querySelector(`[data-nutrient-key="${nu.key}"]`);
            if (box) {
                const ring = box.querySelector(".nutri-ring");
                const valueEl = box.querySelector(".nutri-ring-value");
                ring.style.setProperty("--pct", pct);
                ring.classList.toggle("over", pct > 100);
                ring.classList.toggle("low", pct < 50);
                valueEl.textContent = `${Math.round(pct)}%`;
            }

            if (pct > 100) overItems.push({ ...nu, pct });
            else if (pct < 50) lowItems.push({ ...nu, pct });
        });

        const avgEl = document.getElementById("nutri-rate-avg");
        if (avgEl) avgEl.textContent = `${Math.round(total / NUTRIENT_SOURCES.length)}%`;

        renderGapList("over", overItems);
        renderGapList("low", lowItems);
    }

    function renderGapList(kind, items) {
        const section = document.getElementById(kind === "over" ? "nutri-over-section" : "nutri-low-section");
        const list = document.getElementById(kind === "over" ? "nutri-over-list" : "nutri-low-list");
        if (!section || !list) return;

        section.hidden = items.length === 0;
        list.innerHTML = items
            .map((nu) => {
                const hint = NUTRITION_HINTS[nu.key] ? NUTRITION_HINTS[nu.key][kind] : "";
                return `
                <div class="card nutrient-gap-item ${kind === "over" ? "over" : ""}">
                    <div class="nutrient-gap-name"><span class="gap-warn-icon">⚠</span> ${escapeHtml(nu.label)} ${Math.round(nu.pct)}%</div>
                    <div class="nutrient-gap-hint">${escapeHtml(hint)}</div>
                </div>`;
            })
            .join("");
    }

    // 복용 체크 시 해당 영양제의 재고를 1씩 줄이고(취소하면 다시 늘림)
    function adjustStock(name, add) {
        const tile = Array.from(document.querySelectorAll(".medicine-tile")).find((t) => t.dataset.name === name);
        if (!tile) return;
        const current = Number(tile.dataset.qty || 0);
        const next = Math.max(0, current + (add ? 1 : -1));
        tile.dataset.qty = next;
    }

    function wireTodayCheck(btn) {
        btn.addEventListener("click", () => {
            const item = btn.closest(".today-item");
            if (item && item.classList.contains("show-remove")) {
                deleteTodayItem(item);
                return;
            }
            const checked = btn.classList.toggle("checked");
            const timeEl = btn.parentElement.querySelector(".today-check-time");
            const category = item ? item.dataset.category : "";
            const percent = item ? item.dataset.percent : "";
            const name = item ? item.querySelector(".today-item-name").textContent : "";

            applyNutrientIntake(category, percent, checked);
            adjustStock(name, !checked);

            if (timeEl) {
                if (checked) {
                    const now = new Date();
                    const hh = String(now.getHours()).padStart(2, "0");
                    const mm = String(now.getMinutes()).padStart(2, "0");
                    timeEl.textContent = `${hh}:${mm}`;
                } else {
                    timeEl.textContent = "";
                }
            }
            saveTodayToStorage();
            saveMedicinesToStorage();
            updateWaitingMascot();
        });
    }

    function addTodayItem(name, notifyInteraction) {
        const list = document.querySelector(".today-list");
        if (!list) return;

        const tile = Array.from(document.querySelectorAll(".medicine-tile")).find((t) => t.dataset.name === name);
        const category = tile ? tile.dataset.category || "" : "";
        const percent = tile ? tile.dataset.percent || "" : "";

        const item = document.createElement("div");
        item.className = "today-item today-item-removable";
        item.dataset.category = category;
        item.dataset.percent = percent;
        item.innerHTML = `
            <span class="today-item-name">${escapeHtml(name)}</span>
            <div class="today-check-group">
                <span class="today-check-time"></span>
                <button type="button" class="today-check" aria-label="복용 체크">✓</button>
            </div>
        `;
        list.appendChild(item);
        wireTodayCheck(item.querySelector(".today-check"));
        wireLongPressDelete(item);

        const imgBox = document.querySelector(".today .imgBox");
        if (imgBox) imgBox.style.visibility = "hidden";

        // 복용 체크 시점이 아니라, 오늘의 영양제 목록에 "포함"시키는 시점(추천받기 +,
        // 오늘 먹을 영양제 추가 팝업)에 다른 항목과의 상호작용을 바로 알려줌. 저장된
        // 데이터를 복원할 때(notifyInteraction === false)는 매번 다시 뜨지 않게 건너뜀
        if (notifyInteraction !== false && category) {
            const myCategories = category.split(",").map((s) => s.trim()).filter(Boolean);
            const others = Array.from(document.querySelectorAll(".today-item")).filter((el) => el !== item);
            for (const other of others) {
                const otherCategories = (other.dataset.category || "").split(",").map((s) => s.trim()).filter(Boolean);
                const warning = findInteractionWarning(myCategories, otherCategories);
                if (warning) {
                    const otherName = other.querySelector(".today-item-name").textContent;
                    showInteractionWarningModal(name, otherName, warning.note);
                    break;
                }
            }
        }

        saveTodayToStorage();
        return item;
    }

    // ---------- 오늘의 영양제: localStorage에 저장/복원 ----------
    const TODAY_STORAGE_KEY = "geongangja_today_v1";

    function saveTodayToStorage() {
        const items = Array.from(document.querySelectorAll(".today-item")).map((item) => ({
            name: item.querySelector(".today-item-name").textContent,
            checked: item.querySelector(".today-check").classList.contains("checked"),
            time: item.querySelector(".today-check-time").textContent || "",
            removable: item.classList.contains("today-item-removable"),
        }));
        try {
            localStorage.setItem(TODAY_STORAGE_KEY, JSON.stringify(items));
        } catch (e) {
            // 저장 용량 초과 등은 데모 앱 특성상 조용히 무시
        }
    }

    // 페이지 로드 시 1회 호출: 추가했던 항목을 다시 만든 뒤 체크 상태를 복원함(예전 버전에서 저장된 고정 항목은
    // 화면에 없으면 건너뜀). 재고는 이미 영양제 타일에
    // 저장돼 있으므로 다시 차감하지 않고, 영양소 그래프만 체크된 항목 기준으로 다시 채움
    function restoreTodayFromStorage() {
        let saved = null;
        try {
            const raw = localStorage.getItem(TODAY_STORAGE_KEY);
            saved = raw ? JSON.parse(raw) : null;
        } catch (e) {
            saved = null;
        }
        if (!saved) return;

        saved.forEach((s) => {
            let item;
            if (s.removable) {
                item = addTodayItem(s.name, false);
            } else {
                item = Array.from(document.querySelectorAll(".today-item")).find(
                    (el) => !el.classList.contains("today-item-removable") && el.querySelector(".today-item-name").textContent === s.name
                );
            }
            if (item && s.checked) {
                item.querySelector(".today-check").classList.add("checked");
                item.querySelector(".today-check-time").textContent = s.time;
            }
        });

        document.querySelectorAll(".today-item").forEach((item) => {
            if (item.querySelector(".today-check").classList.contains("checked")) {
                applyNutrientIntake(item.dataset.category, item.dataset.percent, true);
            }
        });
    }

    function isAlreadyInTodayList(name) {
        return Array.from(document.querySelectorAll(".today-item-name")).some((el) => el.textContent === name);
    }

    function renderRecResults(condition) {
        const resultsEl = document.getElementById("rec-results");
        if (!resultsEl) return;

        const nutrients = RECOMMENDATIONS[condition];
        if (!nutrients) {
            resultsEl.innerHTML = "";
            return;
        }

        const tiles = Array.from(document.querySelectorAll(".medicine-tile"));

        const rowsHtml = nutrients
            .map((nutrient) => {
                const owned = tiles.filter((t) =>
                    parseNutrientList(t.dataset.category, t.dataset.percent).some((n) => n.label === nutrient)
                );
                if (owned.length === 0) {
                    return `
                    <div class="card rec-item-top">
                        <span class="rec-name">${escapeHtml(nutrient)}</span>
                        <span class="rec-status muted">등록된 제품 없음</span>
                    </div>`;
                }
                return owned
                    .map((tile) => {
                        const productName = tile.dataset.name || "";
                        const added = isAlreadyInTodayList(productName);
                        return `
                        <div class="card rec-item-top">
                            <span class="rec-name">${escapeHtml(productName)} <span class="rec-nutrient-tag">${escapeHtml(nutrient)}</span></span>
                            ${
                                added
                                    ? `<button type="button" class="rec-status safe" data-remove-name="${escapeHtml(productName)}" aria-label="추가됨, 눌러서 빼기">✓</button>`
                                    : `<button type="button" class="rec-add-btn" data-add-name="${escapeHtml(productName)}">+</button>`
                            }
                        </div>`;
                    })
                    .join("");
            })
            .join("");

        resultsEl.innerHTML = rowsHtml;

        resultsEl.querySelectorAll("[data-add-name]").forEach((btn) => {
            btn.addEventListener("click", () => {
                addTodayItem(btn.dataset.addName);
                renderRecResults(condition);
            });
        });
        resultsEl.querySelectorAll("[data-remove-name]").forEach((btn) => {
            btn.addEventListener("click", () => {
                removeTodayItemByName(btn.dataset.removeName);
                renderRecResults(condition);
            });
        });
    }

    // 추천받기 결과의 "추가됨" 배지를 다시 누르면 확인창 없이 바로 빼줌(+버튼의 반대 동작)
    function removeTodayItemByName(name) {
        const item = Array.from(document.querySelectorAll(".today-item")).find(
            (el) => el.classList.contains("today-item-removable") && el.querySelector(".today-item-name").textContent === name
        );
        if (!item) return;

        if (item.querySelector(".today-check").classList.contains("checked")) {
            applyNutrientIntake(item.dataset.category, item.dataset.percent, false);
        }
        item.remove();

        const remaining = document.querySelectorAll(".today-item-removable").length;
        const imgBox = document.querySelector(".today .imgBox");
        if (remaining === 0 && imgBox) imgBox.style.visibility = "visible";

        saveTodayToStorage();
        updateWaitingMascot();
    }

    function wireConditionButtons() {
        document.querySelectorAll("button[data-condition]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const isActive = btn.classList.contains("active");
                document.querySelectorAll("button[data-condition]").forEach((b) => b.classList.remove("active"));

                if (isActive) {
                    renderRecResults(null);
                    return;
                }
                btn.classList.add("active");
                renderRecResults(btn.dataset.condition);
            });
        });
    }

    // ---------- 건강상태: 영양소 필터 pill ↔ 차트 막대 하이라이트 ----------
    function wireNutrientPills() {
        document.querySelectorAll(".nutri-pill").forEach((pill) => {
            pill.addEventListener("click", () => {
                const nutrient = pill.dataset.nutrient;

                document.querySelectorAll(".nutri-pill").forEach((p) => p.classList.toggle("active", p === pill));
                document.querySelectorAll(".nutrient-bar-fill").forEach((fill) => {
                    const bar = fill.closest(".nutrient-bar");
                    fill.classList.toggle("active", bar && bar.dataset.nutrient === nutrient);
                });
            });
        });
    }

    // ---------- 건강상태: 주차 이동 (실제 날짜 기준, 월~일이 한 주) ----------
    // 주어진 날짜가 속한 주의 월요일을 구함
    function mondayOf(date) {
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const day = d.getDay(); // 0=일 ... 6=토
        const diff = day === 0 ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        return d;
    }

    // 월요일 날짜를 받아 "그 월요일이 속한 달의 몇 번째 월~일 주"인지 계산.
    // 그 달 1일이 포함된 주가 전달로 걸치면(1일이 월요일이 아니면) 그 주는
    // 전달 마지막 주로 치고, 다음 월요일부터를 이 달 1주차로 침
    function getWeekLabel(monday) {
        const month = monday.getMonth();
        const year = monday.getFullYear();
        let firstMonday = mondayOf(new Date(year, month, 1));
        if (firstMonday.getMonth() !== month) {
            firstMonday = new Date(firstMonday);
            firstMonday.setDate(firstMonday.getDate() + 7);
        }
        const week = Math.round((monday - firstMonday) / (7 * 24 * 60 * 60 * 1000)) + 1;
        return { month: month + 1, week };
    }

    function wireWeekNav() {
        const titleEl = document.getElementById("nutri-week-title");
        if (!titleEl) return;
        let currentMonday = mondayOf(new Date());

        function render() {
            const { month, week } = getWeekLabel(currentMonday);
            titleEl.textContent = `${month}월 ${week}주차`;
        }

        document.querySelector('[data-action="week-prev"]').addEventListener("click", () => {
            currentMonday = new Date(currentMonday);
            currentMonday.setDate(currentMonday.getDate() - 7);
            render();
        });
        document.querySelector('[data-action="week-next"]').addEventListener("click", () => {
            currentMonday = new Date(currentMonday);
            currentMonday.setDate(currentMonday.getDate() + 7);
            render();
        });

        render();
    }

    function deleteTodayItem(item) {
        const name = item.querySelector(".today-item-name").textContent;
        if (!confirm(`'${name}'을(를) 오늘의 영양제 목록에서 삭제할까요?`)) {
            exitDeleteMode(item);
            return;
        }
        if (item.querySelector(".today-check").classList.contains("checked")) {
            applyNutrientIntake(item.dataset.category, item.dataset.percent, false);
        }
        item.remove();

        const remaining = document.querySelectorAll(".today-item-removable").length;
        const imgBox = document.querySelector(".today .imgBox");
        if (remaining === 0 && imgBox) imgBox.style.visibility = "visible";

        saveTodayToStorage();
        updateWaitingMascot();
    }

    function exitDeleteMode(item) {
        item.classList.remove("show-remove");
        const checkBtn = item.querySelector(".today-check");
        if (checkBtn) checkBtn.textContent = "✓";
    }

    function wireLongPressDelete(item) {
        const LONG_PRESS_MS = 500;
        let pressTimer = null;
        const checkBtn = item.querySelector(".today-check");

        item.addEventListener("pointerdown", () => {
            pressTimer = setTimeout(() => {
                item.classList.add("show-remove");
                checkBtn.textContent = "✕";
            }, LONG_PRESS_MS);
        });
        ["pointerup", "pointerleave", "pointercancel"].forEach((evt) => {
            item.addEventListener(evt, () => clearTimeout(pressTimer));
        });

        document.addEventListener("pointerdown", (e) => {
            if (!item.contains(e.target)) exitDeleteMode(item);
        });
    }

    function closeTodayPickerOverlay() {
        const el = document.getElementById("today-picker-overlay");
        if (el) el.remove();
    }

    function openTodayPickerOverlay() {
        closeTodayPickerOverlay();
        const host = document.querySelector(".top") || document.body;
        const tiles = Array.from(document.querySelectorAll(".medicine-tile"));

        function renderRows(keyword) {
            const kw = (keyword || "").trim().toLowerCase();
            const filtered = tiles.filter((t) => (t.dataset.name || "").toLowerCase().includes(kw));
            if (filtered.length === 0) {
                return `<div class="picker-empty">${kw ? "검색 결과가 없어요" : "등록된 영양제가 없어요. '영양제' 탭에서 먼저 등록해 주세요."}</div>`;
            }
            return filtered
                .map((t) => {
                    const img = t.querySelector(".medicine-tile-photo img");
                    const photoUrl = img ? img.src : "";
                    const bgClass = photoUrl
                        ? ""
                        : (t.querySelector(".medicine-tile-photo").className.split(" ").find((c) => c.startsWith("tile-bg-")) || "");
                    const name = t.dataset.name || "";
                    const percent = t.dataset.percent;
                    const amount = t.dataset.amount;
                    return `
                    <button type="button" class="picker-row" data-name="${escapeHtml(name)}">
                        <span class="picker-row-photo ${bgClass}">
                            ${photoUrl ? `<img src="${photoUrl}" alt="">` : `<span class="medicine-tile-placeholder">💊</span>`}
                        </span>
                        <span class="picker-row-name">${escapeHtml(name)}</span>
                        ${
                            percent
                                ? `<span class="picker-row-meta">
                                    <span class="picker-row-percent">${escapeHtml(percent)}%</span>
                                    ${amount ? `<span class="picker-row-amount">${escapeHtml(amount)}</span>` : ""}
                                </span>`
                                : ""
                        }
                    </button>`;
                })
                .join("");
        }

        const overlay = document.createElement("div");
        overlay.className = "capture-overlay";
        overlay.id = "today-picker-overlay";
        overlay.innerHTML = `
            <div class="capture-sheet">
                <div class="capture-header">
                    <span>오늘 먹을 영양제 추가</span>
                    <button type="button" class="capture-close" data-close>✕</button>
                </div>
                <input type="text" class="picker-search" id="picker-search" placeholder="영양제 이름 검색">
                <div class="picker-list" id="picker-list">${renderRows("")}</div>
            </div>
        `;
        host.appendChild(overlay);

        function wireRows() {
            overlay.querySelectorAll(".picker-row").forEach((row) => {
                row.addEventListener("click", () => {
                    addTodayItem(row.dataset.name);
                    closeTodayPickerOverlay();
                });
            });
        }
        wireRows();

        overlay.querySelector("#picker-search").addEventListener("input", (e) => {
            overlay.querySelector("#picker-list").innerHTML = renderRows(e.target.value);
            wireRows();
        });

        overlay.querySelector("[data-close]").addEventListener("click", closeTodayPickerOverlay);
    }

    // ---------- 스토어: 직접 만든 상품 카드 이미지(images/prodocts/)를 보여주고, 누르면 다이소몰의 해당
    // 상품 페이지로 연결됨. nutrients는 카드 아래에 보여줄 들어 있는 영양소(이미지에 적힌 성분 기준) ----------
    const STORE_PRODUCTS = [
        { name: "대웅제약 코엔자임 Q10 30캡슐 30일분", tag: "혈행/혈당/혈압", image: "images/prodocts/Q10.png", nutrients: "코엔자임Q10 (최대 100mg)", url: "https://www.daisomall.co.kr/pd/pdr/SCR_PDR_0001?pdNo=600000144" },
        { name: "대웅제약 바나바잎 추출물 30정 30일분", tag: "혈행/혈당/혈압", image: "images/prodocts/banana.png", nutrients: "바나바잎 추출물 (코로솔산 1.3mg)", url: "https://www.daisomall.co.kr/pd/pdr/SCR_PDR_0001?pdNo=600000131" },
        { name: "오브맘 다이어트 홀릭 30포 15일분", tag: "다이어트", image: "images/prodocts/diet.png", nutrients: "가르시니아캄보지아추출물, 판토텐산, 비타민B1", url: "https://www.daisomall.co.kr/pd/pdr/SCR_PDR_0001?pdNo=913624075" },
        { name: "대웅제약 녹차카테킨 30정 30일분", tag: "다이어트", image: "images/prodocts/green%20tea.png", nutrients: "녹차 카테킨", url: "https://www.daisomall.co.kr/pd/pdr/SCR_PDR_0001?pdNo=600000136" },
        { name: "오브맘 눈건강 루테인 하루구미 30일분", tag: "눈건강", image: "images/prodocts/eyes.png", nutrients: "루테인", url: "https://www.daisomall.co.kr/pd/pdr/SCR_PDR_0001?pdNo=613602126" },
        { name: "LG생활건강 이너뷰 콜라겐 더마스틱 7포", tag: "이너뷰티", image: "images/prodocts/inner%20beautiy.png", nutrients: "저분자콜라겐펩타이드 GT", url: "https://www.daisomall.co.kr/pd/pdr/SCR_PDR_0001?pdNo=994953528" },
        { name: "대웅제약 어린이 칼슘 마그네슘D 츄어블 60정 30일분", tag: "키즈", image: "images/prodocts/kids.png", nutrients: "칼슘, 비타민D, 마그네슘", url: "https://www.daisomall.co.kr/pd/pdr/SCR_PDR_0001?pdNo=600000143" },
        { name: "종근당건강 락토핏 골드", tag: "장/간건강", image: "images/prodocts/lacktofit.png", nutrients: "프로바이오틱스(유산균)", url: "https://www.daisomall.co.kr/pd/pdr/SCR_PDR_0001?pdNo=591580521" },
        { name: "동국제약 비타민D 2000IU 40캡슐 40일분", tag: "기초건강", image: "images/prodocts/vitamenD3.png", nutrients: "비타민D3 2000IU", url: "https://www.daisomall.co.kr/pd/pdr/SCR_PDR_0001?pdNo=610910777" },
    ];

    const STORE_PAGE_SIZE = 9;

    function renderStoreGrid(activeTag, keyword, page) {
        const grid = document.getElementById("store-grid");
        const pager = document.getElementById("store-pager");
        if (!grid) return;
        const kw = (keyword || "").trim().toLowerCase();
        const filtered = STORE_PRODUCTS.filter(
            (p) => (activeTag === "전체" || p.tag === activeTag) && (p.name + " " + p.nutrients).toLowerCase().includes(kw)
        );

        const totalPages = Math.max(1, Math.ceil(filtered.length / STORE_PAGE_SIZE));
        const curPage = Math.min(Math.max(1, page || 1), totalPages);
        const start = (curPage - 1) * STORE_PAGE_SIZE;
        const items = filtered.slice(start, start + STORE_PAGE_SIZE);

        grid.innerHTML =
            items
                .map(
                    (p) => `
            <a class="store-card" href="${p.url}" target="_blank" rel="noopener noreferrer" aria-label="${escapeHtml(p.name)} (다이소몰에서 보기)">
                <span class="store-card-img"><img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy"></span>
                <span class="store-card-nutrients">${escapeHtml(p.nutrients)}</span>
            </a>`
                )
                .join("") || `<div class="store-empty">검색 결과가 없어요</div>`;

        if (pager) {
            pager.innerHTML =
                totalPages <= 1
                    ? ""
                    : Array.from({ length: totalPages }, (_, i) => i + 1)
                          .map((n) => `<button type="button" class="store-page-btn${n === curPage ? " active" : ""}" data-page="${n}">${n}</button>`)
                          .join("");
            pager.querySelectorAll(".store-page-btn").forEach((btn) => {
                btn.addEventListener("click", () => {
                    renderStoreGrid(activeTag, keyword, Number(btn.dataset.page));
                    // scrollIntoView()는 .top의 overflow:hidden까지 스크롤 대상으로
                    // 잡아서 헤더가 화면 밖으로 밀려나는 문제가 있어, 실제 스크롤 컨테이너
                    // (.view)만 직접 맨 위로 되돌림
                    const scrollContainer = grid.closest(".view");
                    if (scrollContainer) scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
                });
            });
        }
    }

    function wireStore() {
        const tabsEl = document.getElementById("store-tabs");
        const searchEl = document.getElementById("store-search");
        if (!tabsEl || !searchEl) return;

        const tags = ["전체", ...new Set(STORE_PRODUCTS.map((p) => p.tag))];
        tabsEl.innerHTML = tags
            .map((t, i) => `<button type="button" class="store-tab${i === 0 ? " active" : ""}" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`)
            .join("");

        let activeTag = "전체";
        tabsEl.querySelectorAll(".store-tab").forEach((tab) => {
            tab.addEventListener("click", () => {
                tabsEl.querySelectorAll(".store-tab").forEach((t) => t.classList.remove("active"));
                tab.classList.add("active");
                activeTag = tab.dataset.tag;
                renderStoreGrid(activeTag, searchEl.value, 1);
            });
        });

        searchEl.addEventListener("input", () => renderStoreGrid(activeTag, searchEl.value, 1));

        renderStoreGrid(activeTag, "", 1);
    }

    function init() {
        renderCalendar();
        const boxGrap = document.querySelector(".boxGrap");
        if (boxGrap) boxGrap.addEventListener("click", handleBoxGrapClick);

        wireStore();

        showRandomWaitingMascot();
        const homeMenuRadio = document.getElementById("menu-home");
        if (homeMenuRadio) homeMenuRadio.addEventListener("change", showRandomWaitingMascot);

        restoreMedicinesFromStorage();

        wireConditionButtons();
        updateMedicineCount();
        wireNutrientPills();
        wireWeekNav();
        refreshNutritionAnalysis();

        // 네비 중앙의 + 버튼: 누르면 X로 바뀌면서 위로 스캔(제품 사진 등록)/검색(오늘
        // 먹을 영양제 추가) 두 보조 버튼이 펼쳐짐. 다시 누르거나 바깥을 누르면 접힘
        const navFabWrap = document.getElementById("nav-fab-wrap");
        const navFabBtn = document.getElementById("nav-fab-btn");
        const navFabScan = document.getElementById("nav-fab-scan");
        const navFabSearch = document.getElementById("nav-fab-search");
        if (navFabWrap && navFabBtn) {
            const closeFabMenu = () => navFabWrap.classList.remove("open");
            navFabBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                navFabWrap.classList.toggle("open");
            });
            if (navFabScan) {
                navFabScan.addEventListener("click", (e) => {
                    e.stopPropagation();
                    closeFabMenu();
                    openCaptureOverlay();
                });
            }
            if (navFabSearch) {
                navFabSearch.addEventListener("click", (e) => {
                    e.stopPropagation();
                    closeFabMenu();
                    openTodayPickerOverlay();
                });
            }
            document.addEventListener("click", (e) => {
                if (!navFabWrap.contains(e.target)) closeFabMenu();
            });
        }

        const medicinesPanel = document.querySelector(".panel-medicines");
        if (medicinesPanel) {
            medicinesPanel.addEventListener("click", (e) => {
                const tile = e.target.closest(".medicine-tile");
                if (tile) openMedicineDetailView(tile);
            });
        }

        document.querySelectorAll(".today-check").forEach(wireTodayCheck);
        restoreTodayFromStorage();
        updateWaitingMascot();
        refreshNutritionAnalysis();

        checkReminders();
        setInterval(checkReminders, 30000);

        maybeShowOnboarding();
        if ("Notification" in window && Notification.permission === "granted" && !localStorage.getItem(PUSH_SCHEDULED_KEY)) {
            setupGeneralServerPushReminders();
        }
        wirePushToggle();
        wireSyncButtons();
        wireOnboardingReplay();

        updateScreenBackdrop();
        requestAnimationFrame(updateScreenBackdrop);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    // 홈 화면에 앱처럼 설치할 수 있도록(PWA) 서비스 워커 등록. 오프라인 캐싱만 담당하고,
    // 서버에서 보내는 푸시 알림 기능은 아직 없음(잠금화면 알림은 이 탭이 열려있을 때만 동작)
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("service-worker.js").catch(() => {});
        });
    }
})();
