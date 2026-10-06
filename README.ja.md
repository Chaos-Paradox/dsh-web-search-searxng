# dsh-web-search-searxng

[English](README.md) | [中文](README.zh.md) | **日本語**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![SearXNG](https://img.shields.io/badge/search-SearXNG-3050ff?logo=searxng&logoColor=white)](https://github.com/searxng/searxng)
[![DeepSeek Harness](https://img.shields.io/badge/plugin-DeepSeek%20Harness-4D6BFE)](https://github.com/deepseek-ai/deepseek-harness)

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（dsh）用のプラグインです。セルフホストした [SearXNG](https://github.com/searxng/searxng) メタ検索インスタンスを通じて、AI エージェントに**無料・無制限・プライバシー重視の Web 検索**を提供します——**API キー不要、検索ごとのモデルコストなし、クエリログはマシンの外に出ません**。インストールすると Web / デスクトップアプリの 設定 → プラグイン ページに **SearXNG 検索**カードが追加され、エンドポイント・エンジン制限・結果言語を GUI から編集できます。

![設定 → プラグイン ページの SearXNG 検索カード](docs/settings-card.en.png)

*設定 → プラグイン ページの SearXNG 検索カード——エンドポイント・エンジン制限・結果言語。変更は再起動なしで次の検索に適用されます。*

## 検索 API ではなく SearXNG を選ぶ理由

| | ホスト型検索 API | **このプラグイン** |
|---|---|---|
| コスト | クエリごとに課金 | **無料**——自分のインスタンス、自分のハードウェア |
| API キー | 必須。ローテーションや漏洩のリスク | **一切不要** |
| プライバシー | クエリは第三者へ送信 | クエリは**自分の** SearXNG のみ。70+ のエンジンを集約 |
| レート制限 | あり | 自分のインスタンスの許容範囲のみ |
| オフライン / イントラネット | 不可 | 可能——ループバックやプライベートネットワークのアドレスを設計上サポート |

## 機能

- 🔍 **メタ検索プロバイダー**——安定した id `searxng` で dsh の `ctx.web` シームに登録。エージェントのすべての Web 検索は `GET {baseURL}/search?format=json` で処理されます。
- 🖥️ **GUI 設定カード**——設定 → プラグイン ページに **SearXNG 検索**カードが表示され、設定ファイルを触らずにエンドポイント・エンジン・言語を編集可能。変更は**次の検索から即時反映、再起動不要**。
- 🔒 **デフォルトで安全**——漏洩する認証情報が存在しません。HTTP リダイレクトは失敗として扱われ（`WEB_PROVIDER_ERROR`）、クエリ文字列が別オリジンへ転送されることはありません。403 レスポンスには「インスタンスの JSON フォーマットが無効」である旨のヒントが含まれます。
- 🏠 **セルフホストに優しい**——ループバック（`http://localhost:8080`）、プライベート IP、サブパスマウント（`http://host/searxng`）をすべてサポート。`/search` は正しく連結されます。
- 🌐 **エンジンと言語の制御**——SearXNG ネイティブのパラメータでエンジンを制限（`bing,duckduckgo`）し、結果言語を指定（`zh-CN`、`en`、`ja` など）できます。
- 📎 **引用可能なソース**——各結果は URL・タイトル・エンジンの抜粋（snippet）・公開日（存在する場合）を持つ引用可能なソースにマッピングされます。
- ⚡ **利用者側のビルド不要**——`lib/` をコミット済みのため、git URL からのインストールでそのまま動作します。

## 仕組み

```
┌──────────────┐  Web 検索    ┌──────────────┐   JSON API   ┌────────────────┐
│ dsh エージェント│ ─────────▶ │ ctx.web シーム│ ───────────▶ │ あなたの SearXNG│
│  (LLM)        │ ◀─────────  │ （searxng    │ ◀─────────── │ インスタンス    │
└──────────────┘  ソースのみ  │ プロバイダー）│   results[]  └───────┬────────┘
                               └──────────────┘                      │ 集約
                                                          ┌──────────▼──────────┐
                                                          │ Google / Bing / DDG │
                                                          │ Brave / 70+ エンジン │
                                                          └─────────────────────┘
```

SearXNG は生成回答を返さないため、結果は**ソースのみ**を持ちます——本文が必要な場合、エージェントが `fetch` でページを自分で読みます。

## 前提条件

- `ctx.web` シームを持つ DeepSeek Harness（`dsh-web` を含む任意の dsh リリース）。
- Node.js `^22.19 || >=24`（開発時のみ。利用者は dsh のみで可）。
- **JSON 出力を有効化**した SearXNG インスタンス——`settings.yml` の `search.formats` に `json` が必要です（SearXNG のデフォルトは HTML のみ）。

### Docker で SearXNG を素早くセットアップ

```sh
mkdir -p searxng && cd searxng
cat > settings.yml <<'EOF'
use_default_settings: true
server:
  secret_key: "十分に長いランダム文字列に変更してください"
search:
  formats:
    - html
    - json   # ← このプラグインに必須
EOF
docker run -d --name searxng -p 8080:8080 \
  -v "$PWD/settings.yml:/etc/searxng/settings.yml" \
  searxng/searxng
```

JSON が有効か確認：

```sh
curl "http://localhost:8080/search?q=test&format=json"
```

## インストール（dsh へのインポート）

**方法 1 —— GitHub から直接（最新の main を追跡）：**

```sh
dsh plugin --profile <名前> add https://github.com/Chaos-Paradox/dsh-web-search-searxng
```

**方法 2 —— リリースバージョンを固定（再現性のため推奨）：**

```sh
dsh plugin --profile <名前> add https://github.com/Chaos-Paradox/dsh-web-search-searxng#v0.1.0
```

全バージョンは [Releases ページ](https://github.com/Chaos-Paradox/dsh-web-search-searxng/releases)を参照してください。

**方法 3 —— ローカルクローンまたは tarball から：** 同じコマンドに絶対パスを指定します。例：`dsh plugin --profile <名前> add /path/to/dsh-web-search-searxng`。`lib/` はコミット済みのためビルド不要です。

インストールするとバンドルのパッチレイヤーが有効になり、プロバイダー行が登録されます。インポートの確認：

```sh
dsh plugin --profile <名前> list        # dsh-web-search-searxng が表示されるはず
```

```sh
# アンインストール
dsh plugin --profile <名前> remove dsh-web-search-searxng
```

## 設定と有効化

登録するだけでは検索はルーティングされません。2 つのスイッチはどちらもあなたのものです：

### 1. インスタンスを指定する

**方法 A —— GUI（推奨）：** **設定 → プラグイン → SearXNG 検索** を開き、各フィールドを入力します。すべての変更は再起動なしで次の検索に適用されます。

**方法 B —— 環境変数**（dsh 起動前）：

```sh
export SEARXNG_BASE_URL="http://localhost:8080"
```

| フィールド | GUI ラベル | 環境変数フォールバック | 説明 |
|---|---|---|---|
| `baseURL` | エンドポイント / 实例地址 | `SEARXNG_BASE_URL` | SearXNG インスタンスのベース URL。`/search` が付加されます。空の場合、プロバイダーは利用不可と報告します。 |
| `engines` | エンジン制限 | — | カンマ区切りのエンジン制限。例：`bing,duckduckgo`。 |
| `language` | 結果言語 | — | 結果の優先言語。例：`zh-CN`、`en`、`ja`。 |

### 2. 検索プロバイダーとして選択する

プロファイルの `web` 行にパッチを当てます（パッチは行の config を丸ごと置き換えるため、`fetchProvider` を再記述してください）：

```yaml
# $DSH_HOME/profiles/<名前>/cordis.patch.yml
- id: web
  config:
    searchProvider: searxng
    fetchProvider: http
```

元に戻すにはパッチを削除します（または `searchProvider: deepseek-official` を設定）。エンドポイント未設定の場合、プロバイダーは利用不可と報告し、既存の動作は変わりません。

## 検索結果の内容

各 SearXNG 結果は引用可能なソースにマッピングされます：

| SearXNG フィールド | dsh ソースフィールド | 備考 |
|---|---|---|
| `url` | `url` | URL のないエントリーは破棄 |
| `title` | `title` | 空白の場合は省略 |
| `content` | `snippet` | エンジンの抜粋 |
| `publishedDate` | `publishedAt` | エンジンが提供する場合のみ |

`truncated` は常に `false`（`maxResults` の切り詰めは web サービス側の責務）。SearXNG にはシームが保証できる生成回答がないため、生成 `content` は付きません。

## トラブルシューティング

| 症状 | 原因 | 解決策 |
|---|---|---|
| `SearXNG error (HTTP 403); the instance may refuse JSON output` | `settings.yml` の `search.formats` に `json` がない | 上記の手順で追加し、コンテナを再起動 |
| プロバイダーが利用不可 / 何も変わらない | エンドポイント未設定 | カードのフィールドまたは `SEARXNG_BASE_URL` を設定 |
| `search request failed` / ECONNREFUSED | インスタンス停止中、またはポート誤り | `docker ps` を確認し、curl 確認コマンドを試す |
| `WEB_PROVIDER_ERROR` がリダイレクトに言及 | SearXNG 前面のプロキシがリダイレクト | `baseURL` を最終アドレスに指定。リダイレクトは設計上失敗します |
| `sources` が空 | エンジンが使用可能な結果を返さなかった（または全エントリーに URL がない） | `engines` を緩め、ブラウザでインスタンスを確認 |

## 開発

```sh
pnpm install        # 依存関係はすべて npm から（@deepseek-ai/* 0.2.1-alpha.1 系列）
pnpm run build      # tsdown（ホスト + ブラウザの両バンドル）+ tsc（ブラウザ宣言）
pnpm test           # vitest：プロバイダー挙動、リダイレクトポリシー、プロキシ egress、カードフォーム
pnpm run typecheck  # tsc --noEmit
```

```
src/
  index.ts      プラグインエントリー：config スキーマ、環境変数フォールバック、プロバイダー登録
  provider.ts   SearxngSearchProvider：JSON API 呼び出し、結果マッピング、エラーポリシー
  types.ts      SearXNG レスポンス型
  client/       ブラウザバンドル：設定 → プラグイン ページのカード（React）
tests/          vitest スイート（リダイレクトと egress ポリシーを含む）
```

`lib/` は意図的にコミットされています：git URL からインストールした利用者がビルド手順なしで成果物を得られるようにするためです。**`src/` を変更したら `lib/` を再ビルドして再コミットしてください。**

既知のギャップ：カードの apply レベル登録テストは現在上游にあります——公開済みの `@deepseek-ai/dsh-client-test-runtime` が npm パッケージに含まれないソースファイルを参照しているため、本リポジトリでは残りのカードテストが必要とする 2 つのヘルパーのローカル代替（`tests/helpers.ts`）を保持しています。

## コントリビューション

Issue と Pull Request を歓迎します。プロバイダーの「認証情報を持たない」ことと「リダイレクトで失敗する」ことは設計上の制約であり、未実装の機能ではありません。この点を維持してください。

## ライセンス

[MIT](LICENSE) © [Chaos-Paradox](https://github.com/Chaos-Paradox)

## リンク

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)——ホストプロジェクト
- [SearXNG](https://github.com/searxng/searxng)——メタ検索エンジン
- [SearXNG JSON フォーマットのドキュメント](https://docs.searxng.org/admin/settings/settings_search.html)——`search.formats` の有効化
