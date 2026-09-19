// 건강자 서비스 워커: 오프라인에서도 앱 껍데기(HTML/CSS/JS)가 뜨도록 캐싱하고,
// 서버(/api/send-push)가 보낸 푸시 알림을 받아 화면에 띄우는 역할도 함.
//
// 캐시 우선 전략을 쓰면 배포를 새로 해도 예전 버전이 계속 보이는 문제가 있어서
// (실제로 겪은 버그), 네트워크를 먼저 시도하고 오프라인일 때만 캐시를 씀.
// CACHE_NAME을 올릴 때마다 이전 캐시는 자동으로 지워짐.
const CACHE_NAME = "geongangja-v2";
const CORE_ASSETS = ["/", "/index.html", "/style.css", "/header.js", "/manifest.json"];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;
    event.respondWith(
        fetch(event.request)
            .then((res) => {
                const copy = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                return res;
            })
            .catch(() => caches.match(event.request))
    );
});

// 서버(/api/send-push)가 보낸 푸시를 받아 알림으로 띄움. 앱이 꺼져 있어도 서비스 워커가
// 깨어나서 처리하기 때문에(브라우저/OS가 지원하는 한) 잠금화면에도 뜰 수 있음.
self.addEventListener("push", (event) => {
    let payload = { title: "💊 영양제를 복용하세요", body: "지금 복용할 시간이에요." };
    try {
        if (event.data) payload = event.data.json();
    } catch (e) {
        // JSON이 아니면 기본 문구 사용
    }
    event.waitUntil(
        self.registration.showNotification(payload.title, {
            body: payload.body,
            icon: payload.icon || "images/app-icon.png",
            image: payload.image,
            badge: "images/app-icon.png",
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: "window" }).then((clientsArr) => {
            if (clientsArr.length > 0) return clientsArr[0].focus();
            return self.clients.openWindow("/index.html");
        })
    );
});
