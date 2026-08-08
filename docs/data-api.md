# 税パラメータ Data API

2026年分の計算に使う国税庁公式パラメータを、計算コードから独立した機械可読データとして配布します。

## 正準データ

`data/official/nta-tax-parameters-2026.json`

収録内容:

- 給与所得控除後の給与等の金額: 9区分
- 所得税率・控除額: 7区分
- 給与所得控除の最低保障額: 740,000円
- 基礎控除の最高額: 1,040,000円
- 給与収入のみ・他所得なしの場合の所得税等がかからない目安: 1,780,000円

## 生成

```bash
python scripts/build_tax_data_api.py --out public-api/v1
```

生成物:

- `parameters.json`: 構造化パラメータとprovenance
- `parameters.csv`: 9+7=16レコードのフラット配布
- `manifest.json`: 件数、byte数、SHA-256、取得日時、利用条件

利用側は`manifest.json`のSHA-256を比較し、変更があったファイルだけを再取得できます。

## 出典・利用条件

出典は国税庁「給与所得者と税」「令和8年度税制改正による所得税の基礎控除の引上げ等について」です。取得日時とURLは正準JSONに保存します。

国税庁サイトは、特記がないコンテンツについて「公共データ利用規約（第1.0版）」に準拠して利用でき、出典記載と、編集・加工した場合の明示が必要です。本リポジトリのJSON/CSVは国税庁掲載内容を機械可読形式へ編集・加工したものです。

- https://www.nta.go.jp/publication/pamph/koho/kurashi/html/02_1.htm
- https://www.nta.go.jp/users/gensen/2026kiso/index.htm
- https://www.nta.go.jp/chuijiko/copy.htm

## 更新方針

年度ごとの正準snapshotは上書きせず保持します。新年度は新しいJSONを追加し、既存年度を暗黙に置換しません。通常CIは保存済みsnapshotだけを検証するため、国税庁サイトへ反復アクセスしません。

欠損値`null`は上限がないことを表し、推定値ではありません。
