# GUTS CUT

写真・動画・コラージュ編集Webアプリ。ビルド不要のHTML/CSS/JavaScriptです。

## 起動方法

```sh
python3 -m http.server 8080 --directory dist
```

ブラウザで http://localhost:8080 を開いてください。
本番環境では `dist/` をHTTPS対応の静的ホスティングに配置します。

## 保存元

- Sites v21（2026-10-31）
- 元コミット: `235f589e84b8a89bfb4084cf945155d32acc0178`
- 稼働中: https://guts-studio-editor.golfguts0702.chatgpt.site
- このリポジトリへの保存で既存サイトの公開設定は変更していません。
- Sites → GitHubの一方向自動保存を設定済みです。ChatGPTのクラウドタスクが毎時10分（日本時間）に差分を確認します。即時同期・双方向同期ではありません。GitHub側の独自変更は上書きせず停止して通知します。詳細は `SYNC.md`。

## 配色

背景 `#E8DFD3` / カード `#D6C8B6` / 文字 `#3F3A36` / 補足 `#8B857E` / アクセント `#4F6B57`。

## 実装状況

実装・検証履歴と未実装項目は `docs/reference-status.md` を参照してください。InShotとの完全な機能互換ではありません。端末によって動画書き出し形式が異なり、実機iPhoneでの全機能確認は未完了です。

## 自動保存タスク

- タスク: `Automation_2fdbe9342a1c819198cd6973c0a25de1`
- 有効化: 2026-10-31
- 現時点のソース取得・GitHub書き込み・内容一致は確認済み。初回定期実行は未確認です。
