# MicroCMS記事エクスポーター

このツールは、microCMSから全ての記事を取得し、Markdownファイルとして保存するためのスクリプトです。

## 機能

- microCMSから全ての記事を取得
- 記事内容をMarkdown形式に変換
- createdAtのUNIXタイムスタンプをファイル名として保存
- 記事のメタデータ（タイトル、日付、カテゴリー、タグなど）をfrontmatterとして保存
- `htmls`配列内の各フィールドのコンテンツを適切に処理
- iframeタグをそのまま保持（埋め込みコンテンツのサポート）
- 引用（blockquote）内の改行を正しく処理（複数行対応）
- コマンドラインオプションによる柔軟な設定
- スタンドアロン実行可能ファイルとしてパッケージ化可能
- HTML文字実体参照（&lt;、&gt;など）を保持
- `<code>`タグ内の文字実体参照はHTML文字として変換
- `<pre>`タグ内の文字実体参照はHTML文字として変換

## 必要条件

### 開発環境

- Node.js（12.x以上推奨）
- microCMSのAPIキーとサービスドメイン

### 実行のみの場合

- 各OS向けのビルド済み実行可能ファイルを使用する場合、Node.jsは不要

## セットアップ

### 開発環境

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

### コマンドラインオプション

```
$ extract-microcms --help
Usage: extract-microcms [options]

microCMSから記事を取得してMDXファイルに変換するツール

Options:
  -V, --version               バージョン情報を表示
  -o, --output <directory>    出力先ディレクトリを指定 (default: "./output")
  -e, --endpoint <endpoint>   microCMSのエンドポイント名 (default: "articles")
  -d, --domain <domain>       microCMSのサービスドメイン（MICROCMS_SERVICE_DOMAINより優先）
  -k, --api-key <key>         microCMSのAPIキー（MICROCMS_API_KEYより優先）
  -v, --verbose               詳細なログを出力する
  -h, --help                  ヘルプを表示
```

### 開発環境での実行

以下のコマンドを実行して、全ての記事をエクスポートします：

```bash
npm start
```

または、オプションを指定して実行：

```bash
node index.js --output ./my-articles --endpoint blog
```

環境変数で指定する場合：

```bash
MICROCMS_SERVICE_DOMAIN=your-domain MICROCMS_API_KEY=your-key node index.js
```

### トラブルシューティング

問題が発生した場合は、`--verbose`オプションを使用して詳細なログを出力することができます：

```bash
./dist/extract-microcms-mac --verbose
```

このオプションを使用すると、Fetch API の初期化状態やmicroCMSクライアントの初期化状態などの詳細情報が表示されます。

#### よくある問題と解決策

1. **Headers is not defined エラー**

   スタンドアロン実行ファイルで次のようなエラーが発生する場合：
   ```
   Error: Network Error.
   Details: Headers is not defined
   ```

   この問題は、`microcms-js-sdk`が依存するFetch APIがスタンドアロン環境で正しく初期化されていないことが原因です。
   現在のバージョンでは`node-fetch@2`を使用してこの問題に対処していますが、もし問題が解決しない場合は、
   次のいずれかの方法を試してください：

   - Node.js環境で直接実行する
   - `.env`ファイルを使用して、実行ファイルと同じディレクトリに配置する
   - コマンドラインオプションで直接サービスドメインとAPIキーを指定する

2. **APIレスポンス解析エラー**

   データ形式やレスポンスの解析に関するエラーが発生した場合は、まずAPIが正しく応答しているか確認してください。
   `--verbose`オプションを使用すると、APIリクエストの詳細情報が表示されます。

### スタンドアロン実行ファイルのビルド

以下のコマンドでスタンドアロン実行ファイルをビルドできます：

```bash
# すべてのプラットフォーム用にビルド
npm run build

# 特定のプラットフォーム用にビルド
npm run build:win    # Windows用
npm run build:mac    # macOS用
npm run build:linux  # Linux用
```

ビルドした実行ファイルは `dist` ディレクトリに生成されます。

### スタンドアロン実行ファイルの使用

```bash
# Windows
./dist/extract-microcms-win.exe --output ./my-articles

# macOS
./dist/extract-microcms-mac --output ./my-articles

# Linux
./dist/extract-microcms-linux --output ./my-articles
```

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

- **引用内の改行**: 引用（blockquote）内の改行（br）タグが正しく処理され、各行に引用マーカー`>`が付与されます。複数行の引用も適切に処理されます。

  例：
  ```html
  <blockquote>嵐に怯えてるフリをして<br>空が割れるのを待っていたんだ<br>今も思い出してる</blockquote>
  ```

  は、以下のように出力されます：
  ```markdown
  > 嵐に怯えてるフリをして
  > 空が割れるのを待っていたんだ
  > 今も思い出してる
  ```

### 文字実体参照の保持

HTML文字実体参照（`&lt;`、`&gt;`など）は自動的に保持されます。ただし、`<pre>`タグ内の文字実体参照はHTML文字として変換されます。

例えば：

```html
<p>&lt;</p>
<pre><code>[html]\n// 「次のエピソードへ」ボタンの部分\n&lt;div class=\"com-vod-VODNextProgramInfo\"&gt;</code></pre>
```

は以下のように変換されます：

```markdown
&lt;
```html
[html]
// 「次のエピソードへ」ボタンの部分
<div class="com-vod-VODNextProgramInfo">
```
</code></pre>
```

この動作により、コードブロック内のHTML文字は適切に表示され、それ以外の文字実体参照は保持されます。

## コードの構造

コードは以下のような機能別のモジュールに分割されています：

- **メイン処理**: 記事の取得と変換を行う
- **HTML解析と前処理**: 特殊なタグ（iframe, blockquote）を保持するための前処理
- **Markdown変換後処理**: 特殊タグの復元と引用フォーマットの調整
- **コマンドラインインターフェース**: ユーザーオプションの解析と処理

## カスタマイズ

`index.js`ファイルを編集することで、以下の設定をカスタマイズできます：

- エンドポイント名（デフォルトは`articles`）
- 出力ディレクトリ
- Frontmatterの内容
- HTML→Markdown変換の処理方法

## 注意事項

- 大量の記事がある場合は、APIの呼び出し制限に注意してください。
- 出力ディレクトリが既に存在する場合、同名のファイルは上書きされます。
- `htmls`配列内の各要素は、`fieldId`の値をキーとしてHTMLコンテンツを取得します。
- スタンドアロン実行ファイルの場合でも、`.env`ファイルがあれば読み込むことができます。
- バイナリをビルドする際は、`microcms-js-sdk`がFetch APIに依存しているため、`node-fetch`がグローバルスコープに提供されるように設定しています。
- バイナリビルド後に問題が発生する場合は、`node-fetch`のバージョンを変更するか、代替のHTTPクライアントでの実装を検討してください。 