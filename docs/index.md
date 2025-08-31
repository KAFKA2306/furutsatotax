# 税制ガイド（私的年金・控除の要点）

このサイトは、私的年金制度（企業型DCのマッチング拠出、iDeCo、小規模企業共済）などの制度概要と実務上の確認ポイントをまとめたものです。まずは全体像を押さえる場合は「DC制度解説」へ、詳細を調べる場合は各制度の個別ページをご覧ください。

## クイックリンク
- DC制度の全体像と比較: [DC制度解説](DC制度解説.md)
- 個別制度の詳細:
  - [DCマッチング拠出](DCマッチング拠出.md)
  - [iDeCo](個人型確定拠出年金_iDeCo.md)
  - [小規模企業共済](小規模企業共済.md)

## その他税制の要点
- 体系の理解: [所得税の基本](所得税の基本.md) / [住民税の基本](住民税の基本.md)
- 所得控除:
  - [基礎控除](基礎控除.md)
  - [社会保険料控除](社会保険料控除.md)
  - [医療費控除](医療費控除.md)
  - [配偶者控除・扶養控除](配偶者控除_扶養控除.md)
  - [生命保険料控除等](生命保険料控除等.md)
- 税額控除:
  - [住宅ローン控除](住宅ローン控除.md)
  - [寄附金税額控除（ふるさと納税）](寄附金控除_ふるさと納税.md)

## 計算根拠
- 課税所得（所得税）: `総所得金額等 − 所得控除（基礎控除・社会保険料 等）`
- 課税所得（住民税）: `総所得金額等 − 住民税の所得控除`
- 所得税（概算）: 速算表の税率（5%〜45%）で算出（復興特別所得税は簡易モデルでは未考慮）
- 住民税（概算）: `課税所得 × 10%`（所得割のみ・標準税率）
- ふるさと納税の上限目安（簡易）: `(所得税額 + 住民税（所得割）) × 20%` を100円単位で切り捨て

## 全体フロー（可視化）
本サイト内ツール・解説の概念的な流れです。

<svg viewBox="0 0 720 280" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="税額計算とふるさと納税上限の全体フロー">
  <desc>収入→合計所得→所得控除→課税所得→所得税・住民税→上限目安（住民税所得割の2割目安）という流れ。</desc>
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerUnits="strokeWidth" markerWidth="8" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#555" />
    </marker>
  </defs>
  <rect x="0" y="0" width="720" height="280" fill="#fff" />
  <!-- Boxes -->
  <g fill="#333" font-size="12">
    <rect x="40" y="40" width="120" height="44" rx="6" ry="6" fill="#e8f0fe" stroke="#6c8cd5" />
    <text x="100" y="66" text-anchor="middle">収入・差益</text>

    <rect x="200" y="40" width="140" height="44" rx="6" ry="6" fill="#e8f0fe" stroke="#6c8cd5" />
    <text x="270" y="66" text-anchor="middle">合計所得金額等</text>

    <rect x="380" y="40" width="140" height="44" rx="6" ry="6" fill="#e8f0fe" stroke="#6c8cd5" />
    <text x="450" y="66" text-anchor="middle">所得控除</text>

    <rect x="560" y="40" width="120" height="44" rx="6" ry="6" fill="#e8f0fe" stroke="#6c8cd5" />
    <text x="620" y="66" text-anchor="middle">課税所得</text>

    <rect x="160" y="160" width="160" height="44" rx="6" ry="6" fill="#e6f4ea" stroke="#5aa469" />
    <text x="240" y="186" text-anchor="middle">所得税（速算表）</text>

    <rect x="360" y="160" width="160" height="44" rx="6" ry="6" fill="#e6f4ea" stroke="#5aa469" />
    <text x="440" y="186" text-anchor="middle">住民税（所得割）</text>

    <rect x="560" y="160" width="140" height="44" rx="6" ry="6" fill="#fff3cd" stroke="#d4a106" />
    <text x="630" y="186" text-anchor="middle">上限目安</text>
    <text x="630" y="202" text-anchor="middle" font-size="11">住民税所得割の2割</text>
  </g>
  <!-- Arrows -->
  <g stroke="#555" stroke-width="2" marker-end="url(#arrow)">
    <line x1="160" y1="62" x2="200" y2="62" />
    <line x1="340" y1="62" x2="380" y2="62" />
    <line x1="520" y1="62" x2="560" y2="62" />
    <line x1="620" y1="84" x2="240" y2="160" />
    <line x1="620" y1="84" x2="440" y2="160" />
    <line x1="520" y1="182" x2="560" y2="182" />
  </g>
  <!-- Labels under boxes -->
  <g fill="#666" font-size="11">
    <text x="450" y="92" text-anchor="middle">基礎控除・社会保険料・iDeCo など</text>
  </g>
</svg>
## 計算例
前提（簡易モデル）
- 年収等からの総所得金額等: 540万円相当
- 所得税の基礎控除: 63万円、住民税の基礎控除: 43万円
- 社会保険料や掛金控除等を控除後、課税所得（所得税）約336万円、課税所得（住民税）約356万円

概算
- 所得税: 速算表により約245,300円
- 住民税（所得割）: 約356,400円（= 356万円×10%）
- ふるさと納税の上限目安: 約120,300円（= (所得税 + 住民税) × 20% を100円単位切り捨て）

注意: 本サイトは一般的な情報提供を目的としています。制度・税制は改正される可能性があるため、最終判断は必ず公的資料・最新の法令や各制度の公式情報でご確認ください。

## 参考資料（出典）
- 国税庁タックスアンサー「No.2260 所得税の税率」: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2260.htm
- 国税庁「令和7年度 税制改正による基礎控除の見直し」: https://www.nta.go.jp/users/gensen/2025kiso/index.htm
- 総務省（個人住民税の制度解説・地方税法）: https://www.soumu.go.jp/
- 総務省 ふるさと納税ポータル「寄附金税額控除の概要」: https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/furusato/mechanism/deduction.html
- 住民税の基礎控除見直し（参考資料の一例）: https://www.soumu.go.jp/main_content/000667390.pdf
