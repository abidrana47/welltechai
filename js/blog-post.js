(function () {
  'use strict';

  var doc = document;

  var pageTitle = doc.getElementById('pageTitle');
  var pageDescription = doc.getElementById('pageDescription');
  var articleTitle = doc.getElementById('articleTitle');
  var articleExcerpt = doc.getElementById('articleExcerpt');
  var articleMeta = doc.getElementById('articleMeta');
  var articleBody = doc.getElementById('articleBody');
  var articleCover = doc.getElementById('articleCover');
  var articleSidebarText = doc.getElementById('articleSidebarText');
  var relatedLinks = doc.getElementById('relatedLinks');

  function getApiBase() {
    var host = window.location.hostname;
    var port = window.location.port;
    var isLocalHost = host === 'localhost' || host === '127.0.0.1';

    if (isLocalHost && port && port !== '3000') {
      return window.location.protocol + '//' + host + ':3000';
    }

    return '';
  }

  function getApiUrl(path) {
    return getApiBase() + path;
  }

  function getArticleUrl(slug) {
    var encodedSlug = encodeURIComponent(slug);
    var host = window.location.hostname;
    var port = window.location.port;
    var isLocalHost = host === 'localhost' || host === '127.0.0.1';

    if (isLocalHost && port && port !== '3000') {
      return '/blog/_post.html?slug=' + encodedSlug;
    }

    return '/blog/' + encodedSlug;
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return 'Draft';

    try {
      return new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    } catch {
      return value;
    }
  }

  function getSlug() {
    var params = new URLSearchParams(window.location.search);
    var slug = params.get('slug');
    if (slug) return slug;

    var parts = window.location.pathname.split('/').filter(Boolean);
    var last = parts[parts.length - 1] || '';
    if (last && last !== '_post.html' && last !== 'post.html' && last !== 'blog') {
      return decodeURIComponent(last);
    }

    return '';
  }

  function setMetaContent(selector, value) {
    var element = doc.querySelector(selector);
    if (element) {
      element.setAttribute('content', value);
    }
  }

  function setCanonical(url) {
    var link = doc.querySelector('link[rel="canonical"]');
    if (link) {
      link.setAttribute('href', url);
    }
  }

  function renderRelatedPosts(posts, currentSlug) {
    relatedLinks.innerHTML = '';

    var filtered = posts.filter(function (post) {
      return post.slug !== currentSlug;
    });

    if (!filtered.length) {
      relatedLinks.innerHTML =
        '<a class="sidebar-post-card" href="/blog/">' +
        '<strong>View all blog posts</strong>' +
        '<small>No other published posts yet. Browse the full blog archive.</small>' +
        '</a>';
      return;
    }

    for (var i = 0; i < Math.min(filtered.length, 4); i += 1) {
      var post = filtered[i];
      var anchor = doc.createElement('a');
      anchor.className = 'sidebar-post-card';
      anchor.href = getArticleUrl(post.slug);
      anchor.innerHTML =
        '<strong>' +
        escapeHtml(post.title) +
        '</strong>' +
        '<small>' +
        escapeHtml(formatDate(post.published_at || post.created_at)) +
        '</small>';

      relatedLinks.appendChild(anchor);
    }
  }

  function renderError(message) {
    pageTitle.textContent = 'Article unavailable';
    pageDescription.textContent = message;
    articleTitle.textContent = 'Article unavailable';
    articleExcerpt.textContent = message;
    articleMeta.innerHTML = '<span>Unable to load content.</span>';
    articleBody.innerHTML =
      '<p>' +
      escapeHtml(message) +
      '</p><p><a href="/blog/">Back to the blog feed</a></p>';
    articleSidebarText.textContent =
      'This article could not be loaded. Please return to the blog feed or check the slug.';
    relatedLinks.innerHTML = '';
  }

  function renderPost(post) {
    var publishDate = formatDate(post.published_at || post.created_at);
    var readTime = String(post.read_time_minutes || 1) + ' min read';

    pageTitle.textContent = post.title;
    pageDescription.textContent = post.excerpt || 'Read this WellTechAI CIC blog article.';
    articleTitle.textContent = post.title;
    articleExcerpt.textContent = post.excerpt || '';
    articleMeta.innerHTML =
      '<span class="status-pill">Published</span>' +
      '<span><strong>' +
      escapeHtml(post.author_name || 'WellTechAI CIC') +
      '</strong></span>' +
      '<span>' +
      escapeHtml(publishDate) +
      '</span>' +
      '<span>' +
      escapeHtml(readTime) +
      '</span>';
    articleBody.innerHTML = post.body_html || '<p>No article content available.</p>';

    if (post.cover_image_url) {
      articleCover.hidden = false;
      articleCover.innerHTML =
        '<img src="' +
        escapeHtml(post.cover_image_url) +
        '" alt="' +
        escapeHtml(post.image_alt || post.title) +
        '" loading="eager" decoding="async">';
    } else {
      articleCover.hidden = true;
      articleCover.innerHTML = '';
    }

    articleSidebarText.textContent =
      (post.author_name || 'WellTechAI CIC') +
      ' published this article on ' +
      publishDate +
      '. Estimated reading time: ' +
      readTime +
      '.';

    var articleUrl = window.location.origin + getArticleUrl(post.slug);
    doc.title = post.title + ' | WellTechAI Blog';
    setCanonical(articleUrl);
    setMetaContent('meta[name="description"]', post.excerpt || 'Read this WellTechAI CIC blog article.');
    setMetaContent('meta[property="og:title"]', post.title + ' | WellTechAI Blog');
    setMetaContent('meta[property="og:description"]', post.excerpt || 'Read this WellTechAI CIC blog article.');
    setMetaContent('meta[property="og:url"]', articleUrl);
    setMetaContent('meta[property="og:image"]', post.cover_image_url || 'https://www.welltechai.co.uk/assets/logo.webp');
    setMetaContent('meta[name="twitter:title"]', post.title + ' | WellTechAI Blog');
    setMetaContent('meta[name="twitter:description"]', post.excerpt || 'Read this WellTechAI CIC blog article.');
    setMetaContent('meta[name="twitter:image"]', post.cover_image_url || 'https://www.welltechai.co.uk/assets/logo.webp');
  }

  async function loadRecentPosts(currentSlug) {
    try {
      var response = await fetch(getApiUrl('/api/blog-posts'));
      var payload = await response.json();
      if (!response.ok || !payload.ok) return;
      renderRelatedPosts(Array.isArray(payload.posts) ? payload.posts : [], currentSlug);
    } catch {}
  }

  async function loadPost() {
    var slug = getSlug();
    if (!slug) {
      renderError('No blog slug was provided.');
      return;
    }

    try {
      var response = await fetch(getApiUrl('/api/blog-post?slug=' + encodeURIComponent(slug)));
      var payload = await response.json();

      if (!response.ok || !payload.ok || !payload.post) {
        throw new Error(payload.error || 'Unable to load the article.');
      }

      renderPost(payload.post);
      loadRecentPosts(payload.post.slug);
    } catch (error) {
      renderError(error.message || 'Unable to load the article.');
    }
  }

  loadPost();
})();
