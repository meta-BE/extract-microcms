#!/usr/bin/env node

// グローバルにfetch関連のオブジェクトを定義
const fetch = require('node-fetch');
global.Headers = fetch.Headers;
global.Request = fetch.Request;
global.Response = fetch.Response;
global.fetch = fetch;

// デバッグ情報を出力
console.log('Fetch API初期化完了：', {
  Headers: typeof global.Headers,
  Request: typeof global.Request,
  Response: typeof global.Response,
  fetch: typeof global.fetch
});

const { createClient } = require('microcms-js-sdk');
const { parser } = require("rich-editor-to-markdown-parser");
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { program } = require('commander');

// コマンドライン引数の設定
program
  .name('extract-microcms')
  .description('microCMSから記事を取得してMDXファイルに変換するツール')
  .version('1.0.0')
  .option('-o, --output <directory>', '出力先ディレクトリを指定', './output')
  .option('-e, --endpoint <endpoint>', 'microCMSのエンドポイント名', 'articles')
  .option('-d, --domain <domain>', 'microCMSのサービスドメイン（MICROCMS_SERVICE_DOMAINより優先）')
  .option('-k, --api-key <key>', 'microCMSのAPIキー（MICROCMS_API_KEYより優先）')
  .option('-v, --verbose', '詳細なログを出力する');

program.parse(process.argv);

const options = program.opts();

// 詳細ログモード
const isVerbose = options.verbose;

if (isVerbose) {
  console.log('実行オプション：', options);
}

// .envファイルを読み込む
dotenv.config();

// 出力ディレクトリの設定
const OUTPUT_DIR = options.output;

// エンドポイントの設定
const ENDPOINT = options.endpoint;

// APIキーとサービスドメインの設定（コマンドライン > 環境変数の優先順位）
const serviceDomain = options.domain || process.env.MICROCMS_SERVICE_DOMAIN;
const apiKey = options.apiKey || process.env.MICROCMS_API_KEY;

if (!serviceDomain || !apiKey) {
  console.error('エラー: microCMSのサービスドメインとAPIキーが必要です。');
  console.error('--domain と --api-key オプションか、環境変数で指定してください。');
  process.exit(1);
}

/**
 * microCMSクライアントの初期化処理
 * @returns {Object} 初期化されたmicroCMSクライアント
 */
function setupClient() {
  try {
    console.log('microCMSクライアントの初期化中...');
    const client = createClient({
      serviceDomain,
      apiKey,
    });
    console.log('microCMSクライアント初期化完了');
    
    // 出力ディレクトリの作成
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    
    return client;
  } catch (error) {
    console.error('microCMSクライアントの初期化に失敗しました:', error);
    
    // Headersエラーに関連する詳細情報を表示
    if (error.message && error.message.includes('Headers')) {
      console.error('Headers関連のエラーが検出されました。Fetch APIの初期化を確認してください。');
      console.error('現在のHeaders:', typeof global.Headers);
    }
    
    throw error; // エラーを再スローしてメイン処理でキャッチできるようにする
  }
}

/**
 * HTML内のblockquote内のbr要素を特殊なマーカーに置き換える関数
 * @param {string} html HTMLコンテンツ
 * @returns {string} 処理済みHTML
 */
function preserveQuoteLineBreaks(html) {
  const blockquoteRegex = /<blockquote>([\s\S]*?)<\/blockquote>/gi;

  return html.replace(blockquoteRegex, (match, content) => {
    // blockquote内のbr要素を特殊なマーカーに置き換え
    const processedContent = content.replace(/<br\s*\/?>/gi, '__BLOCKQUOTE_LINE_BREAK__');
    return `<blockquote>${processedContent}</blockquote>`;
  });
}

/**
 * Markdown内の引用行の特殊マーカーを正しい引用形式に置き換える関数
 * @param {string} markdown マークダウンコンテンツ
 * @returns {string} 処理済みマークダウン
 */
function restoreQuoteLineBreaks(markdown) {
  let formattedMarkdown = '';

  // 行ごとに処理
  markdown.split('\n').forEach(line => {
    // 引用行の開始を検出
    if (line.startsWith('> ')) {
      // 行内の特殊マーカーをすべて改行+引用マーカーに置換
      while (line.includes('__BLOCKQUOTE_LINE_BREAK__')) {
        line = line.replace('__BLOCKQUOTE_LINE_BREAK__', '\n> ');
      }
      formattedMarkdown += line + '\n';
    } else {
      // 引用でない行はそのまま追加
      formattedMarkdown += line + '\n';
    }
  });

  return formattedMarkdown;
}


/**
 * HTML内の特定のタグを一時的に保存し、マーカーに置き換える関数
 * @param {string} html HTMLコンテンツ
 * @returns {Object} 処理済みHTMLと保存されたタグの配列
 */
