# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## このプロジェクトの規約(ec-learning フェーズC)

- パッケージマネージャは **pnpm**(mise で固定)。操作はリポジトリルートの mise タスクから:
  `mise run mobile-install` / `mise run mobile-start` / `mise run mobile-ios` / `mise run mobile-xcode` / `mise run mobile-check`
- **設定は app.json(静的・公開値)+ app.config.ts(環境依存の値を process.env から上乗せ)**。
  個人識別子(Apple Team ID = `EC_APPLE_TEAM_ID`)は `.env.local`(gitignore 済、Expo CLI が自動読込)に置き、
  app.json や mise.toml に書かない。前提は app.config.ts のコメント参照
- **コンポーネントは `src/components/<name>/<name>.tsx` のディレクトリ単位で作る**。
  プラットフォーム分岐は同居ファイル(`<name>.web.tsx` 等)で行う。
  前提: `.web.tsx` 分岐が発生し得るため、最初からディレクトリを掘っておく(後からの昇格を避ける)
- `src/app/` はルート専用。画面本体は `src/screens/<name>/` に置き、ルートは薄く保つ
- 画面専用の子コンポーネントは `src/screens/<name>/` に同居(componentsに置くのは再利用するものだけ)
- スタイルはコンポーネントファイル末尾の `StyleSheet.create`、テストは対象の隣に `*.test.ts`
- データ取得は TanStack Query、クライアント状態(カート)は zustand。API は Go サーバー(:8080)
