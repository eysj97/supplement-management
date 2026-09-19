// 설정에서 알림을 끄면 호출됨: 예약해둔 QStash 스케줄을 모두 지우고
// 구독 정보도 삭제해서, 혹시 스케줄이 남아있어도 더 이상 알림이 가지 않게 함.
const { redisGet, redisDel, qstashRequest } = require("./_lib");

const GENERAL_REMINDER_SLOTS = 3; // 7시 30분/13시/20시

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "POST만 지원해요." });
        return;
    }

    try {
        const { userId } = req.body || {};
        if (!userId) {
            res.status(400).json({ error: "userId가 필요해요." });
            return;
        }

        for (let i = 0; i < GENERAL_REMINDER_SLOTS; i++) {
            const scheduleKey = `schedule:${userId}:general:${i}`;
            const existingScheduleId = await redisGet(scheduleKey);
            if (existingScheduleId) {
                await qstashRequest(`/v2/schedules/${existingScheduleId}`, { method: "DELETE" }).catch(() => {});
                await redisDel(scheduleKey);
            }
        }

        await redisDel(`sub:${userId}`);

        res.status(200).json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: String(err && err.message ? err.message : err) });
    }
};
