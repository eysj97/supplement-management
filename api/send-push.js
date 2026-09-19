// QStash가 예약된 시각(11시/14시/새벽2시)에 이 엔드포인트를 호출하면, 저장해둔 구독
// 정보로 실제 푸시 알림을 보냄. 앱이 완전히 꺼져 있어도(브라우저를 안 열어도) 동작함.
// groupIndex에 맞는 마스코트 이미지를 랜덤으로 골라 함께 보냄(header.js의
// WAITING_IMAGE_GROUPS와 같은 그룹 구성).
const webpush = require("web-push");
const { redisGet } = require("./_lib");

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

const WAITING_IMAGE_GROUPS = [
    ["logo-waiting1.png", "logo-waiting2.png", "logo-waiting3.png"],
    ["logo-waiting4.png", "logo-waiting5.png", "logo-waiting6.png"],
    ["logo-waiting7.png", "logo-waiting8.png", "logo-waiting9.png"],
];

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "POST만 지원해요." });
        return;
    }

    try {
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            res.status(500).json({ error: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY 환경변수가 설정되지 않았어요." });
            return;
        }

        const { userId, groupIndex } = req.body || {};
        if (!userId) {
            res.status(400).json({ error: "userId가 필요해요." });
            return;
        }

        const subscription = await redisGet(`sub:${userId}`);
        if (!subscription) {
            // 구독이 없거나 만료됨 - QStash 스케줄은 그대로 두되 조용히 무시
            res.status(200).json({ ok: true, skipped: "no-subscription" });
            return;
        }

        const origin = `https://${req.headers.host}`;

        const group = WAITING_IMAGE_GROUPS[groupIndex] || WAITING_IMAGE_GROUPS[0];
        const file = group[Math.floor(Math.random() * group.length)];
        const payload = {
            title: "영양제를 복용하세요",
            body: "지금 복용할 시간이에요.",
            icon: `${origin}/images/${file}`,
            image: `${origin}/images/${file}`,
        };

        webpush.setVapidDetails("mailto:geongangja@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
        await webpush.sendNotification(subscription, JSON.stringify(payload));

        res.status(200).json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: String(err && err.message ? err.message : err) });
    }
};
