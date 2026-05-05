# AGENTS.md

## Project Overview

匿名リアルタイムチャットアプリケーション。登録不要、訪問即チャット開始。

## Directory Structure

| ディレクトリ / ファイル | 役割 |
|-------------------------|------|
| `server.js` | サーバーエントリポイント（Express + Socket.IO） |
| `lib/storage.js` | ストレージクラス（MemoryStorage, RedisStorage） |
| `public/index.html` | フロントエンド（Vanilla JS、Socket.IOクライアント） |
| `test/` | テストファイル（bun:test） |
| `compose.yaml` | アプリ + Redis の Docker Compose |
| `.github/workflows/` | CI: Docker build + OpenCode |

## Commands

```
bun install              # install deps
bun run dev              # dev server with --watch (localhost:3000)
bun test                 # run all tests
bun test test/foo.test.js  # run specific test file
node server.js           # production start (not bun run)
```

## Architecture

- **Single-file app**: `server.js` が `public/index.html` を配信するだけ
- **CommonJS**: `require()` のみ。ESM（`import`/`export`）は使わない
- **テスト**: `bun test` で実行（bun:testフレームワーク）
- **userId**: クライアント側で生成し `localStorage` に保存

## Environment Variables

| 変数 | デフォルト | 備考 |
|------|-----------|------|
| `ALLOWED_ORIGINS` | `http://localhost:3000` | CORS許可オリジン |
| `STORAGE_TYPE` | `memory` | `memory` または `redis` |
| `REDIS_URL` | `redis://localhost:6379` | `STORAGE_TYPE=redis` のときのみ |

## Boundaries

- `.env*` ファイルを変更・コミットしない
- `redis` パッケージは `optionalDependencies` — 接続失敗時は自動でmemoryにフォールバック
- 本番環境では `node server.js` で起動する（`bun run` ではない）
- `server.js` は `require.main === module` でlistenを制御 — require時は起動しない
- Dockerイメージは `ghcr.io/ymmmtym/anychat` にプッシュ（`main` ブランチ + `v*` タグ）

## Workflow

- GitLab Flowに準拠
  - `main`: 安定ブランチ（常時デプロイ可能状態を維持）
  - `feature/*`: 新機能開発（`main`から派生、MRでマージ）
  - `fix/*`: バグ修正（同上）
  - `release/*`: リリース準備（タグ付け前に検証）
  - `hotfix/*`: 緊急修正（`main`から派生、即マージ・デプロイ）
- 変更は必ずブランチで行い、直接`main`にコミットしない
- 変更後は `bun test` を実行し、全てパスすることを確認する
- `bun run dev` でdevサーバーを起動し手動検証する
- Docker ComposeでRedis付き動作確認: `docker compose up -d`
- mise.toml で Bun バージョン（`latest`）を管理
