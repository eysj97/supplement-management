// 브라우저에서 잠금화면 알림을 허용하면, 정해진 시각들(7시 30분/13시/20시)에 매일
// 반복되는 QStash 예약을 만들어 둠. 다시 호출하면 기존 예약을 지우고 새로 만듦(덮어쓰기).
// 이 앱은 한국 사용자 전용이라 한국시간(KST, UTC+9 고정)만 다룸.
const { redisGet, redisSet, qstashRequest } = require("./_lib");

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "POST만 지원해요." });
        return;
    }

    try {
        const { userId, times } = req.body || {};
        if (!userId || !Array.isArray(times) || times.length === 0) {
            res.status(400).json({ error: "userId와 times 배열이 필요해요." });
            return;
        }

        // x-forwarded-proto가 프록시 체인에 따라 "https, http"처럼 콤마로 여러 값이
        // 붙어 오는 경우가 있어 QStash가 "invalid scheme"으로 거부했음. 이 앱은 항상
        // https로만 서비스되므로 헤더에 의존하지 않고 고정값을 씀
        const destination = `https://${req.headers.host}/api/send-push`;

        const scheduleIds = [];
        for (let i = 0; i < times.length; i++) {
            const { hour, minute, groupIndex } = times[i];
            if (hour == null || minute == null) continue;

            const scheduleKey = `schedule:${userId}:general:${i}`;
            const existingScheduleId = await redisGet(scheduleKey);
            if (existingScheduleId) {
                await qstashRequest(`/v2/schedules/${existingScheduleId}`, { method: "DELETE" }).catch(() => {});
            }

            const hourUtc = (Number(hour) - 9 + 24) % 24;
            const cron = `${Number(minute)} ${hourUtc} * * *`;

            // QStash는 destination을 퍼센트 인코딩 없이 경로에 그대로 붙이길 기대함
            // (encodeURIComponent를 쓰면 "invalid scheme" 오류로 거부됨)
            const result = await qstashRequest(`/v2/schedules/${destination}`, {
                method: "POST",
                headers: { "Upstash-Cron": cron },
                body: JSON.stringify({ userId, groupIndex }),
            });

            await redisSet(scheduleKey, result.scheduleId);
            scheduleIds.push(result.scheduleId);
        }

        res.status(200).json({ ok: true, scheduleIds });
    } catch (err) {
        res.status(500).json({ error: String(err && err.message ? err.message : err) });
    }
};
