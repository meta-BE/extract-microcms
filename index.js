const { createClient } = require('microcms-js-sdk');
const { parser } = require("rich-editor-to-markdown-parser");
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// .envファイルを読み込む
dotenv.config();

// 出力ディレクトリの設定
const OUTPUT_DIR = './output';

// microCMSクライアントの初期化
const client = createClient({
  serviceDomain: process.env.MICROCMS_SERVICE_DOMAIN,
  apiKey: process.env.MICROCMS_API_KEY,
});

// HTMLをMarkdownに変換するパーサーの初期化
// const parser = parser;

// 出力ディレクトリの作成
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * HTML内のiframeタグを一時的に保存し、マーカーに置き換える関数
 * @param {string} html HTMLコンテンツ
 * @returns {Object} 処理済みHTMLと保存されたiframeタグの配列
 */
function preserveIframes(html) {
  const iframes = [];
  const iframeRegex = /<iframe[^>]*>[\s\S]*?<\/iframe>/gi;
  
  // iframeタグを見つけて保存し、マーカーに置き換える
  const processedHtml = html.replace(iframeRegex, (match) => {
    const placeholder = `__IFRAME_PLACEHOLDER_${iframes.length}__`;
    iframes.push(match);
    return placeholder;
  });
  
  return { processedHtml, iframes };
}

/**
 * マークダウン内のiframeプレースホルダーを元のiframeタグに戻す関数
 * @param {string} markdown マークダウンコンテンツ
 * @param {Array} iframes 保存されたiframeタグの配列
 * @returns {string} iframeタグが戻された後のマークダウン
 */
function restoreIframes(markdown, iframes) {
  let restoredMarkdown = markdown;
  
  iframes.forEach((iframe, index) => {
    const placeholder = `__IFRAME_PLACEHOLDER_${index}__`;
    restoredMarkdown = restoredMarkdown.replace(placeholder, iframe);
  });
  
  return restoredMarkdown;
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
 * HTMLをMarkdownに変換する関数（iframeタグとblockquote内の改行を保持）
 * @param {string} html HTMLコンテンツ
 * @returns {string} Markdownコンテンツ
 */
function parseHtmlToMarkdown(html) {
  // iframeタグを保存してプレースホルダーに置き換える
  const { processedHtml, iframes } = preserveIframes(html);
  
  // blockquote内のbr要素を特殊なマーカーに置き換え
  const preparedHtml = preserveQuoteLineBreaks(processedHtml);
  
  // HTMLをMarkdownに変換
  let markdown = parser(preparedHtml);
  
  // 特殊マーカーを正しいMarkdown引用形式に置き換え
  let formattedMarkdown = restoreQuoteLineBreaks(markdown);
  
  // iframeタグを元に戻す
  formattedMarkdown = restoreIframes(formattedMarkdown, iframes);
  
  return formattedMarkdown.trim();
}

/**
 * microCMSから全ての記事を取得する関数
 */
async function fetchAllArticles() {
  let articles = [];
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  console.log('記事の取得を開始します...');

  while (hasMore) {
    try {
      const response = await client.get({
        endpoint: 'articles', // エンドポイント名を適宜変更してください
        queries: {
          offset,
          limit,
        },
      });

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
    const fileName = `${timestamp}.md`;
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

    // 本文を変換して追加
    if (article.htmls && article.htmls.length > 0) {
      let markdownContent = '';
      
      // htmls配列の各要素を処理
      for (const html of article.htmls) {
        const fieldId = html.fieldId;
        let htmlContent = html[fieldId]; // fieldIdの値に対応するプロパティからコンテンツを取得
        
        if (htmlContent) {
          // コンテンツをMarkdownに変換して追加（iframeタグを保持）
          markdownContent += parseHtmlToMarkdown(htmlContent) + '\n\n';
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
    // 全記事の取得
    const articles = await fetchAllArticles();
    
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
  }
}

// スクリプトの実行
main(); 