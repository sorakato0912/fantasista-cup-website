// 👑 募集中の大会一覧（Supabaseから直接取得）
// トップページ（DISCIPLINESの競技別カード・右下の「次の大会」カード）と
// 大会一覧ページ（tournaments.html の絞り込み＋全大会カード）で共用する。
// 各処理は対象の要素がないページでは何もしない。
(function () {
    const SUPABASE_URL = "https://hpxirfvkcspwrktjlraz.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhweGlyZnZrY3Nwd3JrdGpscmF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5NzkxNjksImV4cCI6MjEwMjU1NTE2OX0.d_nA76uzMrrlTcVr9ZeiERHb8MNf7tij6rHRuuOVn7M";
    const ENTRY_APP_BASE = "https://entry.fantasista-cup.com";

    async function fetchOpenTournaments() {
        const res = await fetch(
            SUPABASE_URL + "/rest/v1/tournaments?select=*&status=eq." + encodeURIComponent("募集中") + "&order=event_date.asc.nullslast,event_start_time.asc.nullslast",
            { headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY } }
        );
        if (!res.ok) throw new Error("failed to fetch tournaments");
        return res.json();
    }

    // 大会一覧の検索・絞り込み条件を読み取る
    function getEntryFilters() {
        const byId = (id) => document.getElementById(id);
        return {
            keyword: ((byId("entryFilterKeyword") || {}).value || "").trim().toLowerCase(),
            type: (byId("entryFilterType") || {}).value || "",
            sport: (byId("entryFilterSport") || {}).value || "",
            dateFrom: (byId("entryFilterDateFrom") || {}).value || "",
            dateTo: (byId("entryFilterDateTo") || {}).value || ""
        };
    }

    // 参加方法：「大会」はチームで申し込める大会、「個人参加」は個人で申し込める大会
    function matchesEntryType(tournament, type) {
        const mode = tournament.entry_mode || "team";
        if (type === "team") return mode !== "individual";
        if (type === "individual") return mode === "individual" || mode === "team_and_individual";
        return true;
    }

    // 指定した1軸（skip）以外の条件だけで一致するかを判定する
    // （他の絞り込み条件のもとで、そのプルダウンの各選択肢が該当0件になるかを調べるために使う）
    function matchesEntryFiltersExcept(tournament, f, skip) {
        if (skip !== "type" && f.type && !matchesEntryType(tournament, f.type)) return false;
        if (skip !== "sport" && f.sport && tournament.sport_category !== f.sport) return false;
        if (skip !== "keyword" && f.keyword) {
            const haystack = ((tournament.name || "") + " " + (tournament.venue || "")).toLowerCase();
            if (haystack.indexOf(f.keyword) === -1) return false;
        }
        if (skip !== "date" && (f.dateFrom || f.dateTo)) {
            if (!tournament.event_date) return false;
            if (f.dateFrom && tournament.event_date < f.dateFrom) return false;
            if (f.dateTo && tournament.event_date > f.dateTo) return false;
        }
        return true;
    }

    function applyEntryFilters(list) {
        const f = getEntryFilters();
        return list.filter(({ tournament }) => matchesEntryFiltersExcept(tournament, f, null));
    }

    // 絞り込みボタンに、条件が設定されている数をバッジ表示する
    function updateEntryFilterCount() {
        const f = getEntryFilters();
        const count = [f.keyword, f.type, f.sport, (f.dateFrom || f.dateTo)].filter(Boolean).length;
        const badge = document.getElementById("entryFilterCount");
        if (!badge) return;
        if (count > 0) {
            badge.textContent = String(count);
            badge.style.display = "inline-flex";
        } else {
            badge.style.display = "none";
        }
    }

    // 他の条件のもとで該当0件になるプルダウンの選択肢を選択不可にする
    function updateEntryFilterOptionAvailability() {
        if (cachedTournaments === null) return;
        const f = getEntryFilters();

        const typeSelect = document.getElementById("entryFilterType");
        if (typeSelect) {
            [].slice.call(typeSelect.options).forEach(function (opt) {
                if (!opt.value) return; // 「すべて」は常に選択可
                opt.disabled = !cachedTournaments.some(function (item) {
                    return matchesEntryFiltersExcept(item.tournament, f, "type") && matchesEntryType(item.tournament, opt.value);
                });
            });
        }

        const sportSelect = document.getElementById("entryFilterSport");
        if (sportSelect) {
            const availableSports = {};
            cachedTournaments.forEach(function (item) {
                if (matchesEntryFiltersExcept(item.tournament, f, "sport")) {
                    availableSports[item.tournament.sport_category] = true;
                }
            });
            [].slice.call(sportSelect.options).forEach(function (opt) {
                if (!opt.value) return; // 「すべてのスポーツ」は常に選択可
                opt.disabled = !availableSports[opt.value];
            });
        }
    }

    // 絞り込みのプルダウンを、見た目を自由に作れるボタン＋選択肢パネルに置き換える。
    // 元の<select>は隠して残し、選ばれたら値を書き込んで input イベントを出すので、
    // 絞り込み処理（getEntryFilters など）はそのまま<select>の値を読めばよい。
    // 選択肢の「選択不可（該当0件）」は開くたびに<select>から読み直す。
    function enhanceEntrySelect(select) {
        const wrap = document.createElement("div");
        wrap.className = "fc-select";
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "fc-select-trigger";
        trigger.setAttribute("aria-haspopup", "listbox");
        trigger.setAttribute("aria-expanded", "false");
        const label = document.querySelector('label[for="' + select.id + '"]');
        if (label) {
            label.id = select.id + "Label";
            trigger.setAttribute("aria-labelledby", label.id + " " + select.id + "Value");
            label.addEventListener("click", function (e) { e.preventDefault(); trigger.focus(); });
        }
        const valueText = document.createElement("span");
        valueText.id = select.id + "Value";
        trigger.appendChild(valueText);
        const panel = document.createElement("ul");
        panel.className = "fc-select-panel";
        panel.setAttribute("role", "listbox");

        select.parentNode.insertBefore(wrap, select);
        wrap.appendChild(select);
        wrap.appendChild(trigger);
        wrap.appendChild(panel);
        select.classList.add("fc-select-native");
        select.tabIndex = -1;
        select.setAttribute("aria-hidden", "true");

        function syncLabel() {
            const opt = select.options[select.selectedIndex];
            valueText.textContent = opt ? opt.textContent : "";
        }

        function close(focusTrigger) {
            wrap.classList.remove("is-open");
            trigger.setAttribute("aria-expanded", "false");
            if (focusTrigger) trigger.focus();
        }

        function open() {
            panel.innerHTML = "";
            [].slice.call(select.options).forEach(function (opt) {
                const li = document.createElement("li");
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "fc-select-option";
                btn.setAttribute("role", "option");
                btn.setAttribute("aria-selected", opt.value === select.value ? "true" : "false");
                btn.textContent = opt.textContent;
                btn.disabled = opt.disabled;
                btn.addEventListener("click", function () {
                    select.value = opt.value;
                    select.dispatchEvent(new Event("input", { bubbles: true }));
                    select.dispatchEvent(new Event("change", { bubbles: true }));
                    syncLabel();
                    close(true);
                });
                li.appendChild(btn);
                panel.appendChild(li);
            });
            wrap.classList.add("is-open");
            trigger.setAttribute("aria-expanded", "true");
            const current = panel.querySelector('[aria-selected="true"]') || panel.querySelector("button:not(:disabled)");
            if (current) current.focus();
        }

        trigger.addEventListener("click", function () {
            if (wrap.classList.contains("is-open")) close(false); else open();
        });
        wrap.addEventListener("keydown", function (e) {
            if (e.key === "Escape" && wrap.classList.contains("is-open")) {
                e.preventDefault();
                close(true);
                return;
            }
            if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
            e.preventDefault();
            if (!wrap.classList.contains("is-open")) { open(); return; }
            const items = [].slice.call(panel.querySelectorAll("button:not(:disabled)"));
            const i = items.indexOf(document.activeElement);
            const next = items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length];
            if (next) next.focus();
        });
        document.addEventListener("click", function (e) {
            if (!wrap.contains(e.target)) close(false);
        });
        select.addEventListener("change", syncLabel);
        syncLabel();
    }

    function setupEntryFilters() {
        const bar = document.getElementById("entryFilterBar");
        const toggle = document.getElementById("entryFilterToggle");
        const closeBtn = document.getElementById("entryFilterClose");
        if (!bar || !toggle || !closeBtn) return;

        ["entryFilterType", "entryFilterSport"].forEach(function (id) {
            const el = document.getElementById(id);
            if (el) enhanceEntrySelect(el);
        });

        ["entryFilterKeyword", "entryFilterType", "entryFilterSport", "entryFilterDateFrom", "entryFilterDateTo"].forEach(function (id) {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener("input", function () {
                updateEntryFilterCount();
                updateEntryFilterOptionAvailability();
                renderEntryList();
            });
        });

        toggle.addEventListener("click", function () {
            bar.classList.add("is-open");
            document.body.classList.add("is-entry-filter-open");
        });
        closeBtn.addEventListener("click", function () {
            bar.classList.remove("is-open");
            document.body.classList.remove("is-entry-filter-open");
        });
    }

    async function fetchRemaining(tournamentId) {
        const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/tournament_remaining_slots", {
            method: "POST",
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: "Bearer " + SUPABASE_ANON_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ p_tournament_id: tournamentId })
        });
        if (!res.ok) return null;
        return res.json();
    }

    // 個人参加を受け付けている大会の集計（定員・確定人数・残り人数。個人情報は含まない）
    async function fetchIndividualSummary(tournamentId) {
        const res = await fetch(SUPABASE_URL + "/rest/v1/rpc/tournament_individual_summary", {
            method: "POST",
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: "Bearer " + SUPABASE_ANON_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ p_tournament_id: tournamentId })
        });
        if (!res.ok) return null;
        const rows = await res.json();
        return rows && rows[0] ? rows[0] : null;
    }

    // チームとして申し込める枠数（チーム＋個人の大会は1枠を個人参加チーム用に確保。不成立なら戻す）
    function teamCapacityOf(tournament) {
        if (tournament.entry_mode === "individual") return 0;
        if (tournament.entry_mode === "team_and_individual" && tournament.individual_status !== "不成立") {
            return Math.max(tournament.capacity - 1, 0);
        }
        return tournament.capacity;
    }

    // 現在の言語辞書から文言を取得（日本語の場合はfcDictがnullなのでfallbackを使う）
    function t(key, fallback) {
        return (window.fcDict && window.fcDict[key]) || fallback;
    }

    // 「5/23 17:00-21:00」のような表示形式。開始・終了時刻が未設定の場合は日付のみ表示する
    function formatDateTime(dateStr, startTime, endTime) {
        if (!dateStr) return t("entry.dateTBD", "開催日未定");
        const parts = dateStr.split("-");
        const md = parseInt(parts[1], 10) + "/" + parseInt(parts[2], 10);
        if (startTime && endTime) {
            return md + " " + startTime.slice(0, 5) + "-" + endTime.slice(0, 5);
        }
        return md;
    }

    // エントリーサイト（/home）の大会カードと同じ形式：カード全体が申込ページへのリンク、
    // 左に競技・日時／大会名／会場、右に残り枠。参加費は表示しない（コンパクトさ優先）
    function renderCard(tournament, remaining, individual) {
        const acceptsTeams = tournament.entry_mode !== "individual";
        const individualOpen = individual && individual.individual_status !== "不成立";
        const isFull = acceptsTeams
            ? remaining !== null && remaining <= 0
            : !individualOpen || individual.remaining <= 0;
        const teamHtml = !acceptsTeams || remaining === null
            ? ""
            : '<span class="num' + (remaining <= 0 ? " full" : "") + '">' + t("entry.remainingPrefix", "残り") + ' ' + remaining + '</span><span class="unit">/ ' + teamCapacityOf(tournament) + ' ' + t("entry.teamsUnit", "チーム") + '</span>';
        // 個人参加の残りは、チームと同じく「残り ○ / ○ 人」の形で表示する（単位は必ず人）
        const individualHtml = !individualOpen
            ? ""
            : (teamHtml ? '<span class="unit-sep"></span>' : "") +
              '<span class="num' + (individual.remaining <= 0 ? " full" : "") + '">' + t("entry.remainingPrefix", "残り") + ' ' + individual.remaining + '</span>' +
              '<span class="unit">/ ' + (individual.individual_capacity || 0) + ' ' + t("entry.peopleUnit", "人") + '</span>';
        const remainingHtml = teamHtml || individualHtml
            ? '<div class="entry-card-remaining">' + teamHtml + individualHtml + '</div>'
            : "";

        const wrap = document.createElement("a");
        wrap.className = "entry-card";
        wrap.href = ENTRY_APP_BASE + "/apply/" + tournament.id;
        wrap.target = "_blank";
        wrap.rel = "noopener noreferrer";
        wrap.innerHTML =
            '<div class="entry-card-info">' +
                '<p class="entry-card-date"><span class="entry-card-sport"></span>' +
                (tournament.entry_mode && tournament.entry_mode !== "team" ? '<span class="entry-card-individual">' + t("entry.individualLabel", "個人参加") + '</span>' : "") +
                '<span class="entry-card-datetext"></span></p>' +
                '<h3 class="entry-card-title"></h3>' +
                '<p class="entry-card-venue"></p>' +
            '</div>' +
            remainingHtml;

        // 大会名・会場名はユーザー入力値のため、XSS対策としてtextContentで安全に挿入する
        const sportEl = wrap.querySelector(".entry-card-sport");
        if (tournament.sport_category) sportEl.textContent = tournament.sport_category;
        else sportEl.remove();
        wrap.querySelector(".entry-card-datetext").textContent = formatDateTime(tournament.event_date, tournament.event_start_time, tournament.event_end_time);
        wrap.querySelector(".entry-card-title").textContent = tournament.name;
        wrap.querySelector(".entry-card-venue").textContent = tournament.venue || t("entry.venueTBD", "会場未定");
        wrap.setAttribute("aria-label", tournament.name + "（" + (isFull ? t("entry.waitlistBtn", "キャンセル待ちに申し込む") : t("entry.applyBtn", "この大会に申し込む")) + "）");

        return wrap;
    }

    // 取得済みの大会データをキャッシュしておき、言語切り替え時は再取得せず再描画するだけにする
    let cachedTournaments = null;

    function renderEntryList() {
        const listEl = document.getElementById("entryTournamentList");
        if (!listEl || cachedTournaments === null) return;
        if (cachedTournaments.length === 0) {
            listEl.innerHTML = '<p style="text-align:center; color:var(--text-faint);">' + t("entry.empty", "現在募集中の大会はありません。") + '</p>';
            return;
        }
        const filtered = applyEntryFilters(cachedTournaments);
        if (filtered.length === 0) {
            listEl.innerHTML = '<p style="text-align:center; color:var(--text-faint);">条件に一致する大会が見つかりませんでした。</p>';
            return;
        }
        listEl.innerHTML = "";
        // 募集中の大会をすべて、開催日の近い順に
        filtered.forEach(({ tournament, remaining, individual }) => {
            listEl.appendChild(renderCard(tournament, remaining, individual));
        });
    }

    // 右下のカードに出す「次の大会」：開催日が近い順に見て、まだ枠が残っている最初の大会
    function showNextTournament() {
        if (typeof window.fcShowNextTournament !== "function" || !cachedTournaments.length) return;
        const remainingText = function (item) {
            const tour = item.tournament;
            if (tour.entry_mode !== "individual" && item.remaining !== null) {
                return { left: item.remaining, text: t("entry.remainingPrefix", "残り") + " " + Math.max(item.remaining, 0) + " / " + teamCapacityOf(tour) + " " + t("entry.teamsUnit", "チーム") };
            }
            if (item.individual && item.individual.individual_status !== "不成立") {
                return { left: item.individual.remaining, text: t("entry.remainingPrefix", "残り") + " " + Math.max(item.individual.remaining, 0) + " / " + (item.individual.individual_capacity || 0) + " " + t("entry.peopleUnit", "人") };
            }
            return { left: 0, text: "" };
        };
        const item = cachedTournaments.find(function (i) { return remainingText(i).left > 0; }) || cachedTournaments[0];
        const tour = item.tournament;
        window.fcShowNextTournament({
            meta: [tour.sport_category, formatDateTime(tour.event_date, tour.event_start_time, tour.event_end_time)].filter(Boolean).join("・"),
            title: tour.name,
            remaining: remainingText(item).text
        });
    }

    async function loadEntryTournaments() {
        // 一覧がないトップページでも、競技別カードと「次の大会」カードのために取得する
        const listEl = document.getElementById("entryTournamentList");
        try {
            const tournaments = await fetchOpenTournaments();
            const results = [];
            for (const tournament of tournaments) {
                const [remaining, individual] = await Promise.all([
                    fetchRemaining(tournament.id),
                    tournament.entry_mode && tournament.entry_mode !== "team"
                        ? fetchIndividualSummary(tournament.id)
                        : Promise.resolve(null)
                ]);
                results.push({ tournament, remaining, individual });
            }
            cachedTournaments = results;
            updateEntryFilterOptionAvailability();
            renderEntryList();
            showNextTournament();
            if (typeof window.refreshSportTabPanels === "function") window.refreshSportTabPanels();
        } catch (err) {
            // 取得に失敗しても、下にある「エントリーサイトを開く」ボタンは常に表示されているため、
            // ここでは読み込み中表示を静かに消すだけに留める
            cachedTournaments = [];
            if (listEl) listEl.innerHTML = "";
            if (typeof window.refreshSportTabPanels === "function") window.refreshSportTabPanels();
        }
    }

    // ==========================================================================
    // 👑 競技別（SOCCER/FUTSAL/SOCIETY/PK）カルーセル
    // タブの定義は下のSPORT_TABS配列で一元管理しており、将来の競技追加時は
    // この配列に1件追加するだけで済む（HTML側は空のコンテナのみで、中身は
    // すべてこの配列からJSで組み立てる）。
    // 大会カード自体はENTRY一覧と同じ cachedTournaments / renderCard() を
    // そのまま再利用し、検索・絞り込みUIは表示せずスポーツ種別だけで固定絞り込みする。
    // ==========================================================================
    // PK大会のRULEカテゴリ（カテゴリ名・項目・順序は指定文言のまま）。
    // 他競技のルールが確定した際も、同じ形の配列をtabに追加するだけで済む。
    // SOCCERタブのARCHIVE（旧ARCHIVEセクションのVol.1／Vol.2をそのまま移設）。
    // status: "completed" は優勝チーム・景品・写真を、"failed" は中止メッセージを表示する。
    var SOCCER_ARCHIVE_VOLUMES = [
        {
            vol: "Vol.1",
            status: "completed",
            championName: "El Mago City",
            awardsText: "3種から選べる「大和牛1.2kgセット」",
            photoSrc: "Vol.1優勝チーム.jpg",
            photoAlt: "Vol.1 優勝チーム El Mago City"
        },
        {
            vol: "Vol.2",
            status: "failed",
            failedMessage: "大会は中止・開催見送りとなりました。"
        }
    ];

    var PK_RULE_CATEGORIES = [
        {
            title: "エントリー・登録について",
            items: [
                "登録は1チーム5名となります。途中のメンバー変更はできません。",
                "競技中、審判よりメンバーの確認をさせていただく場合がございますので、メンバーの方は身分証明書（顔写真付き）を持参してください。",
                "同一の方が2チーム以上に参加することは禁止とさせていただきます。",
                "6名以上でエントリー頂いたチームも、試合ごとに5名を選出していただきます。サドンデスに突入した場合でも、選出した5名でその試合は続けていただきます。ゴールキーパーは必ず5名の中に含めていただきます。"
            ]
        },
        {
            title: "トーナメント・シードについて",
            items: [
                "参加チーム数によってトーナメントにシード枠を設けます。シード枠は申し込みが早い順に決定いたします。"
            ]
        },
        {
            title: "使用用具",
            items: [
                "少年用サッカーゴールを使用します。",
                "ボールは5号球を使用します。"
            ]
        },
        {
            title: "キック・判定ルール",
            items: [
                "本大会のPK戦は1本目からサドンデス方式で実施します。",
                "ゴールキーパーもキッカーを務めます。",
                "審判の合図から10秒以内にボールを蹴らなければPK失敗とします。",
                "ペナルティマーク上で静止していないボールを蹴った場合、PK失敗とします。",
                "キッカーは特定されなければなりません。",
                "キッカーはボールに2回以上触れた場合、失敗となります。",
                "延長戦（サドンデス継続）になった場合も、同じ順番で蹴らなければなりません。"
            ]
        },
        {
            title: "ゴールキーパーの反則",
            items: [
                "ゴールキーパーはキッカーが蹴るまで、どちらか片足がゴールラインを踏んでいなければ反則となります。",
                "ゴールキーパーに反則があった場合、またはゴールに入らなかった場合は、キッカーの蹴り直しとなります。"
            ]
        },
        {
            title: "出場人数について",
            items: [
                "試合予定時刻が早まるなど時間が変更となった場合でも、その時点で3名以上のメンバーが揃っていないと失格となります。",
                "1チーム3人以上いれば出場可能ですが、3人の場合は0-2、4人の場合は0-1の、負けている状態からのスタートとなります。"
            ]
        },
        {
            title: "試合終了について",
            items: [
                "勝敗が決まった時点で試合終了となります。",
                "ただし1回戦目に限り、勝敗が決していても5名全員が蹴り終えるまで続行します。"
            ]
        }
    ];

    // SOCCERタブのRULE
    var SOCCER_RULE_CATEGORIES = [
        {
            title: "競技ルール",
            items: [
                "本大会は基本的に公式サッカールール（日本サッカー協会の競技規則）を適用します。",
                "交代枠は1試合につき5人までとします。",
                "大会独自のルールとして、通常の試合よりファウルの基準を厳しく適用します。",
                "大会中にレッドカードが提示された選手は、当該大会での以降の出場を禁止します。",
                "試合時間は参加チーム数により変動する場合があります。",
                "規定時間内に決着がつかない場合は、PK戦にて勝敗を決定します。"
            ]
        },
        {
            title: "勝ち点システム",
            items: [
                "規定時間での勝利：3点",
                "PK戦での勝利：2点",
                "PK戦での敗戦：1点",
                "規定時間での敗戦：0点"
            ]
        }
    ];

    // FUTSALタブのRULE
    var FUTSAL_RULE_CATEGORIES = [
        {
            title: "競技ルール",
            items: [
                "5人制（フットサルルールに準ずる）",
                "4秒ルール：適用あり",
                "バックパスルール：適用あり",
                "ボール保持者へのスライディングは禁止",
                "レガース着用は任意"
            ]
        }
    ];

    var SPORT_TABS = [
        { id: "soccer", label: "SOCCER", type: "entry-list", sportCategory: "サッカー", archive: SOCCER_ARCHIVE_VOLUMES, ruleCategories: SOCCER_RULE_CATEGORIES },
        { id: "futsal", label: "FUTSAL", type: "entry-list", sportCategory: "フットサル", ruleCategories: FUTSAL_RULE_CATEGORIES },
        { id: "society", label: "SOCIETY", type: "coming-soon" },
        { id: "pk", label: "PK", type: "entry-list", sportCategory: "PK大会", ruleCategories: PK_RULE_CATEGORIES }
    ];

    var SPORT_TAB_AUTO_MS = 4000;   // 各タブの自動停止時間
    var SPORT_TAB_RESUME_MS = 6000; // 手動操作後、自動再生を再開するまでの待機時間

    function renderSportPanelList(tabId, sportCategory) {
        const listEl = document.getElementById("sportPanelList-" + tabId);
        if (!listEl || cachedTournaments === null) return;
        const filtered = cachedTournaments.filter(function (item) {
            return item.tournament.sport_category === sportCategory;
        });
        if (filtered.length === 0) {
            listEl.innerHTML = '<p class="sport-panel-empty">' + t("entry.empty", "現在募集中の大会はありません。") + '</p>';
            return;
        }
        listEl.innerHTML = "";
        filtered.forEach(function (item) {
            listEl.appendChild(renderCard(item.tournament, item.remaining, item.individual));
        });
    }

    // ARCHIVEの1大会分（Vol.）のアコーディオン項目を組み立てる。
    // 既存の.accordion-item/.accordion-header等のクラス名をそのまま使うことで、
    // 開閉挙動（setupAccordions）や基本レイアウトCSSをそのまま再利用している。
    function buildArchiveAccordionItem(vol) {
        const item = document.createElement("div");
        item.className = "accordion-item";

        const header = document.createElement("div");
        header.className = "accordion-header";
        header.innerHTML =
            '<span class="vol-title">' + vol.vol + '</span>' +
            '<span class="badge ' + vol.status + '">' + (vol.status === "completed" ? "Result" : "開催見送り") + '</span>';
        item.appendChild(header);

        const content = document.createElement("div");
        content.className = "accordion-content";
        const contentInner = document.createElement("div");
        contentInner.className = "accordion-content-inner sport-archive-content-inner";

        if (vol.status === "completed") {
            contentInner.innerHTML =
                '<div class="sport-archive-highlight">' +
                    '<h4 class="sport-archive-highlight-title">優勝</h4>' +
                    '<p class="sport-archive-champion-name">' + vol.championName + '</p>' +
                    '<h4 class="sport-archive-highlight-title">賞品</h4>' +
                    '<p class="sport-archive-awards-desc">' + vol.awardsText + '</p>' +
                '</div>' +
                '<p class="sport-archive-photo-label">集合写真</p>' +
                '<div class="sport-archive-photo-frame"><img src="' + vol.photoSrc + '" alt="' + vol.photoAlt + '" loading="lazy"></div>';
        } else {
            contentInner.innerHTML = '<p class="sport-archive-failed-msg">' + vol.failedMessage + '</p>';
        }

        content.appendChild(contentInner);
        item.appendChild(content);
        return item;
    }

    // ARCHIVEブロックを1つ組み立てる（RULEセクションの直上に配置）。
    // tab.archiveがあれば実データのアコーディオンを、なければ「Coming Soon…」を表示する。
    function buildArchiveSection(tab) {
        const archiveSection = document.createElement("div");
        archiveSection.className = "sport-archive-section";

        const archiveTitle = document.createElement("h3");
        archiveTitle.className = "sport-rule-title";
        archiveTitle.textContent = "ARCHIVE";
        archiveSection.appendChild(archiveTitle);

        if (tab.archive && tab.archive.length > 0) {
            const container = document.createElement("div");
            container.className = "accordion-container";
            tab.archive.forEach(function (vol) {
                container.appendChild(buildArchiveAccordionItem(vol));
            });
            archiveSection.appendChild(container);
        } else {
            const placeholder = document.createElement("p");
            placeholder.className = "sport-rule-placeholder";
            placeholder.textContent = "Coming Soon…";
            archiveSection.appendChild(placeholder);
        }

        return archiveSection;
    }

    function buildSportTabs() {
        const nav = document.getElementById("sportTabsNav");
        const panelsRoot = document.getElementById("sportPanels");
        const indicator = document.getElementById("sportTabIndicator");
        if (!nav || !panelsRoot || !indicator) return null;

        const buttons = [];
        const panels = [];

        SPORT_TABS.forEach(function (tab) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "sport-tab-btn";
            btn.textContent = tab.label;
            btn.id = "sportTabBtn-" + tab.id;
            btn.setAttribute("role", "tab");
            btn.setAttribute("aria-selected", "false");
            btn.setAttribute("aria-controls", "sportPanel-" + tab.id);
            nav.insertBefore(btn, indicator);
            buttons.push(btn);

            const panel = document.createElement("div");
            panel.className = "sport-panel";
            panel.id = "sportPanel-" + tab.id;
            panel.setAttribute("role", "tabpanel");
            panel.setAttribute("aria-labelledby", btn.id);

            const inner = document.createElement("div");
            inner.className = "sport-panel-inner";

            if (tab.type === "entry-list") {
                const list = document.createElement("div");
                list.className = "sport-panel-list";
                list.id = "sportPanelList-" + tab.id;
                list.innerHTML = '<p class="sport-panel-loading">' + t("entry.loadingText", "読み込み中...") + '</p>';
                inner.appendChild(list);
            } else {
                const comingSoon = document.createElement("p");
                comingSoon.className = "sport-coming-soon";
                comingSoon.textContent = "Coming Soon…";
                inner.appendChild(comingSoon);
            }

            inner.appendChild(buildArchiveSection(tab));

            const ruleSection = document.createElement("div");
            ruleSection.className = "sport-rule-section";

            const ruleTitle = document.createElement("h3");
            ruleTitle.className = "sport-rule-title";
            ruleTitle.textContent = "RULE";
            ruleSection.appendChild(ruleTitle);

            if (tab.ruleCategories && tab.ruleCategories.length > 0) {
                // TERMSセクションの「固定高さ＋内部スクロール」枠（.terms-container）と
                // 同じ仕組みを踏襲したスクロールボックス（配色のみダーク背景向けに調整）
                const scrollBox = document.createElement("div");
                scrollBox.className = "sport-rule-scroll";
                tab.ruleCategories.forEach(function (category) {
                    const categoryEl = document.createElement("div");
                    categoryEl.className = "sport-rule-category";

                    const categoryTitle = document.createElement("h4");
                    categoryTitle.className = "sport-rule-category-title";
                    categoryTitle.textContent = category.title;
                    categoryEl.appendChild(categoryTitle);

                    const list = document.createElement("ul");
                    list.className = "sport-rule-list";
                    category.items.forEach(function (itemText) {
                        const li = document.createElement("li");
                        const bullet = document.createElement("span");
                        bullet.className = "sport-rule-bullet";
                        bullet.textContent = "■";
                        bullet.setAttribute("aria-hidden", "true");
                        const text = document.createElement("span");
                        text.className = "sport-rule-item-text";
                        text.textContent = itemText;
                        li.appendChild(bullet);
                        li.appendChild(text);
                        list.appendChild(li);
                    });
                    categoryEl.appendChild(list);
                    scrollBox.appendChild(categoryEl);
                });
                ruleSection.appendChild(scrollBox);
            } else {
                const placeholder = document.createElement("p");
                placeholder.className = "sport-rule-placeholder";
                placeholder.textContent = "準備中です。大会ルールが決まり次第、こちらに掲載いたします。";
                ruleSection.appendChild(placeholder);
            }
            inner.appendChild(ruleSection);

            panel.appendChild(inner);
            panelsRoot.appendChild(panel);
            panels.push(panel);
        });

        return { buttons: buttons, panels: panels, indicator: indicator, panelsRoot: panelsRoot };
    }

    function setupSportCarousel() {
        const refs = buildSportTabs();
        if (!refs) return;
        const buttons = refs.buttons;
        const panels = refs.panels;
        const indicator = refs.indicator;
        const panelsRoot = refs.panelsRoot;
        if (typeof window.fcSetupAccordions === "function") window.fcSetupAccordions(panelsRoot);
        const sectionEl = document.getElementById("sport-tabs");
        const transitionOverlayEl = document.getElementById("sportTransitionOverlay");
        const reduceMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");

        let activeIndex = 0;
        let autoTimer = null;
        let resumeTimer = null;
        let inView = !("IntersectionObserver" in window); // ObserverがなければCSS的には常時表示扱い

        // タブ切り替え時に、画面全体にゴールドのオーバーレイ演出を一瞬走らせる
        function triggerTransitionOverlay() {
            if (!transitionOverlayEl || reduceMotionMQ.matches) return;
            transitionOverlayEl.classList.remove("is-active");
            void transitionOverlayEl.offsetWidth; // 強制リフローでアニメーションを毎回リトリガーする
            transitionOverlayEl.classList.add("is-active");
        }

        function moveIndicator() {
            const btn = buttons[activeIndex];
            if (!indicator || !btn) return;
            indicator.style.width = btn.offsetWidth + "px";
            indicator.style.transform = "translateX(" + btn.offsetLeft + "px)";
        }

        function updateHeight() {
            const active = panels[activeIndex];
            if (!active || !panelsRoot) return;
            panelsRoot.style.height = active.scrollHeight + "px";
        }

        function renderPanelIfNeeded(index) {
            const tab = SPORT_TABS[index];
            if (tab.type !== "entry-list") return;
            renderSportPanelList(tab.id, tab.sportCategory);
        }

        function goToIndex(targetIndexRaw) {
            const len = SPORT_TABS.length;
            const targetIndex = ((targetIndexRaw % len) + len) % len;
            if (targetIndex === activeIndex) return;

            const diff = (targetIndex - activeIndex + len) % len;
            const forward = diff <= len / 2;

            triggerTransitionOverlay();

            const outgoing = panels[activeIndex];
            const incoming = panels[targetIndex];

            outgoing.classList.remove("active");
            outgoing.classList.add(forward ? "leave-forward" : "leave-back");

            incoming.classList.remove("leave-forward", "leave-back", "enter-back");
            if (!forward) incoming.classList.add("enter-back");

            // 1フレーム後にactiveへ切り替え、CSSトランジションを確実に発火させる
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    incoming.classList.remove("enter-back");
                    incoming.classList.add("active");
                });
            });

            window.setTimeout(function () {
                outgoing.classList.remove("leave-forward", "leave-back");
            }, 600);

            buttons[activeIndex].classList.remove("active");
            buttons[activeIndex].setAttribute("aria-selected", "false");
            buttons[targetIndex].classList.add("active");
            buttons[targetIndex].setAttribute("aria-selected", "true");

            activeIndex = targetIndex;
            moveIndicator();
            renderPanelIfNeeded(activeIndex);
            requestAnimationFrame(updateHeight);
        }

        function maybeStartAutoplay() {
            if (autoTimer) return;
            if (reduceMotionMQ.matches) return;
            if (!inView || document.hidden) return;
            autoTimer = window.setInterval(function () {
                goToIndex(activeIndex + 1);
            }, SPORT_TAB_AUTO_MS);
        }

        function stopAutoplay() {
            if (autoTimer) {
                window.clearInterval(autoTimer);
                autoTimer = null;
            }
        }

        function registerManualInteraction() {
            stopAutoplay();
            if (resumeTimer) window.clearTimeout(resumeTimer);
            resumeTimer = window.setTimeout(maybeStartAutoplay, SPORT_TAB_RESUME_MS);
        }

        buttons.forEach(function (btn, i) {
            btn.addEventListener("click", function () {
                registerManualInteraction();
                goToIndex(i);
            });
        });

        // スワイプ操作（タッチ）
        let touchStartX = null;
        panelsRoot.addEventListener("touchstart", function (e) {
            touchStartX = e.touches[0].clientX;
        }, { passive: true });
        panelsRoot.addEventListener("touchend", function (e) {
            if (touchStartX === null) return;
            const dx = e.changedTouches[0].clientX - touchStartX;
            touchStartX = null;
            if (Math.abs(dx) < 40) return;
            registerManualInteraction();
            goToIndex(activeIndex + (dx < 0 ? 1 : -1));
        }, { passive: true });

        window.addEventListener("resize", function () {
            moveIndicator();
            updateHeight();
        });

        if ("IntersectionObserver" in window && sectionEl) {
            const io = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    inView = entry.isIntersecting;
                    if (inView) maybeStartAutoplay(); else stopAutoplay();
                });
            }, { threshold: 0.2 });
            io.observe(sectionEl);
        }

        document.addEventListener("visibilitychange", function () {
            if (document.hidden) stopAutoplay(); else maybeStartAutoplay();
        });

        // 初期表示（トランジションなしで即時表示）
        panels[0].classList.add("active");
        buttons[0].classList.add("active");
        buttons[0].setAttribute("aria-selected", "true");
        moveIndicator();
        renderPanelIfNeeded(0);
        requestAnimationFrame(updateHeight);
        maybeStartAutoplay();

        // データ取得完了・言語切り替え時に再描画できるよう公開
        window.refreshSportTabPanels = function () {
            SPORT_TABS.forEach(function (tab) {
                if (tab.type === "entry-list") renderSportPanelList(tab.id, tab.sportCategory);
            });
            requestAnimationFrame(updateHeight);
        };
    }

    // 言語切り替え時に再描画できるよう、グローバルに公開しておく
    window.refreshEntryTournamentList = function () {
        renderEntryList();
        if (typeof window.refreshSportTabPanels === "function") window.refreshSportTabPanels();
    };

    window.addEventListener("DOMContentLoaded", function () {
        setupEntryFilters();
        setupSportCarousel();
        loadEntryTournaments();
    });
})();
