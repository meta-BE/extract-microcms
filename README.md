# MicroCMS記事エクスポーター

このツールは、microCMSから全ての記事を取得し、Markdownファイルとして保存するためのスクリプトです。

## 機能

- microCMSから全ての記事を取得
- 記事内容をMarkdown形式に変換
- createdAtのUNIXタイムスタンプをファイル名として保存
- 記事のメタデータ（タイトル、日付、カテゴリー、タグなど）をfrontmatterとして保存
- `htmls`配列内の各フィールドのコンテンツを適切に処理
- iframeタグをそのまま保持（埋め込みコンテンツのサポート）

## 必要条件

- Node.js（12.x以上推奨）
- microCMSのAPIキーとサービスドメイン

## セットアップ

1. パッケージをインストールします：

```bash
npm install
```

2. `.env`ファイルを作成または編集し、microCMSの接続情報を設定します：

```
MICROCMS_API_KEY=あなたのAPIキー
MICROCMS_SERVICE_DOMAIN=あなたのサービスドメイン
```

## 使い方

以下のコマンドを実行して、全ての記事をエクスポートします：

```bash
npm start
```

エクスポートされた記事は`./output`ディレクトリに保存されます。
ファイル名は記事の作成日時のUNIXタイムスタンプを使用しています。

## 対応しているmicroCMSのレスポンス形式

このスクリプトは以下のようなmicroCMSのレスポンス形式に対応しています：

1. `htmls`配列形式（推奨）：
   ```json
   {
     "id": "記事ID",
     "title": "記事タイトル",
     "htmls": [
       {
         "fieldId": "rich",
         "rich": "<p>HTMLコンテンツ</p>"
       },
       {
         "fieldId": "plane",
         "plane": "<p>その他のHTMLコンテンツ</p>"
       }
     ]
   }
   ```

2. `content`プロパティ形式（従来の形式、互換性のためサポート）：
   ```json
   {
     "id": "記事ID",
     "title": "記事タイトル",
     "content": "<p>HTMLコンテンツ</p>"
   }
   ```

## 特殊なHTMLタグの処理

このスクリプトは、以下の特殊なHTMLタグを適切に処理します：

- **iframeタグ**: YouTubeやSpotifyなどの埋め込みコンテンツを含むiframeタグはそのまま保持されます。MDXファイル内でそのまま使用できます。

例：
```html
<iframe src="https://www.youtube.com/embed/..." width="560" height="315" frameborder="0"></iframe>
```

は、そのままMDXファイルに出力されます。

## カスタマイズ

`index.js`ファイルを編集することで、以下の設定をカスタマイズできます：

- エンドポイント名（デフォルトは`articles`）
- 出力ディレクトリ
- Frontmatterの内容

## 注意事項

- 大量の記事がある場合は、APIの呼び出し制限に注意してください。
- 出力ディレクトリが既に存在する場合、同名のファイルは上書きされます。
- `htmls`配列内の各要素は、`fieldId`の値をキーとしてHTMLコンテンツを取得します。 