function preserveTags(html) {
  const tags = [];
  const iframeRegex = /<iframe[^>]*>[\s\S]*?<\/iframe>/gi;
  const orderedListRegex = /<ol[^>]*>[\s\S]*?<\/ol>/gi;
  const spanRegex = /<span[^>]*>[\s\S]*?<\/span>/gi;

  // マッチしたタグを置き換えて保存
  const replacer = (match) => {
    const placeholder = `__TAG_PLACEHOLDER_${tags.length}__`;
    tags.push(match);
    return placeholder;
  }

  const processedHtml = html.replace(iframeRegex, replacer)
      .replace(orderedListRegex, replacer)
      .replace(spanRegex, replacer);
  return { processedHtml, tags };
}

/**
 * マークダウン内のプレースホルダーを元のタグに戻す関数
 * @param {string} markdown マークダウンコンテンツ
 * @param {Array} tags 保存されたタグの配列
 * @returns {string} タグが戻された後のマークダウン
 */
function restoreTags(markdown, tags) {
  let restoredMarkdown = markdown;

  tags.forEach((tag, index) => {
    const placeholder = `__TAG_PLACEHOLDER_${index}__`;
    restoredMarkdown = restoredMarkdown.replace(placeholder, tag);
  });

  return restoredMarkdown;
}

/**
 * HTML内の文字実体参照を一時的に保存し、マーカーに置き換える関数
 * @param {string} html HTMLコンテンツ
 * @returns {Object} 処理済みHTMLと保存された文字実体参照の配列
 */
