(function () {
  'use strict';

  var doc = document;
  var postsList = doc.getElementById('postsList');
  var postCount = doc.getElementById('postCount');

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

  function formatDate(value) {
    if (!value) return 'Draft';

    try {
      return new Date(value).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return value;
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getPostUrl(post) {
    return getArticleUrl(post.slug);
  }

  function createCard(post) {
    var article = doc.createElement('article');
    article.className = 'feed-card rv in';

    var link = doc.createElement('a');
    link.className = 'blog-card-link';
    link.href = getPostUrl(post);

    if (post.cover_image_url) {
      var media = doc.createElement('div');
      media.className = 'blog-card-media';

      var image = doc.createElement('img');
      image.src = post.cover_image_url;
      image.alt = post.image_alt || post.title;
      image.loading = 'lazy';
      image.decoding = 'async';
      media.appendChild(image);
      media.insertAdjacentHTML(
        'beforeend',
        '<div class="blog-card-fade"></div><div class="blog-card-badge">Published Post</div>'
      );
      link.appendChild(media);
    }

    var body = doc.createElement('div');
    body.className = 'blog-card-body';
    body.innerHTML =
      '<h3 class="blog-card-title">' +
      escapeHtml(post.title) +
      '</h3>' +
      '<p class="blog-card-excerpt">' +
      escapeHtml(post.excerpt || '') +
      '</p>' +
      '<div class="blog-card-divider"></div>' +
      '<div class="blog-card-tags">' +
      '<span class="blog-card-tag">' +
      escapeHtml(post.author_name || 'WellTechAI CIC') +
      '</span>' +
      '<span class="blog-card-tag">' +
      escapeHtml(formatDate(post.published_at || post.created_at)) +
      '</span>' +
      '<span class="blog-card-tag">' +
      escapeHtml(String(post.read_time_minutes || 1)) +
      ' min read</span>' +
      '</div>' +
      '<div class="blog-card-footer">' +
      '<span class="blog-card-cta">Read Article -&gt;</span>' +
      '</div>';

    link.appendChild(body);
    article.appendChild(link);
    return article;
  }

  function setCounts(totalPosts) {
    if (postCount) {
      postCount.textContent = totalPosts + (totalPosts === 1 ? ' article' : ' articles');
    }
  }

  function renderEmpty(message) {
    if (postsList) {
      postsList.innerHTML =
        '<article class="empty-state rv in">' +
        '<h3>No published blog posts yet</h3>' +
        '<p>' +
        escapeHtml(message || 'Create your first post from the dashboard and publish it to see it here.') +
        '</p>' +
        '</article>';
    }

    setCounts(0);
  }

  async function loadPosts() {
    try {
      var response = await fetch(getApiUrl('/api/blog-posts'));
      var payload = await response.json();

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'Unable to load blog posts.');
      }

      var posts = Array.isArray(payload.posts) ? payload.posts : [];
      if (!posts.length) {
        renderEmpty();
        return;
      }

      if (postsList) {
        postsList.innerHTML = '';
        for (var i = 0; i < posts.length; i += 1) {
          postsList.appendChild(createCard(posts[i]));
        }
      }

      setCounts(posts.length);
    } catch (error) {
      renderEmpty(error.message || 'Something went wrong while loading the feed.');
    }
  }

  loadPosts();
})();
