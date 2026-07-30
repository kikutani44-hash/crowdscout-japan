export const metadata = {
  title: "クラウドジャービス — 使い方ガイド",
  description:
    "世界のクラウドファンディングから日本市場の独占権を持つ商品を見つけ出すAI搭載インテリジェンスツール",
};

export default function GuidePage() {
  return (
    <div
      style={{
        fontFamily: '"Helvetica Neue", "Hiragino Sans", "Yu Gothic UI", Arial, sans-serif',
        background: "#060D1A",
        color: "#D8E8FF",
        minHeight: "100vh",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060D1A; }

        .hero {
          position: relative;
          min-height: 90vh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
          padding: 80px 24px 60px;
          overflow: hidden;
          background: #060D1A;
        }
        .hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background-image: linear-gradient(#1B3356 1px, transparent 1px), linear-gradient(90deg, #1B3356 1px, transparent 1px);
          background-size: 48px 48px;
          opacity: 0.35;
          mask-image: radial-gradient(ellipse 70% 70% at 50% 40%, black 20%, transparent 80%);
          -webkit-mask-image: radial-gradient(ellipse 70% 70% at 50% 40%, black 20%, transparent 80%);
        }
        .hero::after {
          content: "";
          position: absolute;
          inset: 0;
          background: repeating-linear-gradient(0deg, rgba(45,140,240,0.03) 0px, rgba(45,140,240,0.03) 1px, transparent 1px, transparent 3px);
          animation: scan 8s linear infinite;
          pointer-events: none;
        }
        @keyframes scan { 0% { transform: translateY(0); } 100% { transform: translateY(3px); } }
        @media (prefers-reduced-motion: reduce) { .hero::after { animation: none; } }

        .hero-glow {
          position: absolute;
          top: 15%; left: 50%;
          transform: translateX(-50%);
          width: 520px; height: 320px;
          background: radial-gradient(ellipse, rgba(45,140,240,0.22) 0%, transparent 65%);
          pointer-events: none;
        }
        .hero-content { position: relative; z-index: 1; max-width: 680px; }
        .hero-eyebrow {
          font-family: "SF Mono", "Courier New", monospace;
          font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase;
          color: #2D8CF0; margin-bottom: 24px;
          display: inline-flex; align-items: center; gap: 10px;
        }
        .hero-eyebrow::before, .hero-eyebrow::after {
          content: ""; display: block; width: 32px; height: 1px; background: #2D8CF0; opacity: 0.6;
        }
        .hero-title {
          font-size: clamp(2.8rem, 8vw, 5rem);
          font-weight: 900; letter-spacing: -0.02em; line-height: 1;
          text-wrap: balance; margin-bottom: 8px;
        }
        .hero-title .crowd { color: #D8E8FF; }
        .hero-title .jarvis { color: #2D8CF0; text-shadow: 0 0 40px rgba(45,140,240,0.5); }
        .hero-subtitle {
          font-size: 13px; font-family: "SF Mono","Courier New",monospace;
          color: #5C7A9E; letter-spacing: 0.08em; margin-bottom: 28px;
        }
        .hero-tagline {
          font-size: clamp(1rem, 2.5vw, 1.25rem);
          color: #D8E8FF; line-height: 1.6; text-wrap: balance; opacity: 0.85; margin-bottom: 40px;
        }
        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          background: rgba(245,166,35,0.15); border: 1px solid rgba(245,166,35,0.35);
          border-radius: 6px; padding: 8px 16px; font-size: 13px; color: #F5A623; font-style: italic;
        }
        .scroll-cue {
          position: absolute; bottom: 32px; left: 50%; transform: translateX(-50%);
          color: #3A5878; font-size: 11px; font-family: "SF Mono",monospace;
          letter-spacing: 0.1em; text-transform: uppercase;
          animation: bounce 2s ease-in-out infinite;
        }
        @keyframes bounce {
          0%,100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(6px); }
        }
        @media (prefers-reduced-motion: reduce) { .scroll-cue { animation: none; } }

        /* TOC */
        .toc-bg { background: #0C1829; border-top: 1px solid #1B3356; border-bottom: 1px solid #1B3356; padding: 32px 24px; }
        .toc-inner { max-width: 860px; margin: 0 auto; }
        .toc-title { font-size: 11px; font-family: "SF Mono",monospace; letter-spacing: 0.15em; text-transform: uppercase; color: #5C7A9E; margin-bottom: 16px; }
        .toc-list { display: flex; flex-wrap: wrap; gap: 8px; }
        .toc-link { display: inline-flex; align-items: center; gap: 6px; padding: 6px 14px; border: 1px solid #1B3356; border-radius: 6px; font-size: 12px; color: #5C7A9E; text-decoration: none; background: #0F1F36; transition: border-color 0.15s, color 0.15s; }
        .toc-link:hover { border-color: #2D8CF0; color: #2D8CF0; }

        /* Sections */
        .section { padding: 72px 24px; max-width: 860px; margin: 0 auto; }
        .section-label {
          font-family: "SF Mono","Courier New",monospace; font-size: 10px; letter-spacing: 0.2em;
          text-transform: uppercase; color: #2D8CF0; margin-bottom: 12px;
          display: flex; align-items: center; gap: 10px;
        }
        .section-label::after { content: ""; flex: 1; height: 1px; background: #1B3356; }
        .section-title { font-size: clamp(1.5rem,4vw,2rem); font-weight: 800; letter-spacing: -0.02em; line-height: 1.2; text-wrap: balance; margin-bottom: 20px; }
        .section-body { color: #D8E8FF; opacity: 0.82; font-size: 15px; line-height: 1.8; }
        .section-body p + p { margin-top: 16px; }

        .story-bg { background: #0C1829; border-top: 1px solid #1B3356; border-bottom: 1px solid #1B3356; }
        .quote-block { margin-top: 32px; padding: 24px 28px; border-left: 3px solid #F5A623; background: rgba(245,166,35,0.15); border-radius: 0 8px 8px 0; font-size: 14px; color: #D8E8FF; line-height: 1.8; font-style: italic; opacity: 0.9; }

        .features-bg { background: #060D1A; padding: 72px 24px; }
        .features-inner { max-width: 860px; margin: 0 auto; }
        .feature-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px,1fr)); gap: 16px; margin-top: 40px; }
        .feature-card { background: #0F1F36; border: 1px solid #1B3356; border-radius: 12px; padding: 24px; transition: border-color 0.2s, box-shadow 0.2s; position: relative; overflow: hidden; }
        .feature-card:hover { border-color: #1A5CA8; box-shadow: 0 0 24px rgba(45,140,240,0.18); }
        .feature-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, #1A5CA8, transparent); opacity: 0; transition: opacity 0.2s; }
        .feature-card:hover::before { opacity: 1; }
        .feature-icon { font-size: 28px; margin-bottom: 14px; display: block; }
        .feature-name { font-size: 15px; font-weight: 700; margin-bottom: 8px; color: #D8E8FF; }
        .feature-desc { font-size: 13px; color: #5C7A9E; line-height: 1.7; }

        .flow-bg { background: #0C1829; border-top: 1px solid #1B3356; border-bottom: 1px solid #1B3356; }
        .flow-steps { display: flex; flex-direction: column; margin-top: 36px; position: relative; }
        .flow-steps::before { content: ""; position: absolute; left: 19px; top: 0; bottom: 0; width: 1px; background: linear-gradient(to bottom, #1A5CA8, transparent); }
        .flow-step { display: flex; gap: 20px; align-items: flex-start; padding-bottom: 32px; position: relative; }
        .flow-num { flex-shrink: 0; width: 38px; height: 38px; border-radius: 50%; background: #0F1F36; border: 1px solid #1A5CA8; display: flex; align-items: center; justify-content: center; font-family: "SF Mono",monospace; font-size: 12px; font-weight: 700; color: #2D8CF0; position: relative; z-index: 1; }
        .flow-text-title { font-weight: 700; font-size: 15px; margin-bottom: 4px; color: #D8E8FF; }
        .flow-text-body { font-size: 13px; color: #5C7A9E; line-height: 1.7; }

        .detail-bg { background: #060D1A; padding: 72px 24px; }
        .detail-inner { max-width: 860px; margin: 0 auto; }

        .howto-block { margin-top: 40px; display: flex; flex-direction: column; gap: 28px; }
        .howto-item { display: flex; gap: 20px; align-items: flex-start; }
        .howto-step-num { flex-shrink: 0; width: 28px; height: 28px; border-radius: 6px; background: rgba(45,140,240,0.18); border: 1px solid #1A5CA8; display: flex; align-items: center; justify-content: center; font-family: "SF Mono",monospace; font-size: 11px; font-weight: 700; color: #2D8CF0; }
        .howto-step-title { font-weight: 700; font-size: 14px; color: #D8E8FF; margin-bottom: 4px; }
        .howto-step-desc { font-size: 13px; color: #5C7A9E; line-height: 1.7; }

        .card-anatomy { margin-top: 36px; background: #0F1F36; border: 1px solid #1B3356; border-radius: 14px; overflow: hidden; }
        .card-anatomy-header { padding: 14px 20px; border-bottom: 1px solid #1B3356; font-family: "SF Mono",monospace; font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; color: #5C7A9E; }
        .anatomy-row { display: flex; align-items: flex-start; gap: 16px; padding: 14px 20px; border-bottom: 1px solid #1B3356; }
        .anatomy-row:last-child { border-bottom: none; }
        .anatomy-badge { flex-shrink: 0; background: #0C1829; border: 1px solid #1B3356; border-radius: 6px; padding: 3px 10px; font-size: 11px; font-weight: 700; color: #2D8CF0; font-family: "SF Mono",monospace; white-space: nowrap; }
        .anatomy-text { font-size: 13px; color: #5C7A9E; line-height: 1.6; }
        .anatomy-text strong { color: #D8E8FF; }

        .status-grid { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
        .status-pill { display: flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 8px; border: 1px solid; font-size: 13px; font-weight: 600; }
        .status-pill .dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .s-untouched { border-color: rgba(100,116,139,0.4); color: #94a3b8; } .s-untouched .dot { background: #94a3b8; }
        .s-watch { border-color: rgba(59,130,246,0.4); color: #60a5fa; } .s-watch .dot { background: #60a5fa; }
        .s-nego { border-color: rgba(245,158,11,0.4); color: #fbbf24; } .s-nego .dot { background: #fbbf24; }
        .s-got { border-color: rgba(52,211,153,0.4); color: #34d399; } .s-got .dot { background: #34d399; }
        .s-reject { border-color: rgba(239,68,68,0.4); color: #f87171; } .s-reject .dot { background: #f87171; }

        .score-example { margin-top: 28px; background: #0F1F36; border: 1px solid #1B3356; border-radius: 12px; padding: 20px 24px; }
        .score-row { display: flex; align-items: center; gap: 14px; margin-bottom: 10px; }
        .score-row:last-child { margin-bottom: 0; }
        .score-label { font-size: 12px; color: #5C7A9E; width: 110px; flex-shrink: 0; }
        .score-bar-wrap { flex: 1; background: #0C1829; border-radius: 4px; height: 6px; overflow: hidden; }
        .score-bar { height: 100%; border-radius: 4px; background: linear-gradient(90deg, #1A5CA8, #2D8CF0); }
        .score-val { font-family: "SF Mono",monospace; font-size: 12px; color: #2D8CF0; width: 36px; text-align: right; flex-shrink: 0; }

        .tip-box { margin-top: 24px; padding: 16px 20px; background: rgba(52,211,153,0.12); border: 1px solid rgba(52,211,153,0.25); border-radius: 10px; font-size: 13px; color: #D8E8FF; line-height: 1.7; }
        .tip-box strong { color: #34d399; }

        .pipeline-bar { display: flex; gap: 0; margin-top: 28px; border-radius: 10px; overflow: hidden; border: 1px solid #1B3356; }
        .pipe-col { flex: 1; padding: 16px 14px; border-right: 1px solid #1B3356; background: #0F1F36; }
        .pipe-col:last-child { border-right: none; }
        .pipe-col-label { font-size: 11px; font-weight: 700; margin-bottom: 8px; }
        .pipe-col-desc { font-size: 11px; color: #5C7A9E; line-height: 1.5; }
        @media (max-width: 600px) { .pipeline-bar { flex-direction: column; } .pipe-col { border-right: none; border-bottom: 1px solid #1B3356; } .pipe-col:last-child { border-bottom: none; } }

        .archive-card { margin-top: 28px; background: rgba(245,166,35,0.15); border: 1px solid rgba(245,166,35,0.3); border-radius: 12px; padding: 24px; }
        .archive-title { font-weight: 700; font-size: 15px; color: #F5A623; margin-bottom: 8px; }
        .archive-body { font-size: 13px; color: #5C7A9E; line-height: 1.7; }

        .tagline-section { text-align: center; padding: 80px 24px 60px; background: #060D1A; position: relative; overflow: hidden; }
        .tagline-section::before { content: ""; position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 600px; height: 300px; background: radial-gradient(ellipse, rgba(45,140,240,0.12) 0%, transparent 65%); pointer-events: none; }
        .tagline-final { font-size: clamp(1.2rem,3.5vw,1.8rem); font-weight: 800; letter-spacing: -0.01em; text-wrap: balance; line-height: 1.4; position: relative; z-index: 1; }
        .tagline-final .accent { color: #2D8CF0; }
        .tagline-note { margin-top: 16px; font-size: 13px; color: #5C7A9E; font-family: "SF Mono",monospace; letter-spacing: 0.05em; position: relative; z-index: 1; }
        .tag-divider { width: 48px; height: 2px; background: #2D8CF0; margin: 24px auto 0; opacity: 0.5; position: relative; z-index: 1; }
      `}</style>

      {/* HERO */}
      <div className="hero">
        <div className="hero-glow" />
        <div className="hero-content">
          <div className="hero-eyebrow">Crowdfunding Intelligence System</div>
          <h1 className="hero-title">
            <span className="crowd">クラウド</span>
            <span className="jarvis">ジャービス</span>
          </h1>
          <p className="hero-subtitle">CrowdJARVIS — v1.0</p>
          <p className="hero-tagline">
            世界のクラウドファンディングから、<br />
            日本市場の独占権を持つ商品を見つけ出す<br />
            AI搭載インテリジェンスツール
          </p>
          <div className="hero-badge">
            ⚙️ &nbsp;Tony Stark の相棒 JARVIS にインスパイアされた開発者の、もう一人の相棒
          </div>
        </div>
        <div className="scroll-cue">▼ &nbsp; scroll</div>
      </div>

      {/* TOC */}
      <div className="toc-bg">
        <div className="toc-inner">
          <div className="toc-title">目次</div>
          <div className="toc-list">
            {[
              ["#story", "⚙️ 誕生ストーリー"],
              ["#purpose", "🎯 目的と解決課題"],
              ["#dashboard", "🖥️ ダッシュボードの見方"],
              ["#card", "🃏 案件カードの読み方"],
              ["#score", "🏆 スコアの仕組み"],
              ["#status", "🗂️ ステータス管理"],
              ["#pipeline", "📊 パイプライン"],
              ["#archive", "💎 お宝発掘モード"],
              ["#approach", "✉️ アプローチ方法"],
              ["#auto", "⚡ 自動更新"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="toc-link">{label}</a>
            ))}
          </div>
        </div>
      </div>

      {/* STORY */}
      <div id="story" className="story-bg">
        <div className="section">
          <div className="section-label">Origin Story</div>
          <h2 className="section-title">なぜ「ジャービス」なのか</h2>
          <div className="section-body">
            <p>開発者の菊谷はアイアンマンの大ファンです。その中でも特に惹かれたのが、トニー・スタークの傍らで常に最良の判断を支える AI「JARVIS」の存在。膨大な情報を瞬時に整理し、次の行動を示してくれる——そんな相棒がビジネスの現場にも欲しいと感じていました。</p>
            <p>クラウドファンディング（Crowd）× JARVIS を組み合わせて生まれたのが <strong>クラウドジャービス</strong>です。世界中のキャンペーンを自動で収集・分析し、「次に動くべき案件はこれだ」と教えてくれる——まさに日本市場参入を狙うビジネスオーナーの右腕 AI です。</p>
          </div>
          <div className="quote-block">
            「JARVIS がいなければ、トニー・スタークはただの天才だ。<br />
            クラウドジャービスがいなければ、あなたは毎日 Kickstarter を手動でチェックしている。」
          </div>
        </div>
      </div>

      {/* PURPOSE */}
      <div id="purpose" className="features-bg">
        <div className="features-inner">
          <div className="section-label">Purpose</div>
          <h2 className="section-title">このツールが解決すること</h2>
          <div className="section-body">
            <p>世界の Kickstarter・Indiegogo には毎日数百もの新製品が登場します。その中から「日本でまだ誰も扱っていない」「販売数・達成率が高い」「交渉の余地がある」案件を人力で探すのは、ほぼ不可能です。</p>
            <p>クラウドジャービスは、このリサーチ作業を全自動化し、<strong>日本独占販売権の交渉ターゲット</strong>を毎朝ピックアップして届けます。あなたがやることは「良い案件を選んで、オファーを出す」だけです。</p>
          </div>
          <div className="feature-grid" style={{marginTop: "40px"}}>
            {[
              ["🌐", "世界案件の自動収集", "Kickstarter・Indiegogo を毎日自動クロール。進行中の新着案件と、過去のサクセス案件（お宝発掘）の両方を収集します。"],
              ["🏆", "AIスコアリング", "調達額・達成率・支援者数・勢い（支援者/日）などを複合的に評価し、0〜100 のスコアで案件を自動ランク付けします。"],
              ["🇯🇵", "日本未参入チェック", "Makuake・CAMPFIRE・GREEN FUNDING を自動検索。日本のクラウドファンディングに未掲載の案件を「未参入」フラグで強調表示します。"],
              ["🗣️", "日本語自動翻訳", "タイトルと説明文を Claude AI で自動翻訳。英語が苦手でも、商品の魅力を日本語でスピーディーに把握できます。"],
              ["🗂️", "パイプライン管理", "案件を「未接触 → ウォッチ中 → 交渉中 → 獲得済み」のステータスで管理。交渉の進捗を一覧で把握できます。"],
              ["📊", "日本市場分析レポート", "各案件ごとに、日本市場での需要・競合・参入ポテンシャルを AI が分析したレポートを自動生成します。"],
              ["✉️", "アプローチツール", "メールアドレスや問い合わせフォームへのリンクをカードに表示。案件ページから直接オファーの第一歩を踏み出せます。"],
              ["⚡", "毎日自動更新", "GitHub Actions による自動スケジューリング。毎朝 3:00 JST にデータが更新され、常に最新の案件情報が揃っています。"],
            ].map(([icon, name, desc]) => (
              <div key={name} className="feature-card">
                <span className="feature-icon">{icon}</span>
                <div className="feature-name">{name}</div>
                <div className="feature-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DASHBOARD */}
      <div id="dashboard" className="flow-bg">
        <div className="section">
          <div className="section-label">How to Use — 01</div>
          <h2 className="section-title">ダッシュボードの見方</h2>
          <div className="section-body"><p>ログイン後のトップ画面がダッシュボードです。世界から自動収集された案件が、スコア順・勢い順などで一覧表示されます。</p></div>
          <div className="howto-block">
            {[
              ["1", "ソート・フィルターで絞り込む", "画面上部のフィルターバーで「プラットフォーム（KS / IGG）」「カテゴリ」「🇯🇵 日本未参入のみ」「🔥 ライブ急上昇」などを切り替えできます。まず「未参入のみ」で絞るのがおすすめです。"],
              ["2", "スコアの高い順に確認する", "デフォルトは「ライブ勢い順」で並んでいます。スコア順に切り替えると、総合評価の高い案件から確認できます。"],
              ["3", "カードを開いて詳細を確認する", "各案件カードには調達額・達成率・残り日数・勢いがひと目でわかるように表示されています。「🇯🇵 未参入の可能性あり」バッジが付いた案件が優先ターゲットです。"],
            ].map(([num, title, desc]) => (
              <div key={num} className="howto-item">
                <div className="howto-step-num">{num}</div>
                <div><div className="howto-step-title">{title}</div><div className="howto-step-desc">{desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CARD */}
      <div id="card" className="detail-bg">
        <div className="detail-inner">
          <div className="section-label">How to Use — 02</div>
          <h2 className="section-title">案件カードの読み方</h2>
          <div className="section-body"><p>各カードには案件の判断に必要な情報がすべて詰まっています。</p></div>
          <div className="card-anatomy">
            <div className="card-anatomy-header">案件カード 各要素の説明</div>
            {[
              ["スコア", <><strong>右上の青い数字（0〜100）</strong>が総合スコアです。調達額・達成率・支援者数・勢い・日本未参入フラグを AI が総合評価した点数。80以上が優先候補。</>],
              ["調達額", <><strong>日本円換算の調達額</strong>を大きく表示。ドル原文も併記。その商品に世界市場でどれだけ需要があるかを示します。</>],
              ["達成率", <>目標金額に対する調達率。<strong>200% 以上は市場の強い需要</strong>のサイン。500% を超えると大ヒット案件です。</>],
              ["勢い", <><strong>1日あたりの新規支援者数</strong>。進行中の案件で特に重要で、終盤に向けて加速しているほどバイラル状態です。</>],
              ["残り日数", <>キャンペーン終了まで何日あるか。<strong>残り14日以内</strong>は交渉の好機——終了前後がメーカーに話を聞いてもらいやすいタイミングです。</>],
              ["PSE/技適", <>日本の電波法・安全規格の要確認フラグ。<strong>取得費用・期間が交渉の前提</strong>になるため事前確認が重要。</>],
              ["🇯🇵 未参入", <>Makuake・CAMPFIRE・GREEN FUNDING に類似品が見つからない案件に表示。<strong>独占交渉の有力候補</strong>です。</>],
            ].map(([badge, text]) => (
              <div key={badge as string} className="anatomy-row">
                <div className="anatomy-badge">{badge}</div>
                <div className="anatomy-text">{text}</div>
              </div>
            ))}
          </div>
          <div className="tip-box"><strong>💡 翻訳ボタンの使い方：</strong>カード下部の「翻訳」ボタンを押すと、タイトルと説明文が即座に日本語化されます。Claude AI が自然な日本語に変換するため、英語が苦手でも商品の魅力をすぐ把握できます。</div>
        </div>
      </div>

      {/* SCORE */}
      <div id="score" className="flow-bg">
        <div className="section">
          <div className="section-label">How to Use — 03</div>
          <h2 className="section-title">スコアの仕組み</h2>
          <div className="section-body"><p>スコアは以下の要素を合算した 0〜100 の総合指標です。単純な調達額ランキングでは見えない「本当に交渉すべき案件」を浮き上がらせます。</p></div>
          <div className="score-example">
            {[["調達額", "60%", "+30"], ["達成率", "50%", "+25"], ["支援者数", "40%", "+20"], ["日本未参入", "30%", "+15"], ["勢い・残り日数", "20%", "+10"]].map(([label, w, val]) => (
              <div key={label} className="score-row">
                <div className="score-label">{label}</div>
                <div className="score-bar-wrap"><div className="score-bar" style={{width: w}} /></div>
                <div className="score-val">{val}</div>
              </div>
            ))}
          </div>
          <div className="tip-box"><strong>💡 ポイント：</strong>「日本未参入フラグ」が付いた案件は自動で +15 点加点されます。同じ調達額でも未参入案件が上位に来るため、独占交渉の候補が自然にトップに集まります。</div>
        </div>
      </div>

      {/* STATUS */}
      <div id="status" className="detail-bg">
        <div className="detail-inner">
          <div className="section-label">How to Use — 04</div>
          <h2 className="section-title">ステータス管理の使い方</h2>
          <div className="section-body"><p>各案件カードのドロップダウンで、今どの段階にある案件かを記録します。ステータスはクラウドに即時保存され、自動クロールで上書きされることはありません。</p></div>
          <div className="status-grid">
            <div className="status-pill s-untouched"><span className="dot" />未接触</div>
            <div className="status-pill s-watch"><span className="dot" />ウォッチ中</div>
            <div className="status-pill s-nego"><span className="dot" />交渉中</div>
            <div className="status-pill s-got"><span className="dot" />獲得済み</div>
            <div className="status-pill s-reject"><span className="dot" />却下</div>
          </div>
          <div className="howto-block" style={{marginTop: "28px"}}>
            {[
              ["▶", "未接触（デフォルト）", "新規収集された案件はすべてここからスタート。まだ何も行動していない状態。"],
              ["▶", "ウォッチ中", "気になる案件をブックマーク。すぐにオファーは出さないが、継続して注目したい案件。パイプラインページで一覧確認できます。"],
              ["▶", "交渉中", "メーカーへのコンタクトを開始した状態。返信待ち・条件詰め中など、進行中の案件をここに集めます。"],
              ["▶", "獲得済み / 却下", "交渉成立、または断念した案件。パイプラインに実績として記録されます。"],
            ].map(([num, title, desc]) => (
              <div key={title} className="howto-item">
                <div className="howto-step-num">{num}</div>
                <div><div className="howto-step-title">{title}</div><div className="howto-step-desc">{desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PIPELINE */}
      <div id="pipeline" className="flow-bg">
        <div className="section">
          <div className="section-label">How to Use — 05</div>
          <h2 className="section-title">パイプライン管理ページ</h2>
          <div className="section-body"><p>ヘッダーの「🗂️ パイプライン」から専用ページへ移動できます。ステータス別にカードが整理され、交渉全体の進捗を一目で把握できます。</p></div>
          <div className="pipeline-bar">
            <div className="pipe-col"><div className="pipe-col-label" style={{color:"#60a5fa"}}>👀 ウォッチ中</div><div className="pipe-col-desc">注目案件をストック。じっくり比較して優先度を決める。</div></div>
            <div className="pipe-col"><div className="pipe-col-label" style={{color:"#fbbf24"}}>🤝 交渉中</div><div className="pipe-col-desc">コンタクト済み。返信・条件確認の進行状況を管理。</div></div>
            <div className="pipe-col"><div className="pipe-col-label" style={{color:"#34d399"}}>✅ 獲得済み</div><div className="pipe-col-desc">権利獲得完了。日本展開の実績リスト。</div></div>
            <div className="pipe-col"><div className="pipe-col-label" style={{color:"#94a3b8"}}>— 未接触</div><div className="pipe-col-desc">まだ判断していない案件の全量。</div></div>
            <div className="pipe-col"><div className="pipe-col-label" style={{color:"#f87171"}}>✕ 却下</div><div className="pipe-col-desc">見送り確定。候補から除外。</div></div>
          </div>
          <div className="tip-box" style={{marginTop:"24px"}}><strong>💡 使い方：</strong>パイプラインのカードにある「📋 案件へ」ボタンを押すと、ダッシュボードのその案件カードまで自動でスクロール＆ハイライトされます。</div>
        </div>
      </div>

      {/* ARCHIVE */}
      <div id="archive" className="detail-bg">
        <div className="detail-inner">
          <div className="section-label">How to Use — 06</div>
          <h2 className="section-title">お宝発掘モード（アーカイブ）</h2>
          <div className="section-body"><p>進行中の案件だけでなく、<strong>過去6ヶ月〜2年前にサクセスした案件</strong>も収集対象です。「アーカイブ」ページからアクセスできます。</p></div>
          <div className="archive-card">
            <div className="archive-title">💎 なぜ過去案件が「お宝」なのか</div>
            <div className="archive-body">クラウドファンディングでサクセスした商品でも、日本市場に展開されていないケースは多くあります。海外での実績（調達額・支援者数）がすでに証明されており、<strong>日本市場での需要を予測しやすく、交渉材料にもなります。</strong>進行中案件と比べてライバルが少ない点も大きな魅力です。</div>
          </div>
        </div>
      </div>

      {/* APPROACH */}
      <div id="approach" className="flow-bg">
        <div className="section">
          <div className="section-label">How to Use — 07</div>
          <h2 className="section-title">メーカーへのアプローチ方法</h2>
          <div className="section-body"><p>案件カードにはメーカーへの連絡手段が直接表示されます。</p></div>
          <div className="howto-block">
            {[
              ["1", "「市場分析」で準備する", "カード下部の「市場分析」ボタンを押すと、AI が日本市場でのポテンシャル・競合状況・参入提案を自動生成します。交渉の根拠資料として活用できます。"],
              ["2", "「CF確認」で日本状況を把握する", "「CF確認」ボタンで Makuake・CAMPFIRE・GREEN FUNDING を自動検索。「日本で未出品です」という事実をオファーメールに書き添えると説得力が増します。"],
              ["3", "「オファー」ボタンで連絡先へ", "カードの「オファー」ボタンからメール（mailto）または問い合わせフォームへアクセス。「元ページ」リンクから Kickstarter の公式ページも確認できます。"],
              ["4", "ステータスを「交渉中」に更新", "コンタクト後はドロップダウンで「交渉中」に変更。パイプラインページで一元管理できます。"],
            ].map(([num, title, desc]) => (
              <div key={num} className="howto-item">
                <div className="howto-step-num">{num}</div>
                <div><div className="howto-step-title">{title}</div><div className="howto-step-desc">{desc}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AUTO */}
      <div id="auto" className="detail-bg">
        <div className="detail-inner">
          <div className="section-label">How to Use — 08</div>
          <h2 className="section-title">自動更新のスケジュール</h2>
          <div className="section-body"><p>クラウドジャービスは何もしなくても毎日データが更新されます。朝ログインするだけで、昨夜の世界の動向が反映されています。</p></div>
          <div className="card-anatomy" style={{marginTop:"28px"}}>
            <div className="card-anatomy-header">自動実行スケジュール（JST）</div>
            {[
              ["03:00", <><strong>Kickstarter クロール</strong> — 人気順・新着順・アーカイブの3ジョブが並行実行。最大300件ずつ収集。</>],
              ["04:00", <><strong>Indiegogo クロール</strong> — テクノロジー・ガジェット系を中心に進行中＋アーカイブを収集。最大600件。</>],
              ["05:00", <><strong>日本CF突き合わせ</strong> — 未チェック案件を50件ずつ Makuake・CAMPFIRE・GREEN FUNDING で自動検索。</>],
              ["随時", <><strong>AI翻訳</strong> — 新規収集案件のタイトル・説明文を Claude AI で自動翻訳。手動で「翻訳」ボタンも使用可。</>],
            ].map(([badge, text]) => (
              <div key={badge as string} className="anatomy-row">
                <div className="anatomy-badge">{badge}</div>
                <div className="anatomy-text">{text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FINAL FLOW */}
      <div className="flow-bg">
        <div className="section">
          <div className="section-label">Summary Workflow</div>
          <h2 className="section-title">独占権取得までの全体フロー</h2>
          <div className="flow-steps">
            {[
              ["01", "毎朝ダッシュボードを開く", "自動更新された新着案件・アーカイブがスコア順に並んでいます。「🇯🇵 未参入のみ」フィルターをかけてスタート。"],
              ["02", "気になる案件を翻訳・確認", "「翻訳」で日本語化し、「CF確認」で日本未参入を確認。「市場分析」で参入ポテンシャルを把握。"],
              ["03", "ウォッチリストに追加", "すぐに動けなくてもステータスを「ウォッチ中」に変更してパイプラインに登録。"],
              ["04", "パイプラインで優先順位を決める", "パイプラインページでウォッチ中案件を一覧確認。最も有望な案件からオファーを出す順番を決める。"],
              ["05", "メーカーへオファーを送る", "「案件へ」ボタンでダッシュボードの案件カードに飛び、メール・問い合わせフォームから日本独占販売の提案を送付。ステータスを「交渉中」に更新。"],
            ].map(([num, title, desc]) => (
              <div key={num} className="flow-step">
                <div className="flow-num">{num}</div>
                <div><div className="flow-text-title">{title}</div><div className="flow-text-body">{desc}</div></div>
              </div>
            ))}
            <div className="flow-step" style={{paddingBottom: 0}}>
              <div className="flow-num" style={{borderColor: "#F5A623", color: "#F5A623"}}>✓</div>
              <div><div className="flow-text-title">獲得済みへ — 次の案件へ</div><div className="flow-text-body">交渉成立でステータスを「獲得済み」に。パイプラインに実績が積み上がっていきます。</div></div>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="tagline-section">
        <p className="tagline-final">
          世界中の Kickstarter を、<br />あなたの<span className="accent">チャンスリスト</span>に変える。
        </p>
        <p className="tagline-note">CrowdJARVIS — Built by Kikuya, inspired by Tony Stark&apos;s JARVIS</p>
        <div className="tag-divider" />
      </div>
    </div>
  );
}