function preserveEntities(html) {
  const entities = [];
  const entityRegex = /&[a-zA-Z0-9#]+;/g;
  
  // 全ての文字実体参照をプレースホルダーに置き換え
  let processedHtml = html.replace(entityRegex, (match) => {
    const placeholder = `__ENTITY_PLACEHOLDER_${entities.length}__`;
    entities.push(match);
    return placeholder;
  });
  
  // <pre>タグ内のプレースホルダーを元の文字実体参照に戻す
  processedHtml = processedHtml.replace(/<pre[^>]*>[\s\S]*?<\/pre>/g, (match) => {
    let restoredMatch = match;
    entities.forEach((entity, index) => {
      const placeholder = `__ENTITY_PLACEHOLDER_${index}__`;
      restoredMatch = restoredMatch.replace(placeholder, entity);
    });
    return restoredMatch;
  });
  
  return { processedHtml, entities };
}

/**
 * マークダウン内の文字実体参照プレースホルダーを元の文字実体参照に戻す関数
 * @param {string} markdown マークダウンコンテンツ
 * @param {Array} entities 保存された文字実体参照の配列
 * @returns {string} 文字実体参照が戻された後のマークダウン
 */
function restoreEntities(markdown, entities) {
  let restoredMarkdown = markdown;
  
  entities.forEach((entity, index) => {
    const placeholder = `__ENTITY_PLACEHOLDER_${index}__`;
    restoredMarkdown = restoredMarkdown.replace(placeholder, entity);
  });
  
  return restoredMarkdown;
}

/**
 * コードブロックの言語指定を1行に整形する関数
 * @param {string} markdown マークダウンコンテンツ
 * @returns {string} 整形されたマークダウン
 */
function formatCodeBlocks(markdown) {
  // コードブロックの開始部分を検出して整形
  return markdown.replace(/```\s*\n\[(.*?)\]\n/g, '```$1\n');
}

/**
 * HTMLをMarkdownに変換する関数（iframeタグ、blockquote内の改行、文字実体参照を保持）
 * @param {string} html HTMLコンテンツ
 * @returns {string} Markdownコンテンツ
 */
function parseHtmlToMarkdown(html) {
  // 文字実体参照を保存してプレースホルダーに置き換える
  const { processedHtml: htmlWithEntities, entities } = preserveEntities(html);

  // Markdownに変換すると消えるタグを保存してプレースホルダーに置き換える
  const { processedHtml: htmlWithoutTags, tags } = preserveTags(htmlWithEntities);
  
  // blockquote内のbr要素を特殊なマーカーに置き換え
  const preparedHtml = preserveQuoteLineBreaks(htmlWithoutTags);
  
  // HTMLをMarkdownに変換
  let markdown = parser(preparedHtml);
  
  // blockquoteマーカーを元に戻す
  let formattedMarkdown = restoreQuoteLineBreaks(markdown);

  // タグを元に戻す
  formattedMarkdown = restoreTags(formattedMarkdown, tags);

  // 文字実体参照を元に戻す
  formattedMarkdown = restoreEntities(formattedMarkdown, entities);
  
  // コードブロックの言語指定を1行に整形
  formattedMarkdown = formatCodeBlocks(formattedMarkdown);

  // nbspを置換
  formattedMarkdown = formattedMarkdown.replace(/ /g, ' ');
  
  return formattedMarkdown.trim();
}

/**
 * microCMSから全ての記事を取得する関数
 */
async function fetchAllArticles(client) {
  let articles = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  console.log('記事の取得を開始します...');

  while (hasMore) {
    try {
      console.log(`記事を取得中... (offset: ${offset}, limit: ${limit})`);
      
      // APIリクエストとレスポンス処理を明示的にtry-catchで囲む
      let response;
      try {
        response = await client.get({
          endpoint: ENDPOINT, // コマンドラインオプションで指定したエンドポイント名を使用
          queries: {
            offset,
            limit,
          },
        });
        
        if (isVerbose) {
          console.log('APIレスポンス受信:', {
            total: response.totalCount,
            current: response.contents?.length || 0
          });
        }
      } catch (apiError) {
        console.error('APIリクエスト中にエラーが発生しました:', apiError);
        // Headersエラーに関連する詳細情報を表示
        if (apiError.message && apiError.message.includes('Headers')) {
          console.error('Headers関連のエラーが検出されました。Fetch APIの初期化を確認してください。');
          console.error('現在のHeaders:', typeof global.Headers);
        }
        throw apiError;
      }

      if (response.contents.length > 0) {
        articles = [...articles, ...response.contents];
        offset += limit;
        console.log(`${articles.length}件の記事を取得しました`);
      } else {
        hasMore = false;
      }

      // totalCountが取得できた場合の処理
      if (response.totalCount && articles.length >= response.totalCount) {
        hasMore = false;
      }
    } catch (error) {
      console.error('記事の取得に失敗しました:', error);
      hasMore = false;
    }
  }

  console.log(`合計${articles.length}件の記事を取得しました`);
  return articles;
}

/**
 * 記事をMDXファイルとして保存する関数
 */
function saveArticleAsMdx(article) {
  try {
    // createdAtをUNIXタイムスタンプに変換
    const createdAt = new Date(article.createdAt);
    const timestamp = Math.floor(createdAt.getTime() / 1000);
    const fileName = `${timestamp}.mdx`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    // 記事のコンテンツをHTMLからMarkdownに変換
    let content = '';
    
    // frontmatterの追加
    content += '---\n';
    content += `title: "${article.title}"\n`;
    content += `createdAt: "${article.createdAt}"\n`;
    content += `updatedAt: "${article.updatedAt}"\n`;
    
    // publishedAtがある場合は追加
    if (article.publishedAt) {
      content += `publishedAt: "${article.publishedAt}"\n`;
    }
    
    // revisedAtがある場合は追加
    if (article.revisedAt) {
      content += `revisedAt: "${article.revisedAt}"\n`;
    }
    
    // カテゴリーがある場合は追加
    if (article.category) {
      content += `category: "${article.category.name}"\n`;
    }

    // タグがある場合は追加
    if (article.tags && article.tags.length > 0) {
      content += 'tags:\n';
      article.tags.forEach(tag => {
        content += `  - "${tag.name}"\n`;
      });
    }

    // toc_visibleがある場合は追加
    if (article.toc_visible !== undefined) {
      content += `toc_visible: ${article.toc_visible}\n`;
    }

    // Frontmatterの終了
    content += '---\n\n';

    // 本文を変換して追加
    if (article.htmls && article.htmls.length > 0) {
      let markdownContent = '';
      
      // htmls配列の各要素を処理
      for (const html of article.htmls) {
        const fieldId = html.fieldId;
        let htmlContent = html[fieldId]; // fieldIdの値に対応するプロパティからコンテンツを取得
        
        if (!htmlContent) {
          console.log('htmlContentが空です。記事タイムスタンプ:', timestamp);
          continue;
        }
        if (fieldId === 'rich') {
          // コンテンツをMarkdownに変換して追加
          markdownContent += parseHtmlToMarkdown(htmlContent) + '\n\n';
        } else if (fieldId === 'plane') {
          markdownContent += htmlContent + '\n\n';
        }
      }
      
      content += markdownContent.trim();
    } else if (article.content) {
      // 従来のcontentプロパティが存在する場合の処理（互換性のため残す）
      const markdownContent = parseHtmlToMarkdown(article.content);
      content += markdownContent;
    }

    // ファイルに書き込み
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`記事を保存しました: ${fileName}`);
    
    return true;
  } catch (error) {
    console.error(`記事の保存に失敗しました: ${error.message}`);
    return false;
  }
}

/**
 * メイン処理
 */
async function main() {
  try {
    console.log(`出力先ディレクトリ: ${OUTPUT_DIR}`);
    console.log(`microCMSエンドポイント: ${ENDPOINT}`);

    // microCMSクライアントを初期化
    const client = setupClient();

    // 全記事の取得
    const articles = await fetchAllArticles(client);
    
    if (articles.length === 0) {
      console.log('記事が見つかりませんでした。');
      return;
    }
    
    console.log('記事のMDX変換を開始します...');
    
    // 各記事をMDXに変換して保存
    let successCount = 0;
    for (const article of articles) {
      const success = saveArticleAsMdx(article);
      if (success) successCount++;
    }
    
    console.log(`処理が完了しました。${successCount}/${articles.length}件の記事を変換しました。`);
    console.log(`出力ディレクトリ: ${path.resolve(OUTPUT_DIR)}`);
  } catch (error) {
    console.error('エラーが発生しました:', error);
    process.exit(1);
  }
}

// スクリプトの実行
try {
  main();
} catch (error) {
  console.error('エラーが発生しました:', error);
  process.exit(1);
} 