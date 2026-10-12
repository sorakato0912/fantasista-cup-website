// トップページの構造化データ（JSON-LD）のうち「これから開催する大会」を、管理画面で登録した大会データで置き換える。
// 管理画面で大会を作成・変更すれば、検索エンジン向けの情報（日時・会場・参加費・募集状況）も自動で追従する。
// index.html に直接書いてあるJSON-LDは、過去大会の記録と、取得に失敗したときの控えとして残している。
(function () {
    var SUPABASE_URL = "https://hpxirfvkcspwrktjlraz.supabase.co";
    // 公開用のanonキー（index.htmlのENTRYセクションと同じもの）
    var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhweGlyZnZrY3Nwd3JrdGpscmF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NzkxNjksImV4cCI6MjEwMjU1NTE2OX0.d_nA76uzMrrlTcVr9ZeiERHb8MNf7tij6rHRuuOVn7M";
    var AVAILABILITY = { "募集中": "InStock", "キャンセル待ち": "SoldOut", "募集前": "PreOrder" };

    var script = document.querySelector('script[type="application/ld+json"]');
    if (!script) return;
    var ld;
    try { ld = JSON.parse(script.textContent); } catch (err) { return; }
    if (!Array.isArray(ld.subEvent)) return;

    // 日本時間の今日（YYYY-MM-DD）
    var today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

    function toEvent(t) {
        // 「〒639-2101　奈良県葛城市…」→ 都道府県とそれ以降に分ける
        var address = (t.venue_address || "").replace(/〒\s*\d{3}-?\d{4}/, "").replace(/[\s　]+/g, "");
        var region = (address.match(/^(東京都|北海道|(?:京都|大阪)府|.{2,3}県)/) || [])[1] || "";
        var event = {
            "@type": "SportsEvent",
            "name": t.name,
            "sport": t.sport_category || "サッカー",
            "startDate": t.event_date + "T" + (t.event_start_time || "00:00:00") + "+09:00",
            "eventStatus": "https://schema.org/EventScheduled",
            "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
            "location": {
                "@type": "Place",
                "name": t.venue,
                "address": {
                    "@type": "PostalAddress",
                    "addressRegion": region,
                    "streetAddress": address.slice(region.length),
                    "addressCountry": "JP"
                }
            },
            "organizer": ld.organizer
        };
        if (t.event_end_time) event.endDate = t.event_date + "T" + t.event_end_time + "+09:00";
        var price = t.entry_fee_max || t.entry_fee_min;
        if (price) {
            event.offers = { "@type": "Offer", "price": price, "priceCurrency": "JPY", "url": "https://entry.fantasista-cup.com/home" };
            if (AVAILABILITY[t.status]) event.offers.availability = "https://schema.org/" + AVAILABILITY[t.status];
        }
        return event;
    }

    fetch(
        SUPABASE_URL + "/rest/v1/tournaments?select=name,event_date,event_start_time,event_end_time,venue,venue_address,entry_fee_min,entry_fee_max,status,sport_category&event_date=gte." + today + "&order=event_date.asc",
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY } }
    )
        .then(function (res) { return res.ok ? res.json() : Promise.reject(new Error("failed to fetch tournaments")); })
        .then(function (tournaments) {
            var past = ld.subEvent.filter(function (e) { return (e.startDate || "").slice(0, 10) < today; });
            ld.subEvent = past.concat(tournaments.filter(function (t) { return t.event_date && t.venue; }).map(toEvent));
            script.textContent = JSON.stringify(ld);
        })
        .catch(function () { /* 取得できないときは index.html に書いてある内容のまま */ });
})();
